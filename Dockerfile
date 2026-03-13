# ============================================================
# Backend — Spring Boot
# Multi-stage build: Gradle build → slim JRE runtime
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM repo.corp.cox.com/cox-csi-docker/csi-amazoncorretto-17:latest AS builder
USER root
WORKDIR /opt/cox
COPY . /opt/cox
# Copy Gradle wrapper and dependency descriptors first (layer cache)
COPY gradlew .
RUN chmod +x gradlew
COPY gradle/ gradle/
COPY build.gradle settings.gradle ./

# Download dependencies (cached unless build files change)
RUN ./gradlew dependencies --no-daemon -q || true

# Copy source and build
COPY src/ src/
RUN ./gradlew bootJar --no-daemon -x test

# ── Stage 2: Execution ──────────────────────────────────────────
FROM repo.corp.cox.com/cox-csi-docker/csi-amazoncorretto-17:latest
USER root
RUN apk add --no-cache sqlite
COPY --from=builder --chown=coxapp:coxapp /opt/cox/build/libs/*.jar app.jar

# Entrypoint fixes /app/data ownership at runtime (handles volume-mount case)
# then drops privileges to coxapp before starting Java.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data /app/logs
RUN chown -R coxapp:coxapp /app/data /app/logs

# DB stored in /app/data (mount a volume here in production)
ENV DB_PATH=/app/data/inventory.db
ENV APP_CORS_ALLOWED_ORIGINS=http://localhost:4200

EXPOSE 8080

USER coxapp

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
