FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by OpenCV (cv2) and other packages
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Ensure python can find modules
ENV PYTHONPATH=/app

# Default command for API
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
