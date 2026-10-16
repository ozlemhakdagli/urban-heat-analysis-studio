"""Unit tests for the LLM Decision Support Engine (Task 1 and Task 2)."""
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.planner.llm import get_llm_settings, render_prompt


class _MockDelta:
    def __init__(self, content):
        self.content = content


class _MockChoice:
    def __init__(self, content):
        self.delta = _MockDelta(content)


class _MockChunk:
    def __init__(self, content):
        self.choices = [_MockChoice(content)]


class TestLLM(unittest.TestCase):
    def test_prompt_rendering(self):
        settings = get_llm_settings()
        self.assertTrue(settings.base_url.endswith("/v1") or "1234" in settings.base_url)

        sample_data = {
            "city_name": "Eskişehir",
            "district_name": "Odunpazarı",
            "urban_km2": 37.34,
            "green_share_pct": 9.9,
            "added_ha": 186.7,
            "added_points": 5.0,
            "cooling_celsius": -0.33,
            "cooling_low": -0.49,
            "cooling_high": -0.14,
            "target_cooling": 1.0,
            "target_ha": 485.5,
            "risk_score": 58.4,
            "supported": "Supported by empirical data",
        }
        # English prompt test
        messages_en = render_prompt(sample_data, lang="en")
        self.assertEqual(len(messages_en), 2)
        self.assertEqual(messages_en[0]["role"], "system")
        self.assertEqual(messages_en[1]["role"], "user")
        self.assertIn("Senior Urban Planner", messages_en[0]["content"])
        self.assertIn("Odunpazarı", messages_en[1]["content"])
        self.assertIn("-0.33", messages_en[1]["content"])
        self.assertIn("🎯 Executive Summary & Thermal Impact", messages_en[1]["content"])
        self.assertIn("👥 Socio-Spatial Dimension & Vulnerable Population", messages_en[1]["content"])
        self.assertIn("⚖️ Feasibility & Implementation Viability", messages_en[1]["content"])
        self.assertIn("🌿 Actionable Recommendations for Urban Planners", messages_en[1]["content"])

        # Turkish prompt test
        messages_tr = render_prompt(sample_data, lang="tr")
        self.assertEqual(len(messages_tr), 2)
        self.assertIn("Kıdemli bir Şehir Plancısı", messages_tr[0]["content"])
        self.assertIn("Odunpazarı", messages_tr[1]["content"])
        self.assertIn("🎯 Yönetici Özeti & Termal Etki", messages_tr[1]["content"])
        self.assertIn("👥 Sosyo-Mekânsal Boyut & Kırılgan Nüfus", messages_tr[1]["content"])
        self.assertIn("⚖️ Fizibilite ve Uygulama Gerçekçiliği", messages_tr[1]["content"])
        self.assertIn("🌿 Şehir Plancıları İçin Eylem Tavsiyeleri", messages_tr[1]["content"])

    def test_interpret_endpoint_mock(self):
        async def mock_stream(*args, **kwargs):
            yield _MockChunk("Odunpazarı ")
            yield _MockChunk("assessment.")

        with patch("backend.planner.llm.AsyncOpenAI") as mock_openai_cls:
            mock_client = mock_openai_cls.return_value
            mock_client.chat.completions.create = AsyncMock(side_effect=mock_stream)
            mock_client.close = AsyncMock()

            with TestClient(app) as client:
                res = client.post(
                    "/api/llm/interpret",
                    json={"district_code": 2046, "amount": 186.7, "unit": "ha", "cooling": 1.0, "lang": "en"},
                )
                self.assertEqual(res.status_code, 200)
                self.assertIn("text/event-stream", res.headers.get("content-type", ""))
                self.assertIn('data: {"token": "Odunpazarı "}', res.text)
                self.assertIn('data: {"token": "assessment."}', res.text)
                self.assertIn("data: [DONE]", res.text)


if __name__ == "__main__":
    unittest.main()
