# Use Node.js 22 Alpine for smaller image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files from backend directory
COPY backend/package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code from backend directory
COPY backend/ .

# Build the application
RUN npm run build && \
    echo "Build completed, checking dist folder:" && \
    ls -la dist/

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Expose port
EXPOSE 3001

# Start the application (NestJS compila a dist/src/main.js)
CMD ["node", "dist/src/main.js"]

