"""
Longitudinal Risk Trajectory Computation Service.
Calculates linear regression trend slope, direction (improving/stable/worsening/insufficient_data),
plain-English clinical trajectory explanation, and adjusted trajectory risk.
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional
import numpy as np
from pydantic import BaseModel, Field


class TrajectoryPoint(BaseModel):
    date: str
    score: float
    risk_level: Optional[str] = None


class TrajectoryResult(BaseModel):
    data_points: List[Dict[str, Any]] = Field(default_factory=list)
    trend_direction: str  # improving / stable / worsening / insufficient_data
    trend_slope: float
    trend_explanation: str
    trajectory_risk: str  # low / moderate / high / critical


def compute_risk_trajectory(
    scan_history: list,
    module: str,
) -> TrajectoryResult:
    """
    Computes longitudinal trajectory over a series of chronological scans.

    scan_history: list of scans or dicts with {scan_date: date, fusion_score: float, risk_level: str}
    module: 'breast' | 'cervical' | 'pcos'
    """
    parsed_points = []
    for item in scan_history:
        if isinstance(item, dict):
            d = item.get("scan_date") or item.get("date")
            s = item.get("fusion_score") if item.get("fusion_score") is not None else item.get("score", 0.0)
            r = item.get("risk_level")
        else:
            d = getattr(item, "scan_date", None) or getattr(item, "date", None)
            s = getattr(item, "fusion_score", None)
            if s is None:
                s = getattr(item, "score", 0.0)
            r = getattr(item, "risk_level", None)
            if hasattr(r, "value"):
                r = r.value

        # Parse date to date object and ISO string
        if isinstance(d, str):
            try:
                d_obj = datetime.fromisoformat(d.replace("Z", "+00:00")).date()
            except Exception:
                d_obj = datetime.strptime(d[:10], "%Y-%m-%d").date()
            d_str = d[:10]
        elif isinstance(d, datetime):
            d_obj = d.date()
            d_str = d_obj.isoformat()
        elif isinstance(d, date):
            d_obj = d
            d_str = d.isoformat()
        else:
            d_obj = date.today()
            d_str = d_obj.isoformat()

        parsed_points.append({
            "date_obj": d_obj,
            "date": d_str,
            "score": round(float(s or 0.0), 4),
            "risk_level": str(r).lower() if r else "low",
        })

    # Ensure chronological order
    parsed_points.sort(key=lambda p: p["date_obj"])

    data_points = [
        {
            "date": p["date"],
            "score": p["score"],
            "risk_level": p["risk_level"],
        }
        for p in parsed_points
    ]

    # Less than 2 scans -> insufficient data
    if len(parsed_points) < 2:
        latest_risk = parsed_points[0]["risk_level"] if parsed_points else "low"
        return TrajectoryResult(
            data_points=data_points,
            trend_direction="insufficient_data",
            trend_slope=0.0,
            trend_explanation="At least 2 scans required for trend analysis",
            trajectory_risk=latest_risk,
        )

    # Simple linear regression on scores vs time in days from first scan
    first_date = parsed_points[0]["date_obj"]
    times = [(p["date_obj"] - first_date).days for p in parsed_points]
    scores = [p["score"] for p in parsed_points]

    total_days = times[-1]
    first_score = scores[0]
    last_score = scores[-1]
    min_score = min(scores)
    max_score = max(scores)
    latest_risk = (parsed_points[-1]["risk_level"] or "low").lower()

    if total_days <= 0 or max(times) == 0:
        slope = 0.0
    else:
        slope_fit, _ = np.polyfit(times, scores, 1)
        slope = float(slope_fit)

    # Trend Classification
    if slope > 0.001:
        trend_direction = "worsening"
    elif slope < -0.001:
        trend_direction = "improving"
    else:
        trend_direction = "stable"

    # Trend Explanation
    if trend_direction == "worsening":
        trend_explanation = (
            f"Risk score has increased from {first_score:.2f} "
            f"to {last_score:.2f} over {total_days} days. "
            f"This upward trend warrants closer monitoring."
        )
    elif trend_direction == "improving":
        trend_explanation = (
            f"Risk score has decreased from {first_score:.2f} "
            f"to {last_score:.2f} over {total_days} days. "
            f"This downward trend is a positive indicator."
        )
    else:
        trend_explanation = (
            f"Risk score has remained relatively stable "
            f"between {min_score:.2f} and {max_score:.2f} "
            f"over {total_days} days."
        )

    # Trajectory Risk
    # If worsening and latest_score > 0.50: high
    # If worsening and latest_score <= 0.50: moderate
    # If stable: same as latest risk level
    # If improving: one tier below latest risk level
    if trend_direction == "worsening":
        if last_score > 0.50:
            trajectory_risk = "high"
        else:
            trajectory_risk = "moderate"
    elif trend_direction == "stable":
        trajectory_risk = latest_risk
    elif trend_direction == "improving":
        tier_order = ["low", "moderate", "high", "critical"]
        if latest_risk in tier_order:
            idx = tier_order.index(latest_risk)
            trajectory_risk = tier_order[max(0, idx - 1)]
        else:
            trajectory_risk = "low"
    else:
        trajectory_risk = latest_risk

    return TrajectoryResult(
        data_points=data_points,
        trend_direction=trend_direction,
        trend_slope=round(slope, 6),
        trend_explanation=trend_explanation,
        trajectory_risk=trajectory_risk,
    )
