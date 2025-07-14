FROM node:22-alpine
RUN apk add --no-cache python3 make g++ git bash curl

WORKDIR /app

# Copy package files
COPY shelltender/package*.json ./
# Install all dependencies including dev to build native modules
RUN npm install

# Copy application code
COPY shelltender/ ./

# Fix node-pty module resolution issue
# Create symlink for modules that might be looking in wrong path
RUN mkdir -p /app/server && ln -s /app/node_modules /app/server/node_modules

EXPOSE 8080

CMD ["node", "shelltender-service.js"]
