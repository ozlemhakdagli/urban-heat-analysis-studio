# The planner in one self-contained image: built frontend, FastAPI backend,
# processed analytical tables and the trained XGBoost model.
#
#   docker compose up --build
#   (or: docker build -t urban-green-planner . && docker run --rm -p 8000:8000 urban-green-planner)

# ---- stage 1: build the front end (needs Node)
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- stage 2: the back end (needs Python only)
FROM python:3.12-slim

# Copy high-speed parallel installer uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# libgomp1: the xgboost wheel uses OpenMP
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV UV_DEFAULT_INDEX=https://mirrors.aliyun.com/pypi/simple/
RUN uv pip install --system \
    "fastapi>=0.143" "uvicorn[standard]>=0.30" "numpy>=2.0" "pandas>=2.2" \
    "scikit-learn>=1.6" "geopandas>=1.0" "pyogrio>=0.10" "httpx>=0.27" "pyyaml>=6.0" "openai>=1.50" && \
    uv pip install --system --no-deps "xgboost>=3.4"
COPY backend/ backend/
COPY --from=frontend /build/dist frontend/dist
COPY data/ /app/data/
RUN if [ -f /app/data/data_package.zip ] && [ ! -d /app/data/processed ]; then \
        python -m zipfile -e /app/data/data_package.zip /app/data/ ; \
    fi
ENV PLANNER_DATA=/app/data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
