"""
SkillMatch - modelo predictivo
Paso 1: de una postulacion respondida a una fila de la "tabla de ejemplos".

Este archivo es el UNICO lugar donde se decide que mira el modelo (la tabla
"Que mira de SkillMatch" del PDF). Lo usan los dos scripts de esta carpeta:
  - exportar_desde_mongo.py   (datos reales de la plataforma)
  - generar_datos_semilla.py  (los datos por defecto del DataSeeder.java)

Lo que NUNCA se mira (ni siquiera se copia a la tabla): nombre, correo,
telefono, foto, edad, sexo, ni que empresa es (Ley 931, ver el PDF).
"""

from datetime import datetime

# Nivel de dominio de una habilidad (el mismo texto que guarda el perfil)
NIVELES = {"BASICO": 1, "BÁSICO": 1, "INTERMEDIO": 2, "AVANZADO": 3, "EXPERTO": 4}

# Anos minimos que pide cada nivel de experiencia de la vacante
# (los textos son los de oportunidades.js: translateExperienceLevel)
#   sin-experiencia -> "Sin experiencia"            -> 0
#   junior          -> "Hasta 1 ano de experiencia" -> 0 (cualquiera alcanza)
#   semi-senior     -> "1 a 3 anos"                  -> 1
#   senior          -> "Mas de 3 anos"               -> 3
ANOS_QUE_PIDE = {"sin-experiencia": 0, "junior": 0, "semi-senior": 1, "senior": 3}

TIPOS = ["empleo", "práctica", "freelance"]

# Columnas de la tabla, en orden. La ultima es la respuesta de la empresa.
COLUMNAS = [
    "pct_habilidades",       # cuantas de las habilidades pedidas tiene (0 a 100)
    "nivel_dominio",         # que tan bien las domina (0 ninguna, 1 basico ... 4 experto)
    "anos_experiencia",      # anos de experiencia registrados
    "alcanza_experiencia",   # 1 si alcanzan lo que pide la vacante
    "num_estudios",          # cuantos estudios registro
    "perfil_completo",       # que tan completo esta su perfil (0 a 100)
    "tiene_carta",           # 1 si escribio carta
    "palabras_carta",        # que tan larga
    "misma_ciudad",          # 1 si vive en la ciudad de la vacante o es remota
    "tipo_empleo",           # tipo de vacante (una columna por tipo)
    "tipo_practica",
    "tipo_freelance",
    "dias_para_postularse",  # que tan rapido se postulo
    "postulantes_previos",   # cuantas personas ya se habian postulado ANTES que ella
    "vacante",               # numero de la vacante: solo arma el examen por vacante (no lo usa el modelo)
    "es_ejemplo",            # 1 si es una empresa/vacante "(ejemplo)" (no lo usa el modelo)
    "aceptada",              # RESPUESTA: 1 aceptada, 0 rechazada
]


def _texto(x):
    return (x or "").strip()


def _sin_tildes(s):
    return (s.upper().replace("Á", "A").replace("É", "E").replace("Í", "I")
            .replace("Ó", "O").replace("Ú", "U"))


def _fecha(x):
    if x is None:
        return None
    if isinstance(x, datetime):
        return x.replace(tzinfo=None)
    try:
        return datetime.fromisoformat(str(x).replace("Z", "")).replace(tzinfo=None)
    except ValueError:
        return None


def anos_de_experiencia(experiencias, hoy=None):
    """Suma la duracion de cada experiencia (las actuales cuentan hasta hoy)."""
    hoy = hoy or datetime.now()
    total_dias = 0
    for e in experiencias or []:
        inicio = _fecha(e.get("startDate"))
        if not inicio:
            continue
        fin = hoy if e.get("isCurrent") else (_fecha(e.get("endDate")) or hoy)
        total_dias += max(0, (fin - inicio).days)
    return round(total_dias / 365.0, 1)


def perfil_completo(usuario):
    """Los mismos 5 puntos que cuenta profile.js (profileChecks)."""
    puntos = [
        bool(usuario.get("firstName") and usuario.get("lastName") and usuario.get("email")),
        bool(usuario.get("phone")),
        bool(usuario.get("skills")),
        bool(usuario.get("experiences")),
        bool(usuario.get("educations")),
    ]
    return int(100 * sum(puntos) / len(puntos) + 0.5)


