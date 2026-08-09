FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Ensure scripts are executable
RUN chmod +x start_api.sh start_worker.sh

# Note: We don't specify CMD here because this Dockerfile is used 
# for both the API (start_api.sh) and the Celery worker (start_worker.sh).
# The deployment platform (Koyeb/Render) will override the run command.
