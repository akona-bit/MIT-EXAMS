#!/bin/bash

# Start Celery worker
echo "Starting Celery worker..."
celery -A app.worker.celery_app worker --loglevel=info
