from decimal import Decimal, ROUND_HALF_UP

from app.core.exceptions import ValidationError


def weighted_average(entries: list) -> Decimal:
    """Compute weighted average of grade entries. Returns 0 if no entries."""
    if not entries:
        return Decimal("0")
    total_weight = sum(e.weight for e in entries)
    if not total_weight:
        raise ValidationError("Total weight of grade entries must be greater than 0")
    weighted_sum = sum(Decimal(str(e.grade)) * e.weight for e in entries)
    return (weighted_sum / total_weight).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def round_grade(avg: Decimal | None) -> int | None:
    """Round weighted average to final Kosovo 1-5 grade. Returns None if too low."""
    if avg is None or avg == Decimal("0"):
        return None
    if avg < Decimal("0.5"):
        return None
    rounded = avg.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    grade_int = int(rounded)
    return max(1, min(5, grade_int))


def score_to_grade(score_pct: Decimal, thresholds: dict | None = None) -> int:
    """Convert a score percentage (0-100) to Kosovo 1-5 grade.

    Default thresholds: 90→5, 75→4, 60→3, 45→2, <45→1.
    Pass a dict like {"5": 90, "4": 75, "3": 60, "2": 45} to override.
    """
    t = thresholds or {"5": 90, "4": 75, "3": 60, "2": 45}
    if score_pct >= t.get("5", 90):
        return 5
    if score_pct >= t.get("4", 75):
        return 4
    if score_pct >= t.get("3", 60):
        return 3
    if score_pct >= t.get("2", 45):
        return 2
    return 1
