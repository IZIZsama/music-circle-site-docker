FROM node:20-alpine

WORKDIR /app/server

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npm run db:seed; npm run dev"]
