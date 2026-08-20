# ==========================================
# สเตจที่ 1: Build React Vite SPA (Builder Stage)
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ==========================================
# สเตจที่ 2: รัน Production Web Server (Nginx)
# ==========================================
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
