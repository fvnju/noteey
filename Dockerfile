FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y curl python3 make g++ && \
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock turbo.json ./

COPY packages/config/package.json packages/config/
COPY packages/config/tsconfig.base.json packages/config/
COPY packages/env/package.json packages/env/
COPY packages/env/tsconfig.json packages/env/
COPY packages/env/src/ packages/env/src/
COPY packages/backend/package.json packages/backend/
COPY packages/backend/convex/ packages/backend/convex/

COPY apps/realtime/package.json apps/realtime/
COPY apps/realtime/src/ apps/realtime/src/

RUN bun install

WORKDIR /app/apps/realtime

EXPOSE 1235

CMD ["sh", "-c", "exec npx tsx src/server.ts"]

