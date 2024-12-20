FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY bridge.ts ./

RUN npm install

# Compile TypeScript
RUN npm install -g typescript
RUN tsc bridge.ts

# Start the application
CMD ["node", "bridge.js"]