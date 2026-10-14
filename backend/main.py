"""FastAPI backend of the urban green planner.

Run from the project root (conda env urban-green-planner):
    uvicorn backend.main:app --port 8000
The model and the risk calculations run inside this process from the processed data and the model files (no result files are read); the React app in frontend/dist is served from the same address when it is built.
"""
import logging
import math
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

from .planner.service import NoResult, Planner

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("PLANNER_DATA", ROOT / "data"))
log = logging.getLogger("planner")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.planner = Planner(DATA_DIR)
    yield


app = FastAPI(title="Urban Green Planner", version="1.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])


def planner() -> Planner:
    return app.state.planner


def _etag_matches(header: str | None, etag: str) -> bool:
    """True when the client's If-None-Match covers the current map file: a list, the star form and weak tags all count."""
    if not header:
        return False
    return any(part.strip() == "*" or part.strip().removeprefix("W/") == etag for part in header.split(","))


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    """Log the full error and answer with the same clean JSON shape the other errors use."""
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": {"code": "internal_error"}})


class WhatIfRequest(BaseModel):
    district_code: int
    amount: float  # area of green added (negative = green lost)
    unit: Literal["m2", "ha", "km2"] = "m2"
    cooling: float = 1.0  # the wanted cooling in °C for the heat-target answer

    @field_validator("amount")
    @classmethod
    def finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("amount must be a finite number")
        return value

    @field_validator("cooling")
    @classmethod
    def sensible(cls, value: float) -> float:
        if not 0.1 <= value <= 5:
            raise ValueError("cooling must be between 0.1 and 5 °C")
        return value


def _district_or_404(call, *args):
    try:
        return call(*args)
    except NoResult as error:
        raise HTTPException(404, detail={"code": "no_result", "reason": error.reason})
    except KeyError:
        raise HTTPException(404, detail={"code": "unknown_district"})


@app.get("/api/health")
def health():
    p = planner()
    return {"status": "ok", "districts_with_result": len(p.base), "algorithm": p.card["algorithm"], "range_available": p.engine.range_low is not None,
            "startup_seconds": round(p.startup_seconds, 1)}


@app.get("/api/meta")
def meta():
    return planner().meta()


@app.get("/api/district/{code}")
def district(code: int):
    return _district_or_404(planner().district, code)


@app.post("/api/whatif")
def what_if(request: WhatIfRequest):
    return _district_or_404(planner().what_if, request.district_code, request.amount, request.unit, request.cooling)


@app.get("/api/top-risk")
def top_risk(n: int = 20):
    return planner().top_risk(max(1, min(n, 100)))


@app.get("/api/geo/overview")
def geo_overview(request: Request):
    """The simplified outlines of all districts. With an ETag: an unchanged file answers 304 and is not sent again."""
    p = planner()
    headers = {"ETag": p.overview_etag, "Cache-Control": "public, max-age=3600"}
    if _etag_matches(request.headers.get("if-none-match"), p.overview_etag):
        return Response(status_code=304, headers=headers)
    return Response(p.overview_geojson(), media_type="application/geo+json", headers=headers)


@app.get("/api/geo/district/{code}")
def geo_district(code: int):
    try:
        return Response(planner().district_geojson(code), media_type="application/geo+json")
    except KeyError:
        raise HTTPException(404, detail={"code": "unknown_district"})


DIST = ROOT / "frontend" / "dist"
if DIST.exists():  # the built React app, served by the same process
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
