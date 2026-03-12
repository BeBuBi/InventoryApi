# ============================================================
# Frontend — Angular 18
# Multi-stage build: Node build → nginx runtime
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM repo.corp.cox.com/cox-csi-docker/csi-nodejs-20:latest AS builder

WORKDIR /app

# Install dependencies (cached unless package files change)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copy source and build for production
COPY . .
RUN npm run build:prod

# ── Stage 2: Runtime ────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built Angular app
COPY --from=builder /app/dist/inventory-app/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
