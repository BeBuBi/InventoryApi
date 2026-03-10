# ============================================================
# Backend — Spring Boot
# Multi-stage build: Gradle build → slim JRE runtime
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /app

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
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Install sqlite for DB inspection / debugging
RUN apk add --no-cache sqlite

# Create non-root user
RUN addgroup -S coxapp && adduser -S coxapp -G coxapp

# Create data and logs directories owned by app user
RUN mkdir -p data logs && chown -R coxapp:coxapp /app

COPY --from=builder --chown=coxapp:coxapp /app/build/libs/*.jar app.jar

USER coxapp

# DB stored in /app/data (mount a volume here in production)
ENV DB_PATH=/app/data/inventory.db
ENV APP_CORS_ALLOWED_ORIGINS=http://localhost:4200

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
