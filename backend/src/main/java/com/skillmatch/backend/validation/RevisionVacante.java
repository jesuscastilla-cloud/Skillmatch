package com.skillmatch.backend.validation;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lo que una vacante no puede pedir ni traer. Antes solo lo revisaba la página
 * (perfil-empresa.js, revisarVacante): llamando a la API directo se podía publicar
 * una vacante que pidiera edad, sexo o foto, o que nunca cerrara. Las reglas son las
 * mismas de la página, para que el mensaje sea el mismo en los dos lados.
 *
 *  - Sin discriminación (Ley 931 de 2004): edad, sexo o género, estado civil o hijos,
 *    foto o aspecto físico. "3 años de experiencia" no es una edad, "mayor de edad"
 *    sí se puede pedir y "experiencia en fotografía" no es pedir una foto.
 *  - Sin datos de contacto: las personas se postulan y escriben por SkillMatch.
 *  - Fecha de cierre entre hoy y 6 meses.
 */
public final class RevisionVacante {

    /** Lo más que puede estar publicada una vacante, como en la página (MESES_MAXIMOS_VACANTE). */
    public static final int MESES_MAXIMOS = 6;

    private static final int BANDERAS = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE | Pattern.UNICODE_CHARACTER_CLASS;
    private static final String NO_ES_EXPERIENCIA = "(?!\\s+de\\s+(?:experiencia|trabajo|labor|contrato))";
    private static final String EDAD = "(?:1[5-9]|[2-6]\\d)";

    private record Regla(String motivo, List<Pattern> patrones) {
    }

    private static Pattern p(String regex) {
        return Pattern.compile(regex, BANDERAS);
    }

    private static final List<Regla> NO_DISCRIMINACION = List.of(
            new Regla("pide una edad", List.of(
                    p("\\b(?:rango|límite|limite|requisito)\\s+de\\s+edad\\b"),
                    p("\\bedad\\s*(?::|entre\\b|máxima|maxima|mínima|minima|requerida|ideal|de\\s+\\d|\\d)"),
                    p("\\b" + EDAD + "\\s*(?:y|a|-|hasta)\\s*" + EDAD + "\\s*años\\b" + NO_ES_EXPERIENCIA),
                    p("\\b(?:menor(?:es)?|máximo|maximo|no\\s+mayor(?:es)?)\\s+(?:de\\s+)?" + EDAD + "\\s*años\\b" + NO_ES_EXPERIENCIA),
                    // "mayor de 18 años" es lo mismo que "mayor de edad": se permite
                    p("\\bmayor(?:es)?\\s+de\\s+(?:19|[2-6]\\d)\\s*años\\b" + NO_ES_EXPERIENCIA))),
            new Regla("pide un sexo o un género", List.of(
                    p("\\b(?:solo|sólo|únicamente|unicamente|exclusivamente|preferiblemente)\\s+(?:hombres?|mujeres?|varones?|damas?|caballeros?|señoritas?|señoras?)\\b"),
                    p("\\b(?:sexo|género|genero)\\s*[:-]?\\s*(?:masculino|femenino|hombre|mujer)\\b"),
                    p("\\bseñoritas?\\b"))),
            new Regla("pide un estado civil o no tener hijos", List.of(
                    p("\\bestado\\s+civil\\b"),
                    p("\\b(?:solter[oa]s?|casad[oa]s?)\\b"),
                    p("\\bsin\\s+hijos\\b"))),
            new Regla("pide una foto o un aspecto físico", List.of(
                    p("\\b(?:con|enviar|envía|envia|adjuntar|adjunta|anexar|anexa|incluir|incluye)\\s+(?:una\\s+|su\\s+|tu\\s+)?(?:foto|fotografía|fotografia)\\b"),
                    p("\\bfoto\\s+(?:reciente|tipo\\s+documento|de\\s+cuerpo\\s+entero)\\b"),
                    p("\\bbuena\\s+presencia\\b"))));

    private static final List<Pattern> CONTACTO = List.of(
            Pattern.compile("[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+", BANDERAS),
            Pattern.compile("(?:\\+?57[\\s.-]?)?\\b3\\d{2}[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b", BANDERAS),
            Pattern.compile("\\b60\\d[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b", BANDERAS),
            p("\\bwhats?\\s?app\\b|\\bwsp\\b"));

    private RevisionVacante() {
    }

    /**
     * Revisa los textos de la vacante. Devuelve el problema en palabras (el mismo texto
     * que muestra la página) o null si se puede publicar.
     */
    public static String problemasDelTexto(List<String> textos) {
        String todo = String.join("\n", textos.stream().filter(Objects::nonNull).toList());
        List<String> discriminacion = new ArrayList<>();
        for (Regla regla : NO_DISCRIMINACION) {
            for (Pattern patron : regla.patrones()) {
                Matcher m = patron.matcher(todo);
                if (m.find()) {
                    discriminacion.add("«" + m.group().trim() + "» (" + regla.motivo() + ")");
                    break;
                }
            }
        }
        List<String> contacto = new ArrayList<>();
        for (Pattern patron : CONTACTO) {
            Matcher m = patron.matcher(todo);
            if (m.find()) contacto.add("«" + m.group().trim() + "»");
        }

        List<String> problemas = new ArrayList<>();
        if (!discriminacion.isEmpty()) {
            problemas.add("Por ley una vacante no puede pedir edad, sexo, estado civil ni foto (Ley 931 de 2004). Cambia "
                    + String.join("; ", discriminacion)
                    + " por lo que se necesita para el trabajo, como la experiencia o los estudios.");
        }
        if (!contacto.isEmpty()) {
            problemas.add("Quita los datos de contacto: " + String.join(", ", contacto)
                    + ". Las personas se postulan y te escriben por SkillMatch; así su información queda protegida y se evitan estafas.");
        }
        return problemas.isEmpty() ? null : String.join(" ", problemas);
    }

    /** El último momento en que puede cerrar una vacante publicada hoy: el final del día, dentro de 6 meses. */
    public static LocalDateTime cierreMaximo() {
        return LocalDate.now().plusMonths(MESES_MAXIMOS).atTime(LocalTime.MAX);
    }

    /** La fecha de cierre: obligatoria y entre hoy y 6 meses. Devuelve el problema o null. */
    public static String problemaDeCierre(LocalDateTime cierre) {
        if (cierre == null) return "Pon la fecha en que se cierra la vacante.";
        if (cierre.isBefore(LocalDateTime.now())) return "La fecha de cierre ya pasó: pon una fecha de hoy en adelante.";
        if (cierre.isAfter(cierreMaximo())) {
            return "La fecha de cierre puede ser como máximo dentro de " + MESES_MAXIMOS
                    + " meses: una vacante no puede estar publicada más tiempo.";
        }
        return null;
    }
}
