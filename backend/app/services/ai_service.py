"""Complaint classification behind a stable provider boundary.

Two providers implement :class:`AIProvider`:

* :class:`LocalModelAIProvider` — the trained XLM-RoBERTa classifier in
  ``backend/models/grievance_classifier``. It handles English, Hindi and Hinglish because
  the training set is roughly one third of each.
* :class:`RuleBasedAIProvider` — a dependency-free keyword fallback used in tests and when
  the model or its dependencies are unavailable.

The model weighs ~1.1 GB, so it is loaded lazily on first classification rather than at
import time. Otherwise every process that merely imports this module (the API *and* the
Telegram bot) would each pay the load cost and resident memory even if it never classifies.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Protocol

# transformers probes for every backend it supports and will import TensorFlow if it is
# installed. Loading TensorFlow and PyTorch into one process segfaults this deployment
# (uvicorn died with SIGSEGV mid-request), and we only ever use the PyTorch path. These
# must be set before transformers is imported anywhere.
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_TORCH", "1")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

from app.core.config import settings
from app.core.domain import (
    DEFAULT_CATEGORY,
    canonicalize_category,
    canonicalize_priority,
    department_for_category,
)

logger = logging.getLogger("raipurone.ai")

MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / "grievance_classifier"
LABEL_MAP_PATH = Path(__file__).resolve().parents[3] / "notebooks" / "label_mapping.json"


def _load_label_map() -> dict[str, str]:
    if not LABEL_MAP_PATH.exists():
        return {}
    with LABEL_MAP_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return {str(key): str(value) for key, value in data.items()}


# --- Priority detection -----------------------------------------------------
# The classifier predicts category only, so priority stays keyword-driven. Unlike the
# original English-only list, these cover Hindi and Hinglish too — without them every
# complaint from a Hindi speaker landed on the default priority, which is why all 38
# complaints in the live database were "medium".

_CRITICAL_TERMS = (
    # English
    "emergency", "fire", "collapse", "collapsed", "electrocut", "live wire", "gas leak",
    "died", "death", "fatal", "drowning", "epidemic", "outbreak",
    # Hinglish
    "aag", "aag lag", "jaan ka khatra", "mar gaya", "mout", "current laga", "karent",
    "girr gaya", "gir gaya", "dhah gaya",
    # Hindi
    "आग", "जान का खतरा", "मौत", "करंट", "गिर गया", "दुर्घटना",
)

_HIGH_TERMS = (
    # English
    "urgent", "danger", "dangerous", "flood", "flooding", "overflow", "overflowing",
    "sewage", "burst", "leak", "leaking", "accident", "injury", "injured", "blocked",
    "no water", "outbreak", "risk", "unsafe", "severe",
    # Hinglish
    "turant", "jaldi", "khatra", "khatarnak", "badh", "baadh", "bharav", "leak ho",
    "phat gaya", "phatt", "band ho gaya", "nahi aa raha", "pani nahi", "bimari",
    "ganda pani", "chot",
    # Hindi
    "तुरंत", "खतरा", "खतरनाक", "बाढ़", "रिसाव", "फट", "गंदा पानी", "बीमारी", "चोट",
    "दुर्गंध", "जलभराव",
)

_LOW_TERMS = (
    # English
    "suggestion", "request", "minor", "cosmetic", "whenever possible", "small",
    "please consider", "feedback",
    # Hinglish
    "sujhav", "salah", "chhota", "choti", "koi jaldi nahi", "jab time mile",
    # Hindi
    "सुझाव", "सलाह", "छोटा", "छोटी",
)


def detect_priority(text: str) -> str:
    """Infer priority from urgency cues in English, Hindi or Hinglish."""
    normalized = str(text or "").lower()
    if any(term in normalized for term in _CRITICAL_TERMS):
        return "critical"
    if any(term in normalized for term in _HIGH_TERMS):
        return "high"
    if any(term in normalized for term in _LOW_TERMS):
        return "low"
    return "medium"


class AIProvider(Protocol):
    """Stable boundary so routes never depend on model code."""

    def classify(self, text: str) -> dict: ...
    def recommend_worker(self, department: str, priority: str = "medium") -> dict: ...


# --- Worker recommendation --------------------------------------------------

def _department_for_category(value: str) -> str:
    """Map a complaint category onto the department that owns it.

    Kept as a thin alias so the routing table has exactly one home: see
    ``app.core.domain.department_for_category``.
    """
    return department_for_category(value)


class RuleBasedAIProvider:
    """Keyword fallback. Deterministic, dependency-free, used by tests."""

    _CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("Water Supply", ("water", "leak", "pipe", "tank", "pani", "nal", "पानी", "नल")),
        ("Drainage", ("drain", "sewer", "nali", "naali", "नाली", "सीवर")),
        ("Sanitation", ("garbage", "dump", "sanitation", "sewage", "waste", "kachra", "कचरा", "गंदगी")),
        ("Street Lights", ("streetlight", "street light", "electricity", "light", "bijli", "बिजली", "लाइट")),
        ("Health care", ("hospital", "health", "medical", "clinic", "aspatal", "अस्पताल", "डॉक्टर")),
        ("Roads", ("road", "pothole", "traffic", "sadak", "gadha", "सड़क", "गड्ढा")),
        ("Public Transport", ("bus", "transport", "auto", "बस", "परिवहन")),
        ("Encroachment", ("encroachment", "kabza", "कब्जा")),
        ("Pollution", ("pollution", "smoke", "pradushan", "प्रदूषण", "धुआं")),
    )

    def classify(self, text: str) -> dict:
        normalized = str(text or "").lower()
        category = DEFAULT_CATEGORY
        confidence = 0.40  # Honest: a keyword hit is a weak signal, not a model score.
        for candidate, keywords in self._CATEGORY_RULES:
            if any(keyword in normalized for keyword in keywords):
                category, confidence = candidate, 0.65
                break
        return {
            "category": category,
            "confidence": confidence,
            "priority": detect_priority(text),
            "provider": "rule_based",
        }

    def recommend_worker(self, department: str, priority: str = "medium") -> dict:
        return recommend_worker_from_repository(department, priority)


class LocalModelAIProvider:
    """Trained XLM-RoBERTa classifier. Loads on first use, not at import."""

    def __init__(self) -> None:
        self.model_dir = MODEL_DIR
        self.label_map = _load_label_map()
        self._lock = threading.Lock()
        self._loaded = False
        self.torch = None
        self.tokenizer = None
        self.model = None
        if not self.model_dir.exists():
            raise RuntimeError(f"Local model directory not found: {self.model_dir}")

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        with self._lock:
            if self._loaded:  # Another thread finished while we waited.
                return
            try:
                from transformers import AutoModelForSequenceClassification, AutoTokenizer
            except ImportError as exc:
                raise RuntimeError(f"transformers is not importable: {exc}") from exc
            try:
                import torch
            except ImportError as exc:
                raise RuntimeError("torch is not installed") from exc

            logger.info("Loading grievance classifier from %s (first use)", self.model_dir)
            self.torch = torch
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_dir, local_files_only=True)
            # low_cpu_mem_usage streams the weights in instead of allocating a
            # randomly-initialised model and then a second copy from the checkpoint.
            # That halves peak RAM, which matters here: without it the load segfaults
            # on a 6 GB machine.
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_dir,
                local_files_only=True,
                low_cpu_mem_usage=True,
                torch_dtype=torch.float32,
            )
            self.model.eval()
            self._loaded = True
            logger.info("Grievance classifier ready (%d labels)", len(self.label_map) or -1)

    def classify(self, text: str) -> dict:
        self._ensure_loaded()
        content = str(text or "").strip() or "No complaint text provided."
        inputs = self.tokenizer(content, truncation=True, padding=True, return_tensors="pt")
        with self.torch.no_grad():
            probs = self.model(**inputs).logits.softmax(dim=-1)[0]
            chosen_index = int(probs.argmax().item())
            confidence = float(probs[chosen_index].item())

        raw_label = self.label_map.get(
            str(chosen_index),
            self.model.config.id2label.get(chosen_index, f"LABEL_{chosen_index}"),
        )
        return {
            "category": canonicalize_category(raw_label),
            "confidence": round(confidence, 4),
            "priority": detect_priority(content),
            "provider": "xlm_roberta",
        }

    def recommend_worker(self, department: str, priority: str = "medium") -> dict:
        return recommend_worker_from_repository(department, priority)


def recommend_worker_from_repository(department: str, priority: str = "medium") -> dict:
    """Recommend the least-loaded available worker in the owning department.

    Replaces the previous hardcoded ``{"sanitation": "worker-17", ...}`` lookup table, which
    returned the same invented worker id for every complaint regardless of real workload or
    whether that worker existed. Recommendations stay advisory — an administrator approves.
    """
    target_department = _department_for_category(department)
    try:
        from app.services.repository import get_complaint_repository

        workers = get_complaint_repository().list_workers()
    except Exception as exc:  # pragma: no cover - repository/network failure
        logger.warning("Worker recommendation could not read workers: %s", exc)
        workers = []

    def serves(worker: dict) -> bool:
        names = [str(item).lower() for item in (worker.get("departments") or [])]
        haystack = " ".join(names + [str(worker.get("work_type") or "").lower()])
        return target_department.lower() in haystack

    candidates = [
        worker
        for worker in workers
        if serves(worker) and worker.get("is_active", True) and worker.get("status") != "offline"
    ]
    if not candidates:
        return {
            "recommended_worker": None,
            "recommended_worker_id": None,
            "department": target_department,
            "confidence": 0.0,
            "reason": f"No available worker is mapped to {target_department}.",
        }

    best = min(candidates, key=lambda worker: (worker.get("active_tasks") or 0))
    load = best.get("active_tasks") or 0
    # Confidence reflects headroom: a free worker in the right department is a strong pick.
    confidence = 0.9 if load == 0 else max(0.4, 0.9 - 0.1 * load)
    return {
        "recommended_worker": best.get("name"),
        # The database column is a uuid, so this must be the worker's row id - not the
        # human-facing employee code, which is what `worker_id` holds.
        "recommended_worker_id": best.get("id"),
        "recommended_worker_code": best.get("worker_id"),
        "department": target_department,
        "confidence": round(confidence, 2),
        "reason": f"Lowest active workload ({load}) in {target_department}.",
        "priority_considered": canonicalize_priority(priority),
    }


class RemoteAIProvider:
    """Calls another RaipurOne process that already has the model loaded.

    The API and the Telegram bot both classify text. Each loading its own copy would put
    two ~1.1 GB models in memory, which this deployment cannot afford. The bot points at
    the API instead, so exactly one copy exists. Falls back to rules if the API is down,
    so Telegram intake keeps working during an API restart.
    """

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self._fallback = RuleBasedAIProvider()

    def classify(self, text: str) -> dict:
        import httpx

        try:
            response = httpx.post(f"{self.base_url}/ai/classify", json={"text": text}, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            logger.warning("Remote classify failed, using rule-based fallback: %s", exc)
            return self._fallback.classify(text)

    def recommend_worker(self, department: str, priority: str = "medium") -> dict:
        return recommend_worker_from_repository(department, priority)


class _LazyProvider:
    """Chooses a provider on first use and degrades to rules if the model cannot load.

    Selecting at first use rather than import time keeps ``import app.main`` fast and stops a
    model problem from taking down the whole API at startup.
    """

    def __init__(self) -> None:
        self._delegate: AIProvider | None = None
        self._lock = threading.Lock()

    def _resolve(self) -> AIProvider:
        if self._delegate is not None:
            return self._delegate
        with self._lock:
            if self._delegate is not None:
                return self._delegate
            remote_url = os.getenv("AI_SERVICE_URL", "").strip()
            if remote_url:
                self._delegate = RemoteAIProvider(remote_url)
                logger.info("AI provider: remote classifier at %s", remote_url)
                return self._delegate

            mode = (settings.ai_provider or "local_model").lower()
            if mode in {"auto", "local_model"}:
                try:
                    provider = LocalModelAIProvider()
                    provider._ensure_loaded()
                    self._delegate = provider
                    logger.info("AI provider: local XLM-RoBERTa classifier")
                    return self._delegate
                except Exception as exc:
                    logger.warning("Local model unavailable, using rule-based provider: %s", exc)
            self._delegate = RuleBasedAIProvider()
            logger.info("AI provider: rule-based")
            return self._delegate

    @property
    def active_name(self) -> str:
        return type(self._delegate).__name__ if self._delegate else "not_loaded"

    def classify(self, text: str) -> dict:
        return self._resolve().classify(text)

    def recommend_worker(self, department: str, priority: str = "medium") -> dict:
        return self._resolve().recommend_worker(department, priority)


ai_provider = _LazyProvider()
