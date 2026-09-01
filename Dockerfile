# Multi-stage so the published image carries the built output and production
# dependencies, not the TypeScript toolchain.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY plugin ./plugin
COPY README.md SKILL.md LICENSE ./

# Runs as a non-root user, because this process holds a credential that can
# publish to and delete from a live website.
USER node

# stdio by default, which is what an MCP client launches. Override the command
# with --http to serve it over HTTP, and set WORDPRESS_HTTP_HOST=0.0.0.0 plus
# WORDPRESS_HTTP_TOKEN, since the server refuses to bind off loopback without
# a token.
ENTRYPOINT ["node", "dist/index.js"]
