FROM node:20-bullseye-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-freefont-ttf \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/ ./packages/
COPY backend/ ./backend/

RUN npm ci
RUN npm run build --workspace=@virtualcoach/shared-types
RUN npm run build --workspace=@virtualcoach/shared-config
RUN npm run build --workspace=@virtualcoach/shared-utils
RUN npm run build --workspace=@virtualcoach/sdk

EXPOSE 3001

CMD ["npm", "run", "dev"]
