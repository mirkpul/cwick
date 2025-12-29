FROM node:20-bullseye-slim

# Puppeteer configuration for web scraping
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-freefont-ttf \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json ./

# Copy backend source
COPY backend/ ./backend/

# Install all dependencies (includes backend workspace)
RUN npm ci

# Build TypeScript
RUN npm run build --workspace=backend

EXPOSE 3001

# Development mode
CMD ["npm", "run", "dev", "--workspace=backend"]
