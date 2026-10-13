FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
# CA opcional para redes con inspección TLS (ver README). No queda en la imagen.
RUN --mount=type=secret,id=npm_ca,required=false \
  if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
  if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
  && npm cache clean --force

COPY src ./src
COPY public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/ready || exit 1

CMD ["node", "src/server.js"]
