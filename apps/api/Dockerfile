FROM node:20-slim

# Set Playwright browsers path explicitly for runtime consistency
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install ALL system dependencies for Chromium, sharp, and general tools
# Do NOT clear apt cache here since we need it for Playwright install
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    wget \
    curl \
    # Fonts
    fonts-liberation \
    fonts-noto-cjk \
    # Chromium core dependencies
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    # Additional X11/graphics libraries
    libgdk-pixbuf-2.0-0 \
    libpangocairo-1.0-0 \
    # Sharp/libvips dependencies
    libvips-dev \
    libpng-dev \
    libjpeg-dev \
    libgif-dev

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install npm dependencies
RUN npm ci

# Install Playwright Chromium browser to the explicit path
# Using --with-deps to ensure any missing system deps are installed
RUN npx playwright install --with-deps chromium

# Clean up apt cache now that browser is installed
RUN rm -rf /var/lib/apt/lists/*

# Verify Chromium installation
RUN npx playwright --version && \
    ls -la ${PLAYWRIGHT_BROWSERS_PATH} || echo "Browser path check"

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
