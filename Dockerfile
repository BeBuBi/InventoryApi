# ============================================================
# Backend — Spring Boot
# Multi-stage build: Gradle build → slim JRE runtime
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM repo.corp.cox.com/cox-csi-docker/csi-amazoncorretto-17:latest AS builder

WORKDIR /app
COPY . /app
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

# ── Stage 2: Runtime ────────────────────────────────────────
FROM nginx:alpine

WORKDIR /app

# Install sqlite for DB inspection / debugging; su-exec for user-switching in entrypoint
RUN apk add --no-cache sqlite su-exec

# Create non-root user
RUN addgroup -S coxapp && adduser -S coxapp -G coxapp

COPY --from=builder --chown=coxapp:coxapp /app/build/libs/*.jar app.jar

# Entrypoint fixes /app/data ownership at runtime (handles volume-mount case)
# then drops privileges to coxapp before starting Java.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# DB stored in /app/data (mount a volume here in production)
ENV DB_PATH=/app/data/inventory.db
ENV APP_CORS_ALLOWED_ORIGINS=http://localhost:4200

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh", "java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
