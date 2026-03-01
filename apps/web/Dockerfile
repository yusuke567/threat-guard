FROM node:20-slim AS base

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm ci --workspace=@threat-guard/shared --workspace=@threat-guard/web --include-workspace-root

RUN npm run build -w @threat-guard/shared

RUN npm run build -w @threat-guard/web

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
