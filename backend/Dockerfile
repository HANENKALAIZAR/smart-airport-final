FROM python:3.12-slim

WORKDIR /app

# Install system deps for psycopg2 + curl (healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Production: Gunicorn + Uvicorn workers
# Dev override: docker-compose dev can override CMD with uvicorn --reload
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app.main:app"]
