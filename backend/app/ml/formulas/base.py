"""
Base Formula Definitions and Result Structures.
Provides structured data classes for clinical formula computation, factor contributions,
and risk tier classifications.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FactorContribution(BaseModel):
    factor_name: str
    value: Any
    reference_range: str = "-"
    contribution_direction: str  # "increases_risk", "decreases_risk", "neutral"
    contribution_magnitude: float  # 0.0 to 1.0
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


class FormulaResult(BaseModel):
    formula_score: float  # 0.0 to 1.0 normalized
    formula_name: str
    raw_score: float  # The actual formula output before normalization
    risk_tier: str  # "low", "moderate", "high", "critical"
    contributions: List[FactorContribution] = Field(default_factory=list)
    criteria_met: List[str] = Field(default_factory=list)
    criteria_not_met: List[str] = Field(default_factory=list)
    interpretation: str  # Plain English explanation
    clinical_basis: str  # Citation or formula name
    limitations: List[str] = Field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()
