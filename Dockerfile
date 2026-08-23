FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

RUN addgroup -S sync && adduser -S sync -G sync \
  && mkdir -p /data && chown sync:sync /data
USER sync

ENTRYPOINT ["node", "dist/index.js"]
CMD ["start"]
