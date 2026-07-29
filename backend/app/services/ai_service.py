from typing import Protocol


class AIProvider(Protocol):
    """Stable boundary for the future RoBERTa-backed implementation."""

    def classify(self, text: str) -> dict: ...
    def recommend_worker(self, department: str, priority: str = "medium") -> dict: ...


class RuleBasedAIProvider:
    def classify(self, text: str) -> dict:
        normalized = text.lower()
        category = "infrastructure" if any(k in normalized for k in ("streetlight", "road", "drain", "water", "garbage", "sewage")) else "general"
        priority = "high" if any(k in normalized for k in ("urgent", "emergency", "danger", "leak", "flood")) else "medium"
        return {"category": category, "confidence": 0.91 if category == "infrastructure" else 0.74, "priority": priority}

    def recommend_worker(self, department: str, priority: str = "medium") -> dict:
        workers = {"sanitation": "worker-17", "water": "worker-11", "public works": "worker-24", "public_works": "worker-24", "health": "worker-09"}
        return {"recommended_worker": workers.get(department.lower(), "worker-24"), "department": department, "confidence": 0.93 if priority == "high" else 0.84}


ai_provider: AIProvider = RuleBasedAIProvider()
