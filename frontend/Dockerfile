# Builds the SPA and bakes it into an nginx image.
#
# Alpine is fine here — unlike the backend, nothing in this image links against
# Prisma's engines, so the musl/glibc distinction does not apply.
#
# IMPORTANT: the build context is the REPO ROOT, not frontend/, because the
# nginx config lives in deploy/ and Docker cannot COPY from outside its context.
# docker-compose.prod.yml sets `context: .` with `dockerfile: frontend/Dockerfile`.
# To build by hand, from the repo root:
#     docker build -f frontend/Dockerfile -t nv-web .
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
# `npm ci` inside Linux resolves the linux rollup/esbuild binaries regardless of
# what a developer has in their local node_modules — which is exactly the
# platform mismatch that breaks a dist built on Windows and copied in.
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
# Included by every location block in nginx.conf. See the comment at the top of
# the snippet for why these cannot simply be set once at the server level.
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 80 443