def fecha_de_postulacion(postulacion):
    """Cuando se postulo (la fecha de la postulacion o, si falta, cuando se creo)."""
    return _fecha(postulacion.get("appliedDate")) or _fecha(postulacion.get("createdAt"))


def postulantes_previos(postulaciones, clave_vacante):
    """
    Para cada postulacion (en el mismo orden), cuantas personas se habian postulado a esa
    misma vacante ANTES que ella. No se cuentan las que llegaron despues: eso es informacion
    del futuro que el modelo no tendria al momento de postularse (fuga de datos).
    """
    fechas = {}
    for a in postulaciones:
        f = fecha_de_postulacion(a)
        if f:
            fechas.setdefault(clave_vacante(a), []).append(f)
    salida = []
    for a in postulaciones:
        f = fecha_de_postulacion(a)
        salida.append(sum(1 for otra in fechas.get(clave_vacante(a), []) if f and otra < f))
    return salida


def fila(postulacion, usuario, vacante, empresa_nombre, postulantes_previos, numero_vacante, hoy=None):
    """Devuelve el diccionario de una fila, o None si la postulacion no tiene respuesta."""
    estado = _texto(str(postulacion.get("status"))).upper()
    if estado not in ("ACEPTADA", "RECHAZADA"):
        return None  # PENDIENTE y REVISADA todavia no tienen respuesta: no son ejemplos

    # 1) Habilidades: cuantas de las que pide la vacante tiene, y su nivel
    pedidas = {_texto(h).lower() for h in (vacante.get("skills") or []) if _texto(h)}
    suyas = {}
    for h in usuario.get("skills") or []:
        nombre = _texto(h.get("name")).lower()
        if nombre:
            suyas[nombre] = NIVELES.get(_sin_tildes(_texto(h.get("level"))), 1)
    coinciden = [suyas[h] for h in pedidas if h in suyas]
    # medio para arriba, igual que Math.round de JavaScript (round() de Python redondea al par)
    pct = int(100 * len(coinciden) / len(pedidas) + 0.5) if pedidas else 0
    nivel = round(sum(coinciden) / len(coinciden), 2) if coinciden else 0

    # 2) Experiencia y si alcanza lo que pide la vacante
    anos = anos_de_experiencia(usuario.get("experiences"), hoy)
    minimo = ANOS_QUE_PIDE.get(_texto(vacante.get("experienceLevel")), 0)

    # 3) Carta
    carta = _texto(postulacion.get("coverLetter"))
    palabras = len(carta.split()) if carta else 0

    # 4) Ciudad (o remota)
    ciudad_u = _texto(usuario.get("location")).lower()
    ciudad_v = _texto(vacante.get("location")).lower()
    remota = _texto(vacante.get("modality")).lower() == "remoto"
    misma = 1 if remota or (ciudad_u and ciudad_v and (ciudad_u in ciudad_v or ciudad_v in ciudad_u)) else 0

    # 5) Rapidez: dias entre la publicacion y la postulacion
    publicada = _fecha(vacante.get("postedDate")) or _fecha(vacante.get("createdAt"))
    postulo = _fecha(postulacion.get("appliedDate")) or _fecha(postulacion.get("createdAt"))
    dias = max(0, (postulo - publicada).days) if publicada and postulo else 0

    tipo = _texto(vacante.get("type")).lower()
    es_ejemplo = ("(ejemplo)" in (empresa_nombre or "").lower()
                  or _texto(usuario.get("email")).lower().endswith("@skillmatch.test"))

    return {
        "pct_habilidades": pct,
        "nivel_dominio": nivel,
        "anos_experiencia": anos,
        "alcanza_experiencia": 1 if anos >= minimo else 0,
        "num_estudios": len(usuario.get("educations") or []),
        "perfil_completo": perfil_completo(usuario),
        "tiene_carta": 1 if palabras > 0 else 0,
        "palabras_carta": palabras,
        "misma_ciudad": misma,
        "tipo_empleo": 1 if tipo == "empleo" else 0,
        "tipo_practica": 1 if tipo in ("práctica", "practica") else 0,
        "tipo_freelance": 1 if tipo in ("freelance", "independiente") else 0,
        "dias_para_postularse": dias,
        "postulantes_previos": int(postulantes_previos),
        "vacante": int(numero_vacante),
        "es_ejemplo": 1 if es_ejemplo else 0,
        "aceptada": 1 if estado == "ACEPTADA" else 0,
    }
