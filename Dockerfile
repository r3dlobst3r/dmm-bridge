FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY bridge.ts ./

# Install dependencies (production only)
RUN npm install --omit=dev

# Install TypeScript globally and compile
RUN npm install -g typescript
RUN tsc --project tsconfig.json

# Start the application
CMD ["node", "bridge.js"]