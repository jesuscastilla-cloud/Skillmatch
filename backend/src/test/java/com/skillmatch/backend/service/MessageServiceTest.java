package com.skillmatch.backend.service;

import com.skillmatch.backend.dto.ChatMessageResponse;
import com.skillmatch.backend.dto.MessageRequest;
import com.skillmatch.backend.exception.ResourceNotFoundException;
import com.skillmatch.backend.exception.UnauthorizedException;
import com.skillmatch.backend.model.Message;
import com.skillmatch.backend.model.User;
import com.skillmatch.backend.repository.MessageRepository;
import com.skillmatch.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock private MessageRepository messageRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private MessageService messageService;

    private User sender;
    private User receiver;

    @BeforeEach
    void setUp() {
        sender = new User();
        sender.setId("user-id-1");
        sender.setFirstName("Ana");
        sender.setLastName("García");
        sender.setEmail("ana@test.com");

        receiver = new User();
        receiver.setId("user-id-2");
        receiver.setFirstName("Luis");
        receiver.setLastName("Martínez");
        receiver.setEmail("luis@test.com");
    }

    // ─── sendMessage ──────────────────────────────────────────────────────────

    @Test
    void sendMessage_happyPath_savesAndNotifies() {
        MessageRequest req = new MessageRequest("user-id-2", "Hola!", null);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(sender));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.of(receiver));
        Message saved = buildMessage("msg-id-10", sender, receiver);
        when(messageRepository.save(any(Message.class))).thenReturn(saved);

        ChatMessageResponse response = messageService.sendMessage("user-id-1", req);

        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(captor.capture());
        assertThat(captor.getValue().getIsRead()).isFalse();
        assertThat(captor.getValue().getDeletedBySender()).isFalse();
        assertThat(captor.getValue().getDeletedByReceiver()).isFalse();

        verify(notificationService).createMessageNotification(
                eq("user-id-2"), eq("user-id-1"), eq("msg-id-10"));

        assertThat(response.getSenderId()).isEqualTo("user-id-1");
        assertThat(response.getReceiverId()).isEqualTo("user-id-2");
    }

    @Test
    void sendMessage_toSelf_throwsIllegalArgument() {
        MessageRequest req = new MessageRequest("user-id-1", "Hola!", null);

        assertThatThrownBy(() -> messageService.sendMessage("user-id-1", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ti mismo");
    }

    @Test
    void sendMessage_nullReceiverId_throwsIllegalArgument() {
        MessageRequest req = new MessageRequest(null, "Hola!", null);

        assertThatThrownBy(() -> messageService.sendMessage("user-id-1", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nulo");
    }

    @Test
    void sendMessage_senderNotFound_throwsResourceNotFound() {
        MessageRequest req = new MessageRequest("user-id-2", "Hola!", null);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.sendMessage("user-id-1", req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void sendMessage_receiverNotFound_throwsResourceNotFound() {
        MessageRequest req = new MessageRequest("user-id-2", "Hola!", null);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(sender));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.sendMessage("user-id-1", req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void sendMessage_noNotificationWhenSaveFails() {
        MessageRequest req = new MessageRequest("user-id-2", "Hola!", null);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(sender));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.of(receiver));
        when(messageRepository.save(any())).thenThrow(new RuntimeException("DB error"));

        assertThatThrownBy(() -> messageService.sendMessage("user-id-1", req))
                .isInstanceOf(RuntimeException.class);

        verifyNoInteractions(notificationService);
    }

    // ─── getConversation ──────────────────────────────────────────────────────

    @Test
    void getConversation_returnsMappedList() {
        Message m1 = buildMessage("msg-id-11", sender, receiver);
        Message m2 = buildMessage("msg-id-12", receiver, sender);
        when(mongoTemplate.find(any(), eq(Message.class))).thenReturn(List.of(m1, m2));
        when(userRepository.findAllById(any())).thenReturn(List.of(sender, receiver));

        List<ChatMessageResponse> result = messageService.getConversation("user-id-1", "user-id-2");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo("msg-id-11");
        assertThat(result.get(1).getId()).isEqualTo("msg-id-12");
    }

    @Test
    void getConversation_empty_returnsEmptyList() {
        when(mongoTemplate.find(any(), eq(Message.class))).thenReturn(List.of());

        assertThat(messageService.getConversation("user-id-1", "user-id-2")).isEmpty();
    }

    // ─── markAsRead ───────────────────────────────────────────────────────────

    @Test
    void markAsRead_happyPath_setsReadAndSaves() {
        Message msg = buildMessage("msg-id-10", sender, receiver);
        msg.setIsRead(false);
        when(messageRepository.findById("msg-id-10")).thenReturn(Optional.of(msg));
        when(messageRepository.save(any(Message.class))).thenReturn(msg);
        when(userRepository.findById("user-id-1")).thenReturn(Optional.of(sender));
        when(userRepository.findById("user-id-2")).thenReturn(Optional.of(receiver));

        messageService.markAsRead("msg-id-10", "user-id-2");

        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(captor.capture());
        assertThat(captor.getValue().getIsRead()).isTrue();
        assertThat(captor.getValue().getReadAt()).isNotNull();
    }

    @Test
    void markAsRead_alreadyRead_skipsUpdate() {
        Message msg = buildMessage("msg-id-10", sender, receiver);
        msg.setIsRead(true);
        when(messageRepository.findById("msg-id-10")).thenReturn(Optional.of(msg));

        messageService.markAsRead("msg-id-10", "user-id-2");

        verify(messageRepository, never()).save(any());
    }

    @Test
    void markAsRead_notFound_throwsResourceNotFound() {
        when(messageRepository.findById("msg-id-99")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.markAsRead("msg-id-99", "user-id-2"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void markAsRead_wrongUser_throwsUnauthorized() {
        Message msg = buildMessage("msg-id-10", sender, receiver);
        when(messageRepository.findById("msg-id-10")).thenReturn(Optional.of(msg));

        assertThatThrownBy(() -> messageService.markAsRead("msg-id-10", "user-id-1"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void markAsRead_nullMessageId_throwsIllegalArgument() {
        assertThatThrownBy(() -> messageService.markAsRead(null, "user-id-2"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ─── markConversationAsRead ───────────────────────────────────────────────

    @Test
    void markConversationAsRead_happyPath_setsIsReadAndSavesAll() {
        Message m1 = buildMessage("msg-id-11", sender, receiver);
        Message m2 = buildMessage("msg-id-12", sender, receiver);
        when(messageRepository.findBySenderIdAndReceiverIdAndIsReadFalseAndDeletedByReceiverFalse(
                "user-id-2", "user-id-1")).thenReturn(List.of(m1, m2));

        messageService.markConversationAsRead("user-id-1", "user-id-2");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Message>> captor = ArgumentCaptor.forClass(List.class);
        verify(messageRepository).saveAll(captor.capture());

        List<Message> saved = captor.getValue();
        assertThat(saved).hasSize(2);
        assertThat(saved).allMatch(Message::getIsRead);
        assertThat(saved).allMatch(m -> m.getReadAt() != null);
    }

    @Test
    void markConversationAsRead_emptyList_noSaveAll() {
        when(messageRepository.findBySenderIdAndReceiverIdAndIsReadFalseAndDeletedByReceiverFalse(
                "user-id-2", "user-id-1")).thenReturn(List.of());

        messageService.markConversationAsRead("user-id-1", "user-id-2");

        verify(messageRepository, never()).saveAll(any());
    }

    // ─── deleteMessage ────────────────────────────────────────────────────────

    @Test
    void deleteMessage_bySender_setsSenderFlagAndSaves() {
        Message msg = buildMessage("msg-id-10", sender, receiver);
        when(messageRepository.findById("msg-id-10")).thenReturn(Optional.of(msg));

        messageService.deleteMessage("msg-id-10", "user-id-1");

        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(captor.capture());
        assertThat(captor.getValue().getDeletedBySender()).isTrue();
        verify(messageRepository, never()).delete(any());
    }

    @Test
    void deleteMessage_byReceiver_setsReceiverFlagAndSaves() {
        Message msg = buildMessage("msg-id-10", sender, receiver);
        when(messageRepository.findById("msg-id-10")).thenReturn(Optional.of(msg));

        messageService.deleteMessage("msg-id-10", "user-id-2");

        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(captor.capture());
        assertThat(captor.getValue().getDeletedByReceiver()).isTrue();
        verify(messageRepository, never()).delete(any());
    }

    @Test
    void deleteMessage_bothDeleted_callsHardDelete() {
        Message msg = buildMessage("msg-id-10", sender, receiver);
        msg.setDeletedBySender(true);
        when(messageRepository.findById("msg-id-10")).thenReturn(Optional.of(msg));

        messageService.deleteMessage("msg-id-10", "user-id-2");

        verify(messageRepository).delete(msg);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void deleteMessage_thirdParty_throwsUnauthorized() {
        Message msg = buildMessage("msg-id-10", sender, receiver);
        when(messageRepository.findById("msg-id-10")).thenReturn(Optional.of(msg));

        assertThatThrownBy(() -> messageService.deleteMessage("msg-id-10", "user-id-99"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void deleteMessage_notFound_throwsResourceNotFound() {
        when(messageRepository.findById("msg-id-99")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.deleteMessage("msg-id-99", "user-id-1"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deleteMessage_nullMessageId_throwsIllegalArgument() {
        assertThatThrownBy(() -> messageService.deleteMessage(null, "user-id-1"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ─── getUnreadCount ───────────────────────────────────────────────────────

    @Test
    void getUnreadCount_returnsCount() {
        when(messageRepository.countByReceiverIdAndIsReadFalseAndDeletedByReceiverFalse("user-id-2"))
                .thenReturn(5L);

        assertThat(messageService.getUnreadCount("user-id-2")).isEqualTo(5L);
    }

    // ─── getUnreadCountFromUser ───────────────────────────────────────────────

    @Test
    void getUnreadCountFromUser_returnsCount() {
        // getUnreadCountFromUser(userId="user-id-2", fromUserId="user-id-1")
        // service calls: countBySenderIdAndReceiverId(fromUserId, userId) = ("user-id-1", "user-id-2")
        when(messageRepository.countBySenderIdAndReceiverIdAndIsReadFalseAndDeletedByReceiverFalse(
                "user-id-1", "user-id-2")).thenReturn(3L);

        assertThat(messageService.getUnreadCountFromUser("user-id-2", "user-id-1")).isEqualTo(3L);
    }

    // ─── getLastMessages ──────────────────────────────────────────────────────

    @Test
    void getLastMessages_returnsMappedList() {
        Message m1 = buildMessage("msg-id-11", sender, receiver);
        Message m2 = buildMessage("msg-id-12", receiver, sender);
        when(mongoTemplate.find(any(), eq(Message.class))).thenReturn(List.of(m1, m2));
        when(userRepository.findAllById(any())).thenReturn(List.of(sender, receiver));

        List<ChatMessageResponse> result = messageService.getLastMessages("user-id-1");

        // m1 and m2 are between the same two users; service deduplicates to 1 conversation
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo("msg-id-11");
    }

    @Test
    void getLastMessages_empty_returnsEmptyList() {
        when(mongoTemplate.find(any(), eq(Message.class))).thenReturn(List.of());

        assertThat(messageService.getLastMessages("user-id-1")).isEmpty();
    }

    // ─── getUnreadCountsByConversation ────────────────────────────────────────

    @Test
    void getUnreadCountsByConversation_groupsBySenderId() {
        User senderB = new User();
        senderB.setId("user-id-3");
        senderB.setFirstName("Carlos");
        senderB.setLastName("López");
        senderB.setEmail("carlos@test.com");

        Message m1 = buildMessage("msg-id-11", sender, receiver);
        Message m2 = buildMessage("msg-id-12", sender, receiver);
        Message m3 = buildMessage("msg-id-13", senderB, receiver);

        when(messageRepository.findByReceiverIdAndIsReadFalseAndDeletedByReceiverFalse("user-id-2"))
                .thenReturn(List.of(m1, m2, m3));

        Map<String, Long> result = messageService.getUnreadCountsByConversation("user-id-2");

        assertThat(result).containsEntry("user-id-1", 2L)
                          .containsEntry("user-id-3", 1L)
                          .hasSize(2);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private Message buildMessage(String id, User msgSender, User msgReceiver) {
        Message msg = new Message();
        msg.setId(id);
        msg.setSenderId(msgSender.getId());
        msg.setReceiverId(msgReceiver.getId());
        msg.setContent("Mensaje de prueba");
        msg.setIsRead(false);
        msg.setDeletedBySender(false);
        msg.setDeletedByReceiver(false);
        return msg;
    }
}
