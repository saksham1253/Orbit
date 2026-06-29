# Production-ready Node.js Docker image for multi-platform deployment
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (--omit=dev; --only=production is deprecated)
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Expose port (overridden by platform-specific PORT env var at runtime)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the server
CMD ["npm", "start"]
