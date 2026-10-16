"""LLM Decision Support module for urban green planning interpretation.

Provides prompt formatting, mtime-cached YAML configuration, environment-driven settings,
and async SSE streaming from any OpenAI-compatible API (e.g. LM Studio, Ollama, vLLM).
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
from typing import Any

from openai import AsyncOpenAI
import yaml

PROMPTS_PATH = Path(__file__).resolve().parent.parent / "prompts" / "interpretation.yaml"
_prompt_cache: tuple[float, dict[str, Any]] | None = None


@dataclass
class LLMSettings:
    base_url: str = field(default_factory=lambda: os.environ.get("LLM_BASE_URL", "http://127.0.0.1:1234/v1"))
    model: str = field(default_factory=lambda: os.environ.get("LLM_MODEL", "gemma-4-26b-a4b-it-qat"))
    api_key: str = field(default_factory=lambda: os.environ.get("LLM_API_KEY", "not-needed"))
    timeout: float = field(default_factory=lambda: float(os.environ.get("LLM_TIMEOUT", "120.0")))
    temperature: float = field(default_factory=lambda: float(os.environ.get("LLM_TEMPERATURE", "0.3")))
    max_tokens: int = field(default_factory=lambda: int(os.environ.get("LLM_MAX_TOKENS", "2500")))


def get_llm_settings() -> LLMSettings:
    return LLMSettings()


class _SafeDict(dict):
    """Fallback for missing dictionary keys during template interpolation."""

    def __missing__(self, key: str) -> str:
        return f"{{{key}}}"


def _load_prompt_config() -> dict[str, Any]:
    """Load and cache interpretation.yaml, automatically reloading if modified on disk."""
    global _prompt_cache
    mtime = PROMPTS_PATH.stat().st_mtime
    if _prompt_cache is None or _prompt_cache[0] != mtime:
        with open(PROMPTS_PATH, encoding="utf-8") as f:
            _prompt_cache = (mtime, yaml.safe_load(f) or {})
    return _prompt_cache[1]


def build_prompt_data(d_info: dict[str, Any], whatif_res: dict[str, Any], lang: str = "en") -> dict[str, Any]:
    """Format district and what-if simulation outputs into template variables."""
    is_tr = lang == "tr"
    support_ok = bool((whatif_res.get("support") or {}).get("supported", True))
    target_ha = (whatif_res.get("target") or {}).get("hectares")

    if target_ha is None:
        target_ha = "Erişilemez (+30 puan sınırı)" if is_tr else "Physically unreachable (+30 pts cap)"

    if is_tr:
        support_text = "Ampirik veriyle destekleniyor" if support_ok else "Zayıf veri desteği (ekstrapolasyon)"
    else:
        support_text = "Supported by empirical data" if support_ok else "Low empirical data support (extrapolation)"

    return {
        "city_name": d_info["city_name"],
        "district_name": d_info["name"],
        "urban_km2": round(float(d_info["urban_km2"]), 2),
        "green_share_pct": round(float(d_info["green_share"]) * 100, 1),
        "added_ha": whatif_res["applied"]["hectares"],
        "added_points": whatif_res["applied"]["points"],
        "cooling_celsius": whatif_res["effect"]["value"],
        "cooling_low": whatif_res["effect"]["low"],
        "cooling_high": whatif_res["effect"]["high"],
        "target_cooling": whatif_res["target"]["cooling"],
        "target_ha": target_ha,
        "risk_score": d_info["risk"]["score"],
        "supported": support_text,
    }


def render_prompt(data: dict[str, Any], lang: str = "en") -> list[dict[str, str]]:
    """Interpolate scenario variables into the language-specific prompt template."""
    config = _load_prompt_config()
    lang_key = "tr" if lang == "tr" else "en"
    section = config.get(lang_key) or config.get("en") or config

    system_prompt = section.get("system_prompt", "").strip()
    user_template = section.get("user_template", "")
    user_content = user_template.format_map(_SafeDict(data)).strip()

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


async def stream_chat_completion(
    messages: list[dict[str, str]],
    settings: LLMSettings | None = None,
) -> AsyncIterator[str]:
    """Stream chat completion tokens as Server-Sent Events (SSE)."""
    if settings is None:
        settings = get_llm_settings()

    client: AsyncOpenAI | None = None
    try:
        yield f"data: {json.dumps({'model': settings.model}, ensure_ascii=False)}\n\n"
        client = AsyncOpenAI(
            base_url=settings.base_url,
            api_key=settings.api_key,
            timeout=settings.timeout,
        )
        response = await client.chat.completions.create(
            model=settings.model,
            messages=messages,
            temperature=settings.temperature,
            max_tokens=settings.max_tokens,
            stream=True,
        )
        async for chunk in response:
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield f"data: {json.dumps({'token': delta.content}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as exc:
        yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    finally:
        if client is not None:
            await client.close()
