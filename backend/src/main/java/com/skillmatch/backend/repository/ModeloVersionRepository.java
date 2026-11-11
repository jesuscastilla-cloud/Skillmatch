package com.skillmatch.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import com.skillmatch.backend.model.ModeloVersion;

public interface ModeloVersionRepository extends MongoRepository<ModeloVersion, String> {

    Optional<ModeloVersion> findTopByOrderByFechaDesc();

    /** Solo la fecha y las notas de cada version (sin el modelo completo): para la linea de la pagina. */
    @Query(value = "{}", fields = "{ 'modelo': 0 }", sort = "{ 'fecha': -1 }")
    List<ModeloVersion> notas();
}
