"""Provider-agnostic LLM client for SKU insights."""

from __future__ import annotations

import os
from typing import Optional


class LLMClient:
    def __init__(self, provider: Optional[str] = None):
        self.provider = (provider or os.getenv("LLM_PROVIDER", "groq")).lower()
        self._api_key = self._resolve_key()

    def _resolve_key(self) -> Optional[str]:
        key_map = {
            "groq": "GROQ_API_KEY",
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "gemini": "GEMINI_API_KEY",
        }
        env_var = key_map.get(self.provider)
        return os.getenv(env_var) if env_var else None

    def generate_insight(self, sku_data: dict, api_key: Optional[str] = None) -> str:
        key = api_key or self._api_key
        if not key:
            return f"[No API key for {self.provider}. Set {self.provider.upper()}_API_KEY or use BYOK modal.]"

        prompt = self._build_prompt(sku_data)

        if self.provider == "groq":
            return self._call_groq(prompt, key)
        if self.provider == "openai":
            return self._call_openai(prompt, key)
        if self.provider == "anthropic":
            return self._call_anthropic(prompt, key)
        if self.provider == "gemini":
            return self._call_gemini(prompt, key)
        raise ValueError(f"Unknown provider: {self.provider}. Supported: groq, openai, anthropic, gemini")

    def _build_prompt(self, sku_data: dict) -> str:
        sku_id = sku_data.get("sku_id", "UNKNOWN")
        status = sku_data.get("status", "UNKNOWN")
        days_until_stockout = sku_data.get("days_until_stockout", "N/A")
        avg_demand = sku_data.get("avg_daily_demand", 0)
        recommended_qty = sku_data.get("recommended_order_qty", 0)
        trigger_date = sku_data.get("trigger_date", "N/A")
        risk_score = round(float(sku_data.get("stockout_risk_score", 0)), 2)
        top_features = sku_data.get("top_shap_features", [])
        demand_drivers = ""
        if top_features:
            demand_drivers = f"Top demand drivers: {', '.join(str(feature) for feature in top_features[:3])}\n"

        system = (
            "You are a supply chain analyst. Give a concise 3-line insight for a retail SKU. Format exactly as:\n"
            "Status: <status line>\n"
            "Trend: <demand trend and drivers>\n"
            "Recommendation: <action with quantities and timing>"
        )
        user = (
            f"SKU: {sku_id}\n"
            f"Inventory Status: {status}\n"
            f"Days until stockout: {days_until_stockout}\n"
            f"Risk score: {risk_score:.2f}/1.0\n"
            f"Avg daily demand: {avg_demand:.1f} units\n"
            f"Recommended order qty: {recommended_qty:.0f} units\n"
            f"Order trigger date: {trigger_date}\n"
            f"{demand_drivers}"
        )
        return system + "\n\n" + user

    def _call_groq(self, prompt: str, key: str) -> str:
        import httpx

        parts = prompt.split("\n\n", 1)
        system_msg = parts[0]
        user_msg = parts[1] if len(parts) > 1 else prompt
        resp = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
                "max_tokens": 150,
                "temperature": 0.3,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

    def _call_openai(self, prompt: str, key: str) -> str:
        import httpx

        parts = prompt.split("\n\n", 1)
        system_msg = parts[0]
        user_msg = parts[1] if len(parts) > 1 else prompt
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
                "max_tokens": 150,
                "temperature": 0.3,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

    def _call_anthropic(self, prompt: str, key: str) -> str:
        import httpx

        parts = prompt.split("\n\n", 1)
        system_msg = parts[0]
        user_msg = parts[1] if len(parts) > 1 else prompt
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json={
                "model": "claude-haiku-4-5-20251001",
                "system": system_msg,
                "messages": [{"role": "user", "content": user_msg}],
                "max_tokens": 150,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"].strip()

    def _call_gemini(self, prompt: str, key: str) -> str:
        import httpx

        resp = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 150, "temperature": 0.3},
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
