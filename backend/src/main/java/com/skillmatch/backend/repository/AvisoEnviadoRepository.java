package com.skillmatch.backend.repository;

import java.time.LocalDateTime;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.skillmatch.backend.model.AvisoEnviado;

public interface AvisoEnviadoRepository extends MongoRepository<AvisoEnviado, String> {

    boolean existsByUserIdAndTipoAndClaveAndFechaAfter(String userId, String tipo, String clave, LocalDateTime desde);
}
