"""
Public response-time benchmarks.

Aggregates real (not fabricated) average-response-time stats across
users who've opted in (user_profiles.benchmark_opt_in), optionally
segmented by industry. Individual users are never identifiable in the
output — only counts and medians per cohort.
"""
import logging
import statistics

from database import get_supabase
from services.badge_service import compute_avg_response_hours

logger = logging.getLogger(__name__)

MIN_COHORT_SIZE = 3  # never show a stat computed from fewer than this many users


def _format_duration(hours: float) -> str:
    if hours < 1:
        return f"{max(1, round(hours * 60))}m"
    if hours < 24:
        return f"{round(hours)}h"
    return f"{round(hours / 24, 1)}d"


def get_benchmark(industry: str | None = None) -> dict:
    supabase = get_supabase()
    query = supabase.table("user_profiles").select("id, industry").eq("benchmark_opt_in", True)
    if industry:
        query = query.eq("industry", industry)
    result = query.execute()
    users = result.data or []

    hours_list = []
    for u in users:
        stats = compute_avg_response_hours(u["id"])
        if stats["avg_hours"] and stats["sample_size"] >= 3:
            hours_list.append(stats["avg_hours"])

    if len(hours_list) < MIN_COHORT_SIZE:
        return {
            "industry": industry,
            "cohort_size": len(hours_list),
            "median_response_time": None,
            "median_response_hours": None,
            "message": "Not enough opted-in users yet in this cohort to show a reliable benchmark.",
        }

    median_hours = statistics.median(hours_list)
    return {
        "industry": industry,
        "cohort_size": len(hours_list),
        "median_response_time": _format_duration(median_hours),
        "median_response_hours": round(median_hours, 1),
        "fastest_quartile_hours": round(statistics.quantiles(hours_list, n=4)[0], 1) if len(hours_list) >= 4 else None,
        "message": None,
    }


def list_available_industries() -> list[dict]:
    """Industries with enough opted-in users to have a real benchmark."""
    supabase = get_supabase()
    result = supabase.table("user_profiles").select("industry").eq("benchmark_opt_in", True).execute()
    counts: dict[str, int] = {}
    for row in result.data or []:
        ind = row.get("industry")
        if ind:
            counts[ind] = counts.get(ind, 0) + 1
    return [{"industry": k, "count": v} for k, v in counts.items() if v >= MIN_COHORT_SIZE]
