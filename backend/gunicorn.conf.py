"""
Gunicorn Production Configuration
==================================
Run with:
    gunicorn -c gunicorn.conf.py app.main:app

Requires: gunicorn + uvicorn workers
    pip install gunicorn uvicorn[standard]
"""

import multiprocessing
import os

# ── Worker Config ─────────────────────────────────────────────────────────
# Uvicorn async workers — required for FastAPI (ASGI)
worker_class = "uvicorn.workers.UvicornWorker"

# Recommended: (2 × CPU cores) + 1
workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))

# Graceful timeout for ASGI apps (ms)
worker_connections = 1000
timeout = 120
keepalive = 5
graceful_timeout = 30

# ── Binding ───────────────────────────────────────────────────────────────
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# ── Logging ───────────────────────────────────────────────────────────────
# Use JSON-structured logging (configured inside app/main.py)
accesslog = "-"   # stdout — captured by Docker / log aggregator
errorlog  = "-"   # stderr
loglevel  = os.getenv("LOG_LEVEL", "info")
access_log_format = (
    '{"time":"%(t)s","method":"%(m)s","url":"%(U)s",'
    '"status":%(s)s,"size":%(b)s,"duration":%(D)s}'
)

# ── Process ───────────────────────────────────────────────────────────────
preload_app = True   # Load application before forking — saves memory

# ── Hooks ─────────────────────────────────────────────────────────────────
def on_starting(server):
    server.log.info("Gunicorn starting — Smart Airport API")

def worker_exit(server, worker):
    server.log.info(f"Worker {worker.pid} exited")
