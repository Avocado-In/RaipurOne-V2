"""Canonical vocabulary and lifecycle rules for complaints.

Everything that writes a category, priority or status goes through this module so the
database keeps one spelling per concept. Before this existed the live table held nine
different category spellings (``general``, ``infrastructure``, ``Garbage``, ``road`` ...)
for what were really the same handful of civic issues.

The category names match the labels the trained classifier emits
(``notebooks/label_mapping.json``) so model output needs no translation layer.
"""
from __future__ import annotations

from typing import Literal

# --- Categories -------------------------------------------------------------

CATEGORIES: tuple[str, ...] = (
    "Drainage",
    "Education",
    "Encroachment",
    "Government Services",
    "Health care",
    "Illegal Construction",
    "Others",
    "Parks & Public Spaces",
    "Pollution",
    "Public Transport",
    "Roads",
    "Sanitation",
    "Street Lights",
    "Water Supply",
)

DEFAULT_CATEGORY = "Others"

# Legacy spellings found in the live database, plus the classifier's lowercase "road"
# label, folded onto the canonical names above.
_CATEGORY_ALIASES: dict[str, str] = {
    "road": "Roads",
    "roads": "Roads",
    "pothole": "Roads",
    "potholes": "Roads",
    "traffic": "Roads",
    "transport": "Public Transport",
    "public transport": "Public Transport",
    "general": "Others",
    "other": "Others",
    "others": "Others",
    "infrastructure": "Others",
    "garbage": "Sanitation",
    "waste": "Sanitation",
    "sanitation": "Sanitation",
    "sewage": "Sanitation",
    "drain": "Drainage",
    "drainage": "Drainage",
    "water": "Water Supply",
    "water supply": "Water Supply",
    "lighting": "Street Lights",
    "streetlight": "Street Lights",
    "streetlights": "Street Lights",
    "street light": "Street Lights",
    "street lights": "Street Lights",
    "street_lights": "Street Lights",
    "electricity": "Street Lights",
    "health": "Health care",
    "healthcare": "Health care",
    "health care": "Health care",
    "hospital": "Health care",
    "medical": "Health care",
    "pollution": "Pollution",
    "education": "Education",
    "encroachment": "Encroachment",
    "illegal construction": "Illegal Construction",
    "government services": "Government Services",
    "parks": "Parks & Public Spaces",
    "parks & public spaces": "Parks & Public Spaces",
}

_CATEGORY_BY_LOWER = {name.lower(): name for name in CATEGORIES}


def canonicalize_category(value: object) -> str:
    """Fold any historical or model-supplied spelling onto a canonical category."""
    raw = str(value or "").strip()
    if not raw:
        return DEFAULT_CATEGORY
    lowered = raw.lower()
    if lowered in _CATEGORY_BY_LOWER:
        return _CATEGORY_BY_LOWER[lowered]
    return _CATEGORY_ALIASES.get(lowered, DEFAULT_CATEGORY)


# --- Priority ---------------------------------------------------------------

PRIORITIES: tuple[str, ...] = ("low", "medium", "high", "critical")
DEFAULT_PRIORITY = "medium"

# The training data labels priorities as Low / Medium / High / Ultra High / Critical.
_PRIORITY_ALIASES: dict[str, str] = {
    "low": "low",
    "medium": "medium",
    "normal": "medium",
    "high": "high",
    "ultra high": "critical",
    "ultra_high": "critical",
    "urgent": "critical",
    "critical": "critical",
    "emergency": "critical",
}


def canonicalize_priority(value: object) -> str:
    return _PRIORITY_ALIASES.get(str(value or "").strip().lower(), DEFAULT_PRIORITY)


# --- Status lifecycle -------------------------------------------------------

STATUSES: tuple[str, ...] = (
    "submitted",
    "assigned",
    "in_progress",
    "under_review",
    "resolved",
    "closed",
    "rejected",
)
DEFAULT_STATUS = "submitted"

