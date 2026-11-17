package com.skillmatch.backend.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.bson.Document;

import com.skillmatch.backend.model.CorreoPendiente;

/** La cola de correos con todo guardado en memoria: para probar las reglas sin MongoDB. */
class ColaEnMemoria extends ColaCorreoService {

    int enviados;
    int descartados;
    final List<CorreoPendiente> cola = new ArrayList<>();

    ColaEnMemoria(CorreoService correo, int tope) {
        super(correo, null, tope);
    }

    @Override boolean tomarCupo(Prioridad p) {
        if (enviados + 1 > limite(p)) return false;
        enviados++;
        return true;
    }
    @Override void devolverCupo() { enviados--; }
    @Override void contarDescartado() { descartados++; }
    @Override Document contadorDeHoy() { return new Document("enviados", enviados).append("descartados", descartados); }
    @Override void encolar(String para, String asunto, String texto, Prioridad prioridad, Duration vigencia, int intentos) {
        CorreoPendiente p = new CorreoPendiente();
        p.setId("p" + cola.size() + "-" + System.nanoTime());
        p.setPara(para); p.setAsunto(asunto); p.setTexto(texto);
        p.setPrioridad(prioridad.name()); p.setOrden(prioridad.orden); p.setIntentos(intentos);
        p.setCreatedAt(LocalDateTime.now()); p.setVence(LocalDateTime.now().plus(vigencia));
        cola.add(p);
    }
    @Override List<CorreoPendiente> siguientes(int n) {
        return cola.stream().sorted(Comparator.comparingInt(CorreoPendiente::getOrden).thenComparing(CorreoPendiente::getCreatedAt)).limit(n).toList();
    }
    @Override void quitar(CorreoPendiente p) { cola.removeIf(x -> x.getId().equals(p.getId())); }
    @Override void actualizar(CorreoPendiente p) { }
    @Override long contarPendientes() { return cola.size(); }

    /** Como si pasara la medianoche: el contador del dia vuelve a cero. */
    void nuevoDia() { enviados = 0; }
}
