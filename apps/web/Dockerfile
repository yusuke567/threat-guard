FROM node:20-slim AS base

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm ci --workspace=@brand-shield/shared --workspace=@brand-shield/web --include-workspace-root

RUN npm run build -w @brand-shield/shared

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @brand-shield/web

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
