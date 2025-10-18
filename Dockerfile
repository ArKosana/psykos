FROM node:18-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./server/
COPY server/server.js ./server/
COPY server/ai/ ./server/ai/

# Install server dependencies
WORKDIR /app/server
RUN npm install --production

# Expose port
EXPOSE 5174

# Start the server
CMD ["npm", "start"]
