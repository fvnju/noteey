FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock turbo.json ./

COPY packages/config/package.json packages/config/
COPY packages/config/tsconfig.base.json packages/config/
COPY packages/backend/package.json packages/backend/
COPY packages/backend/convex/ packages/backend/convex/

COPY apps/realtime/package.json apps/realtime/
COPY apps/realtime/src/ apps/realtime/src/

RUN bun install --frozen-lockfile

WORKDIR /app/apps/realtime

ENV NODE_ENV=production

EXPOSE 1235

CMD ["sh", "-c", "exec bun src/server.ts"]
