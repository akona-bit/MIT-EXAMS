#!/bin/bash

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Start FastAPI application
echo "Starting FastAPI server..."
# PORT is typically provided by the hosting platform (e.g., Koyeb, Render, Heroku)
PORT=${PORT:-8000}
uvicorn app.main:app --host 0.0.0.0 --port $PORT
