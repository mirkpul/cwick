FROM node:20-slim AS builder
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_LOGLEVEL=error
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/ ./packages/
COPY services/web-scraping-service/ ./services/web-scraping-service/
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci
RUN npm run build --workspace=@virtualcoach/shared-types
RUN npm run build --workspace=@virtualcoach/shared-config
RUN npm run build --workspace=@virtualcoach/web-scraping-service

FROM node:20-slim
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_LOGLEVEL=error
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/web-scraping-service ./services/web-scraping-service
RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/* \
    && npm ci --omit=dev --workspace=@virtualcoach/web-scraping-service
ENV NODE_ENV=production
ENV PORT=3013
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
EXPOSE 3013
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3013/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "services/web-scraping-service/dist/index.js"]
