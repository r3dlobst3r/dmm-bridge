FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY bridge.ts ./

# Install dependencies including necessary type definitions
RUN npm install --omit=dev
RUN npm install -D @types/express @types/node

# Install TypeScript globally and compile
RUN npm install -g typescript
RUN tsc --project tsconfig.json

# Clean up dev dependencies after compilation
RUN npm prune --omit=dev

# Start the application
CMD ["node", "bridge.js"]