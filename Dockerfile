FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
COPY schemas ./schemas
COPY specs ./specs
COPY prompts ./prompts
COPY packs ./packs
COPY e2e ./e2e
COPY examples ./examples
COPY sources ./sources
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV CRUX_API_HOST=0.0.0.0
ENV CRUX_API_PORT=4317
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY schemas ./schemas
COPY specs ./specs
COPY prompts ./prompts
COPY packs ./packs
COPY e2e ./e2e
COPY examples ./examples
COPY sources ./sources
RUN useradd --create-home --shell /usr/sbin/nologin crux
RUN mkdir -p runs test-results && chown -R crux:crux /app
USER crux
EXPOSE 4317
CMD ["node", "dist/src/cli.js", "api", "--host", "0.0.0.0", "--port", "4317"]
