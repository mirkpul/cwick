FROM node:20-alpine AS builder
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_LOGLEVEL=error

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/ ./packages/
COPY services/ai-core-service/ ./services/ai-core-service/

RUN npm ci
RUN npm run build --workspace=@virtualcoach/shared-types
RUN npm run build --workspace=@virtualcoach/shared-config
RUN npm run build --workspace=@virtualcoach/shared-utils
RUN npm run build --workspace=@virtualcoach/sdk
RUN npm run build --workspace=@virtualcoach/ai-core-service

FROM node:20-alpine
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_LOGLEVEL=error
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/ai-core-service ./services/ai-core-service

RUN npm ci --omit=dev --workspace=@virtualcoach/ai-core-service

EXPOSE 3020

CMD ["node", "services/ai-core-service/dist/index.js"]
