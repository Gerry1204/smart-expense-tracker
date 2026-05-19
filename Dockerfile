# ========================================================
# Stage 1: Build the React (Vite) Frontend
# ========================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package config first to leverage Docker layer caching
COPY frontend/package*.json ./
RUN npm install --no-fund --no-audit

# Copy the rest of the frontend source code and build it
COPY frontend/ ./
RUN npm run build

# ========================================================
# Stage 2: Create the Python/FastAPI Runner
# ========================================================
FROM python:3.11-slim
WORKDIR /app

# Install standard build dependencies (required for compiling bcrypt if no pre-built wheel is found)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install them
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy the built frontend static files from Stage 1 into the location FastAPI expects
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the default FastAPI port (Render will override the PORT environment variable)
ENV PORT=8000
EXPOSE $PORT

# Change working directory to backend to launch the app
WORKDIR /app/backend

# Run FastAPI using uvicorn, dynamically binding to the port assigned by Render
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
