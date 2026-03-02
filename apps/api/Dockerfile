FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci

# Install Playwright Chromium with dependencies
RUN npx playwright install --with-deps chromium

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build shared package
RUN npm run build -w @threat-guard/shared 2>/dev/null || true

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx src/index.ts"]
