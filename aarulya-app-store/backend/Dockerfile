FROM node:22.23.2-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS dependencies
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

FROM node:22.23.2-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS runtime
ARG SOURCE_SHA=unknown
LABEL org.opencontainers.image.title="Aarulya Store Backend" \
      org.opencontainers.image.revision="${SOURCE_SHA}"
ENV NODE_ENV=production
WORKDIR /app/backend
RUN groupadd --system --gid 10001 aarulya \
 && useradd --system --uid 10001 --gid aarulya --home-dir /nonexistent --shell /usr/sbin/nologin aarulya
COPY --from=dependencies --chown=10001:10001 /app/backend/node_modules ./node_modules
COPY --chown=10001:10001 backend/package.json backend/package-lock.json ./
COPY --chown=10001:10001 backend/src ./src
COPY --chown=10001:10001 backend/sql ./sql
COPY --chown=10001:10001 src ../src
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["node"]
CMD ["src/server.js"]
