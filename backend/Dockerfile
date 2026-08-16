# Debian, not Alpine — deliberately.
#
# prisma/schema.prisma declares binaryTargets = ["native", "windows",
# "debian-openssl-3.0.x"]. Alpine is musl and would need
# "linux-musl-openssl-3.0.x" added, otherwise every query fails at runtime with
# "could not locate the Query Engine". node:20-slim is bookworm/OpenSSL 3.0,
# which the existing target already matches.
FROM node:20-slim AS base
# Prisma's engine links against libssl; ca-certificates is needed for outbound
# HTTPS (S3/R2 uploads and the transactional-mail API).
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# ── deps + client generation ─────────────────────────────────────────────────
FROM base AS build
# Dev dependencies are needed here: the prisma CLI that runs `generate` is one.
ENV NODE_ENV=development
# puppeteer is a devDependency (a local scraping script uses it, the API never
# does), but `npm ci` still runs its postinstall, which downloads ~150MB of
# Chromium and then fails because this image has no unzip. Nothing in the build
# needs a browser, so skip it rather than installing unzip for a binary that
# gets pruned two layers later.
ENV PUPPETEER_SKIP_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
# Drop dev dependencies now that the client is generated. The generated client
# under node_modules/.prisma survives the prune.
RUN npm prune --omit=dev

# ── runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime

# Never run as root. node:20-slim ships a `node` user for exactly this.
COPY --from=build --chown=node:node /app /app

# Local-disk fallback for uploads when S3 is not configured. Mount a volume here
# if you rely on it — otherwise every deploy loses previously uploaded files,
# which is why configuring S3/R2 is the recommendation.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 4000

# /api/health returns 503 when Postgres is unreachable, so this is a real
# readiness probe rather than a liveness-only ping.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations are NOT run here. Running them on container start means N instances
# race the same migration, and a bad migration takes down the rollout instead of
# failing one deploy step. Run `npx prisma migrate deploy` as a release step.
CMD ["npm", "start"]
