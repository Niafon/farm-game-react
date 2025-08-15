FROM node:20-alpine AS base
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src

EXPOSE 8899
CMD ["node", "src/index.js"]


