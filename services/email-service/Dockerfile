FROM node:20-alpine AS builder
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_LOGLEVEL=error
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/ ./packages/
COPY services/email-service/ ./services/email-service/
RUN npm ci
RUN npm run build --workspace=@virtualcoach/shared-types
RUN npm run build --workspace=@virtualcoach/shared-config
RUN npm run build --workspace=@virtualcoach/sdk
RUN npm run build --workspace=@virtualcoach/email-service

FROM node:20-alpine
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_LOGLEVEL=error
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/email-service ./services/email-service
RUN npm ci --omit=dev --workspace=@virtualcoach/email-service
ENV NODE_ENV=production
ENV PORT=3017
EXPOSE 3017
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3017/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "services/email-service/dist/index.js"]
