FROM node:20-slim AS base

# Install dependencies for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    fonts-noto-cjk fonts-noto-color-emoji \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json tsconfig.json ./

# Copy workspace packages
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install all dependencies
RUN npm ci --workspace=@brand-shield/shared --workspace=@brand-shield/api --include-workspace-root

# Install Playwright Chromium
RUN npx playwright install chromium

# Build shared package first, then API
RUN npm run build -w @brand-shield/shared
RUN npm run build -w @brand-shield/api

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

WORKDIR /app/apps/api

EXPOSE 3001

# Run migrations then start
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --accept-data-loss && node dist/index.js"]
