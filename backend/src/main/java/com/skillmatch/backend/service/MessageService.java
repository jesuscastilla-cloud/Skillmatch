package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.ChatMessageResponse;
import com.skillmatch.backend.dto.MessageRequest;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.exception.UnauthorizedException;
import com.skillmatch.backend.model.ConnectionStatus;
import com.skillmatch.backend.model.Message;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.ConnectionRepository;
import com.skillmatch.backend.repository.MessageRepository;
import com.skillmatch.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConnectionRepository connectionRepository;
    private final LimiteEnvios limiteEnvios;

    /** Mensajes que devuelve una conversación (los más recientes). */
    static final int MAX_CONVERSACION = 1000;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MongoTemplate mongoTemplate;

    public ChatMessageResponse sendMessage(String senderId, MessageRequest request) {
        String receiverId = request.getReceiverId();
        if (receiverId == null || receiverId.isBlank()) {
            throw new IllegalArgumentException("El ID del destinatario no puede ser nulo");
        }
        if (senderId.equals(receiverId)) {
            throw new IllegalArgumentException("No puedes enviarte un mensaje a ti mismo");
        }

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Remitente no encontrado"));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResourceNotFoundException("Destinatario no encontrado"));

        // Bloquear sirve de algo: no llegan mensajes (ni notificaciones) entre las dos personas.
        // El texto no dice quién bloqueó a quién.
        if (connectionRepository.existsBetween(senderId, receiverId, ConnectionStatus.BLOCKED)) {
            throw new UnauthorizedException("No puedes enviar mensajes a esta persona");
        }
        limiteEnvios.registrarMensaje(senderId);

        Message message = new Message();
        message.setSenderId(senderId);
        message.setReceiverId(receiverId);
        message.setContent(request.getContent());
        message.setAttachmentUrl(request.getAttachmentUrl());
        message.setIsRead(false);
        message.setDeletedBySender(false);
        message.setDeletedByReceiver(false);
        message.setSentAt(LocalDateTime.now());

        message = messageRepository.save(message);

        notificationService.createMessageNotification(receiverId, senderId, message.getId());

        log.debug("Mensaje enviado: senderId={}, receiverId={}, messageId={}", senderId, receiverId, message.getId());
        return mapToResponse(message, sender, receiver);
    }

    public List<ChatMessageResponse> getConversation(String userId, String otherUserId) {
        Criteria criteria = new Criteria().orOperator(
                Criteria.where("senderId").is(userId).and("receiverId").is(otherUserId).and("deletedBySender").is(false),
                Criteria.where("senderId").is(otherUserId).and("receiverId").is(userId).and("deletedByReceiver").is(false)
        );
        // Solo los MAX_CONVERSACION más recientes: antes se cargaban todos en cada apertura.
        // Se piden del más nuevo al más viejo y se devuelven en el orden de siempre.
        List<Message> messages = new ArrayList<>(mongoTemplate.find(
                new Query(criteria).with(Sort.by(Sort.Direction.DESC, "sentAt")).limit(MAX_CONVERSACION),
                Message.class));
        Collections.reverse(messages);
        return mapListWithBatchUsers(messages);
    }

    public ChatMessageResponse markAsRead(String messageId, String userId) {
        if (messageId == null) throw new IllegalArgumentException("El ID del mensaje no puede ser nulo");
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado"));

        if (!message.getReceiverId().equals(userId)) {
            throw new UnauthorizedException("No tienes permiso para marcar este mensaje como leído");
        }

        if (!Boolean.TRUE.equals(message.getIsRead())) {
            message.setIsRead(true);
            message.setReadAt(LocalDateTime.now());
            message = messageRepository.save(message);
        }

        User sender = userRepository.findById(message.getSenderId()).orElse(null);
        User receiver = userRepository.findById(message.getReceiverId()).orElse(null);
        return mapToResponse(message, sender, receiver);
    }

    public void markConversationAsRead(String userId, String otherUserId) {
        List<Message> unread = messageRepository
                .findBySenderIdAndReceiverIdAndIsReadFalseAndDeletedByReceiverFalse(otherUserId, userId);
        if (unread.isEmpty()) return;
        LocalDateTime now = LocalDateTime.now();
        unread.forEach(m -> { m.setIsRead(true); m.setReadAt(now); });
        messageRepository.saveAll(unread);
        log.debug("{} mensajes marcados como leídos en conversación userId={} con otherUserId={}",
                unread.size(), userId, otherUserId);
    }

    public void deleteMessage(String messageId, String userId) {
        if (messageId == null) throw new IllegalArgumentException("El ID del mensaje no puede ser nulo");
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado"));

        if (message.getSenderId().equals(userId)) {
            message.setDeletedBySender(true);
        } else if (message.getReceiverId().equals(userId)) {
            message.setDeletedByReceiver(true);
        } else {
            throw new UnauthorizedException("No tienes permiso para eliminar este mensaje");
        }

        if (Boolean.TRUE.equals(message.getDeletedBySender()) && Boolean.TRUE.equals(message.getDeletedByReceiver())) {
            messageRepository.delete(message);
        } else {
            messageRepository.save(message);
        }
    }

    /**
     * "Eliminar conversación" de una vez (docs/CAMBIOS-FRONTEND.md, F5). Como deleteMessage:
     * se borra solo del lado de quien la elimina (la otra persona la sigue viendo) y los
     * mensajes que ya borraron los dos desaparecen. Antes el frontend borraba de a uno
     * y la conversación solo trae los últimos MAX_CONVERSACION: los viejos quedaban.
     * Devuelve cuántos mensajes quedaron borrados de su lado.
     */
    public long deleteConversation(String userId, String otherUserId) {
        if (otherUserId == null || otherUserId.isBlank()) {
            throw new IllegalArgumentException("El ID de la otra persona no puede ser nulo");
        }
        long enviados = mongoTemplate.updateMulti(
                new Query(Criteria.where("senderId").is(userId).and("receiverId").is(otherUserId)
                        .and("deletedBySender").is(false)),
                new Update().set("deletedBySender", true), Message.class).getModifiedCount();
        long recibidos = mongoTemplate.updateMulti(
                new Query(Criteria.where("senderId").is(otherUserId).and("receiverId").is(userId)
                        .and("deletedByReceiver").is(false)),
                new Update().set("deletedByReceiver", true), Message.class).getModifiedCount();
        mongoTemplate.remove(new Query(new Criteria().orOperator(
                Criteria.where("senderId").is(userId).and("receiverId").is(otherUserId),
                Criteria.where("senderId").is(otherUserId).and("receiverId").is(userId))
                .and("deletedBySender").is(true).and("deletedByReceiver").is(true)), Message.class);
        log.debug("Conversación de userId={} con otherUserId={} eliminada de su lado ({} mensajes)",
                userId, otherUserId, enviados + recibidos);
        return enviados + recibidos;
    }

    public long getUnreadCount(String userId) {
        return messageRepository.countByReceiverIdAndIsReadFalseAndDeletedByReceiverFalse(userId);
    }

    public long getUnreadCountFromUser(String userId, String fromUserId) {
        return messageRepository.countBySenderIdAndReceiverIdAndIsReadFalseAndDeletedByReceiverFalse(fromUserId, userId);
    }

    public List<ChatMessageResponse> getLastMessages(String userId) {
        Criteria criteria = new Criteria().orOperator(
                Criteria.where("senderId").is(userId).and("deletedBySender").is(false),
                Criteria.where("receiverId").is(userId).and("deletedByReceiver").is(false)
        );
        List<Message> messages = mongoTemplate.find(
                new Query(criteria).with(Sort.by(Sort.Direction.DESC, "sentAt")).limit(200),
                Message.class);

        // Keep only the latest message per conversation partner
        Map<String, Message> latestByPartner = new LinkedHashMap<>();
        for (Message msg : messages) {
            String partner = msg.getSenderId().equals(userId) ? msg.getReceiverId() : msg.getSenderId();
            latestByPartner.putIfAbsent(partner, msg);
        }

        Set<String> allIds = new HashSet<>(latestByPartner.keySet());
        allIds.add(userId);
        Map<String, User> userMap = userRepository.findAllById(allIds)
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        return latestByPartner.values().stream()
                .map(msg -> mapToResponse(msg, userMap.get(msg.getSenderId()), userMap.get(msg.getReceiverId())))
                .collect(Collectors.toList());
    }

    public Map<String, Long> getUnreadCountsByConversation(String userId) {
        List<Message> unread = messageRepository.findByReceiverIdAndIsReadFalseAndDeletedByReceiverFalse(userId);
        return unread.stream()
                .collect(Collectors.groupingBy(Message::getSenderId, Collectors.counting()));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private List<ChatMessageResponse> mapListWithBatchUsers(List<Message> messages) {
        if (messages.isEmpty()) return List.of();
        Set<String> userIds = messages.stream()
                .flatMap(m -> java.util.stream.Stream.of(m.getSenderId(), m.getReceiverId()))
                .collect(Collectors.toSet());
        Map<String, User> userMap = userRepository.findAllById(userIds)
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        return messages.stream()
                .map(m -> mapToResponse(m, userMap.get(m.getSenderId()), userMap.get(m.getReceiverId())))
                .collect(Collectors.toList());
    }

    private ChatMessageResponse mapToResponse(Message message, User sender, User receiver) {
        ChatMessageResponse response = new ChatMessageResponse();
        response.setId(message.getId());
        if (sender != null) {
            response.setSenderId(sender.getId());
            response.setSenderName(sender.getFirstName() + " " + sender.getLastName());
            response.setSenderProfileImage(sender.getProfileImageUrl());
        }
        if (receiver != null) {
            response.setReceiverId(receiver.getId());
            response.setReceiverName(receiver.getFirstName() + " " + receiver.getLastName());
            response.setReceiverProfileImage(receiver.getProfileImageUrl());
        }
        response.setContent(message.getContent());
        response.setIsRead(message.getIsRead());
        response.setReadAt(message.getReadAt());
        response.setSentAt(message.getSentAt());
        response.setAttachmentUrl(message.getAttachmentUrl());
        return response;
    }
}
