FROM node:22-alpine
RUN apk add --no-cache python3 make g++ git bash curl

WORKDIR /app

# Copy package files
COPY shelltender/package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY shelltender/ ./

EXPOSE 8080

CMD ["node", "shelltender-service.js"]
