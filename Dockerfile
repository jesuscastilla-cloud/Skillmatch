# ==========================================================
#  SkillMatch - Imagen unica: API + frontend en un solo deploy
#
#  Construir:  docker build -t skillmatch .
#  Probar:     docker run -p 8080:8080 \
#                -e MONGODB_URI="mongodb+srv://..." \
#                -e JWT_SECRET="cadena-de-al-menos-32-caracteres" \
#                skillmatch
#
#  El contexto de build es la RAIZ del repositorio.
# ==========================================================

# ---------- Etapa 1: compilar ----------
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /build

# Primero solo el pom: si no cambian las dependencias, Docker reutiliza
# esta capa y el build tarda segundos en vez de minutos.
COPY backend/pom.xml ./pom.xml
RUN mvn -B -q dependency:go-offline || true

# Codigo del backend
COPY backend/src ./src

# El frontend viaja dentro del jar: Spring Boot sirve /static en la raiz.
# Asi no hay CORS, ni dos despliegues, ni URLs que configurar.
COPY SkillMatch/src ./src/main/resources/static

RUN mvn -B clean package -DskipTests

# ---------- Etapa 2: ejecutar ----------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Usuario sin privilegios
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /build/target/*.jar app.jar
RUN chown app:app app.jar
USER app

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC -Djava.security.egd=file:/dev/./urandom"
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q --spider "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
