FROM node:18-alpine

# Install Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY bridge.ts ./

# Install dependencies
RUN npm install --omit=dev
RUN npm install -D @types/express @types/node puppeteer

# Install TypeScript and compile
RUN npm install -g typescript
RUN tsc --project tsconfig.json

# Start the application
CMD ["node", "bridge.js"]