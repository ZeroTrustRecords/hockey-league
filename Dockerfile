FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:20-bookworm-slim AS backend-deps
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV APP_STARTUP_MODE=persistent
ENV HOCKEY_DB_PATH=/data/hockey_league.db
ENV LOG_DIR=/data/logs
ENV BACKUP_DIR=/data/backups

COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /data/logs /data/backups /app/backend/uploads \
  && chown -R node:node /app /data

USER node

EXPOSE 3001

CMD ["node", "backend/server.js"]
