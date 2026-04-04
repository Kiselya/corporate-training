FROM node:20-alpine AS base

WORKDIR /app

# Установка зависимостей
COPY package.json package-lock.json ./
RUN npm ci

# Копирование исходников
COPY . .

# Генерация Prisma клиента
RUN npx prisma generate

# Сборка
RUN npm run build

# Продакшн
EXPOSE 3000
ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.mjs && npm start"]
