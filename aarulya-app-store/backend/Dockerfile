FROM node:22-bookworm-slim AS dependencies
WORKDIR /app/backend
COPY backend/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
RUN groupadd --system --gid 10001 aarulya \
 && useradd --system --uid 10001 --gid aarulya --home-dir /nonexistent --shell /usr/sbin/nologin aarulya
COPY --from=dependencies --chown=10001:10001 /app/backend/node_modules ./node_modules
COPY --chown=10001:10001 backend/package.json ./package.json
COPY --chown=10001:10001 backend/src ./src
COPY --chown=10001:10001 backend/sql ./sql
COPY --chown=10001:10001 src ../src
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["node"]
CMD ["src/server.js"]
