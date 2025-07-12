FROM node:22-alpine AS base
RUN apk add --no-cache git openssh-client curl

FROM base AS backend
WORKDIR /app

# Copy package files
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY backend/ ./
COPY shared/ ./shared/
COPY backend-entrypoint.sh /entrypoint.sh

# Create necessary directories
RUN mkdir -p /projects /app/data && \
    chmod +x /entrypoint.sh

EXPOSE 3005

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
