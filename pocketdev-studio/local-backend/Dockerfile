FROM node:18-alpine

# Install Docker CLI for container management
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server.js"]