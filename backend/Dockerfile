# ==========================================================
#  SkillMatch - Solo el backend (API).
#  Usalo si vas a desplegar el frontend aparte (Netlify, Vercel...).
#  Si quieres API + frontend juntos, usa el Dockerfile de la raiz.
#
#  El contexto de build es la carpeta backend/.
# ==========================================================

FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./pom.xml
RUN mvn -B -q dependency:go-offline || true
COPY src ./src
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /build/target/*.jar app.jar
RUN chown app:app app.jar
USER app

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC"
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q --spider "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
