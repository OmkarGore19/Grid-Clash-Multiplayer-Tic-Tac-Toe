# Use an official lightweight Node.js runtime
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies (clean and deterministic)
RUN npm ci --omit=dev

# Copy application source code with proper ownership
COPY . .

# Expose application port
EXPOSE 3000

# Start the application
CMD ["npm","start"]