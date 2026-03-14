# ============================================================
# Backend — Spring Boot
# Multi-stage build: Gradle build → slim JRE runtime
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM repo.corp.cox.com/cox-csi-docker/csi-amazoncorretto-21:latest AS builder
USER root
WORKDIR /opt/app/cox
COPY . /opt/app/cox
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
FROM repo.corp.cox.com/cox-csi-docker/csi-amazoncorretto-21:latest
USER root
WORKDIR /opt/app/cox
RUN apk add --no-cache sqlite
COPY --from=builder --chown=coxapp:coxapp /opt/app/cox/build/libs/*.jar /opt/app/cox/app.jar

RUN mkdir -p /opt/app/cox/data /opt/app/cox/logs
RUN chown -R coxapp:coxapp /opt/app/cox /opt/app/cox/data /opt/app/cox/logs

# DB stored in /opt/app/cox/data (mount a volume here in production)
ENV DB_PATH=/opt/app/cox/data/inventory.db
ENV APP_CORS_ALLOWED_ORIGINS=http://localhost:4200

EXPOSE 8080

USER coxapp

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
