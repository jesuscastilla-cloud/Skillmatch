package com.skillmatch.backend.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Los datos para cobrar los planes, que escribe un administrador desde la pagina de administracion.
 * Hay un solo documento (id "comercial"). Nada de esto se escribe en el codigo: mientras no se
 * llenen, la empresa solo puede "Solicitar activacion" y el equipo la contacta.
 */
@Document(collection = "configuracion")
@Data
@NoArgsConstructor
public class ConfiguracionComercial {

    public static final String ID = "comercial";

    @Id
    private String id = ID;

    private String razonSocial;
    private String nit;
    private String banco;
    private String tipoCuenta;
    private String numeroCuenta;
    private String titular;
    /** A donde la empresa envia el comprobante */
    private String correoPagos;
    private String telefonoPagos;
    private String instrucciones;

    private LocalDateTime actualizado;
    private String actualizadoPor;

    /** Hay datos suficientes para pagar por transferencia */
    public boolean transferenciaLista() {
        return lleno(banco) && lleno(numeroCuenta) && lleno(titular) && lleno(correoPagos);
    }

    private static boolean lleno(String s) { return s != null && !s.isBlank(); }
}