#: Terminal states accept no further transitions.
TERMINAL_STATUSES = frozenset({"closed", "rejected"})

#: Which statuses may follow which. Prevents nonsense jumps such as ``closed -> submitted``,
#: which the API accepted silently before this existed.
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "submitted": frozenset({"assigned", "rejected"}),
    "assigned": frozenset({"in_progress", "submitted", "rejected"}),
    "in_progress": frozenset({"under_review", "resolved", "assigned"}),
    "under_review": frozenset({"resolved", "in_progress", "rejected"}),
    "resolved": frozenset({"closed", "in_progress"}),
    "closed": frozenset(),
    "rejected": frozenset(),
}


def canonicalize_status(value: object) -> str:
    lowered = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    return lowered if lowered in STATUSES else DEFAULT_STATUS


class InvalidStatusTransition(ValueError):
    """Raised when a caller asks for a lifecycle jump that is not permitted."""

    def __init__(self, current: str, requested: str) -> None:
        self.current = current
        self.requested = requested
        allowed = ", ".join(sorted(ALLOWED_TRANSITIONS.get(current, frozenset()))) or "none"
        super().__init__(
            f"Cannot move complaint from '{current}' to '{requested}'. Allowed next: {allowed}."
        )


def validate_transition(current: object, requested: object) -> str:
    """Return the canonical target status, or raise :class:`InvalidStatusTransition`."""
    current_status = canonicalize_status(current)
    target = str(requested or "").strip().lower().replace("-", "_").replace(" ", "_")
    if target not in STATUSES:
        raise InvalidStatusTransition(current_status, str(requested))
    if target == current_status:
        return target  # Idempotent re-assertion of the same status is harmless.
    if target not in ALLOWED_TRANSITIONS.get(current_status, frozenset()):
        raise InvalidStatusTransition(current_status, target)
    return target


# Literal aliases so Pydantic models reject bad input at the edge rather than at the database.
CategoryLiteral = Literal[
    "Drainage",
    "Education",
    "Encroachment",
    "Government Services",
    "Health care",
    "Illegal Construction",
    "Others",
    "Parks & Public Spaces",
    "Pollution",
    "Public Transport",
    "Roads",
    "Sanitation",
    "Street Lights",
    "Water Supply",
]
PriorityLiteral = Literal["low", "medium", "high", "critical"]
StatusLiteral = Literal[
    "submitted", "assigned", "in_progress", "under_review", "resolved", "closed", "rejected"
]


# --- Category -> department routing -----------------------------------------
#
# The classifier produces a *category*; workers belong to a *department*. The two
# vocabularies are not the same, so matching them by string equality silently found
# nobody for most complaints (a "Roads" complaint never matched a
# "Roads & Public Works" worker). Every category must appear here.
CATEGORY_TO_DEPARTMENT: dict[str, str] = {
    "Water Supply": "Water Supply",
    "Drainage": "Drainage",
    "Sanitation": "Sanitation",
    "Pollution": "Sanitation",
    "Street Lights": "Electricity",
    "Roads": "Roads & Public Works",
    "Illegal Construction": "Roads & Public Works",
    "Encroachment": "Roads & Public Works",
    "Parks & Public Spaces": "Parks & Gardens",
    "Public Transport": "Traffic",
    "Health care": "Health",
    "Education": "Other",
    "Government Services": "Other",
    "Others": "Other",
}


def department_for_category(value: object) -> str:
    """Department that owns a complaint category.

    A value that is already a department name passes through unchanged, so callers may
    hand this either vocabulary.
    """
    raw = str(value or "").strip()
    if not raw:
        return "Other"
    if raw in CATEGORY_TO_DEPARTMENT:
        return CATEGORY_TO_DEPARTMENT[raw]
    for category, department in CATEGORY_TO_DEPARTMENT.items():
        if raw.casefold() == category.casefold():
            return department
    # Already a department name (or something unrecognised) - keep it rather than
    # silently rerouting the complaint to Public Works.
    return raw
