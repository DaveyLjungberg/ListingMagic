"""
Listing Magic - Cost Tracker

Tracks API usage and costs across all three AI models.
Provides per-request, per-user, and daily cost aggregation.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, date
from dataclasses import dataclass, field
from collections import defaultdict

from config import COST_CONFIG, GPT41_CONFIG, CLAUDE_SONNET_CONFIG, GEMINI3_CONFIG

logger = logging.getLogger(__name__)


@dataclass
class UsageRecord:
    """Single usage record for cost tracking."""
    timestamp: datetime
    provider: str
    model: str
    task: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    request_id: str
    user_id: Optional[str] = None


@dataclass
class CostSummary:
    """Cost summary for a time period."""
    total_cost_usd: float = 0.0
    total_requests: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    by_provider: Dict[str, float] = field(default_factory=dict)
    by_task: Dict[str, float] = field(default_factory=dict)
    by_model: Dict[str, float] = field(default_factory=dict)


class CostTracker:
    """
    Tracks API costs across OpenAI, Anthropic, and Google AI services.

    Features:
    - Per-request cost calculation
    - User-level cost aggregation
    - Daily cost summaries
    - Alert thresholds
    """

    # Model cost mappings (per 1K tokens)
    MODEL_COSTS = {
        "gpt-4.1": {
            "input": GPT41_CONFIG.cost_per_1k_input,
            "output": GPT41_CONFIG.cost_per_1k_output
        },
        "claude-sonnet-4-20250514": {
            "input": CLAUDE_SONNET_CONFIG.cost_per_1k_input,
            "output": CLAUDE_SONNET_CONFIG.cost_per_1k_output
        },
        "gemini-3-pro-latest": {
            "input": GEMINI3_CONFIG.cost_per_1k_input,
            "output": GEMINI3_CONFIG.cost_per_1k_output
        }
    }

    def __init__(self):
        self.records: List[UsageRecord] = []
        self.daily_costs: Dict[date, float] = defaultdict(float)
        self.user_costs: Dict[str, float] = defaultdict(float)
        self.hourly_costs: Dict[str, float] = defaultdict(float)

        self._alerts_triggered: List[Dict[str, Any]] = []

        logger.info("Cost tracker initialized")

    def calculate_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int
    ) -> float:
        """Calculate cost for a specific model and token usage."""
        if model not in self.MODEL_COSTS:
            # Use default pricing if model not found
            logger.warning(f"Unknown model for cost calculation: {model}")
            return 0.0

        costs = self.MODEL_COSTS[model]
        input_cost = (input_tokens / 1000) * costs["input"]
        output_cost = (output_tokens / 1000) * costs["output"]
        total = round(input_cost + output_cost, 6)

        return total

    def record_usage(
        self,
        provider: str,
        model: str,
        task: str,
        input_tokens: int,
        output_tokens: int,
        request_id: str,
        user_id: Optional[str] = None
    ) -> UsageRecord:
        """Record a usage event and calculate costs."""
        cost = self.calculate_cost(model, input_tokens, output_tokens)
        now = datetime.utcnow()

        record = UsageRecord(
            timestamp=now,
            provider=provider,
            model=model,
            task=task,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            request_id=request_id,
            user_id=user_id
        )

        self.records.append(record)

        # Update aggregations
        today = now.date()
        hour_key = now.strftime("%Y-%m-%d-%H")

        self.daily_costs[today] += cost
        self.hourly_costs[hour_key] += cost

        if user_id:
            self.user_costs[user_id] += cost

        # Check thresholds
        self._check_thresholds(record)

        logger.debug(
            f"Recorded usage: {provider}/{model} - "
            f"{input_tokens}+{output_tokens} tokens = ${cost:.4f}"
        )

        return record

    def _check_thresholds(self, record: UsageRecord) -> None:
        """Check if any cost thresholds have been exceeded."""
        thresholds = COST_CONFIG.get("alert_thresholds", {})

        # Per-request threshold
        if record.cost_usd > thresholds.get("per_request", float("inf")):
            alert = {
                "type": "per_request",
                "threshold": thresholds["per_request"],
                "actual": record.cost_usd,
                "request_id": record.request_id,
                "timestamp": record.timestamp.isoformat()
            }
            self._alerts_triggered.append(alert)
            logger.warning(f"Cost alert: Request ${record.cost_usd:.4f} exceeds threshold")

        # Hourly threshold
        hour_key = record.timestamp.strftime("%Y-%m-%d-%H")
        hourly_total = self.hourly_costs[hour_key]
        if hourly_total > thresholds.get("per_hour", float("inf")):
            if not any(a["type"] == "per_hour" and a.get("hour") == hour_key
                       for a in self._alerts_triggered):
                alert = {
                    "type": "per_hour",
                    "threshold": thresholds["per_hour"],
                    "actual": hourly_total,
                    "hour": hour_key,
                    "timestamp": record.timestamp.isoformat()
                }
                self._alerts_triggered.append(alert)
                logger.warning(f"Cost alert: Hourly spend ${hourly_total:.2f} exceeds threshold")

        # Daily threshold
        today = record.timestamp.date()
        daily_total = self.daily_costs[today]
        if daily_total > thresholds.get("per_day", float("inf")):
            if not any(a["type"] == "per_day" and a.get("date") == str(today)
                       for a in self._alerts_triggered):
                alert = {
                    "type": "per_day",
                    "threshold": thresholds["per_day"],
                    "actual": daily_total,
                    "date": str(today),
                    "timestamp": record.timestamp.isoformat()
                }
                self._alerts_triggered.append(alert)
                logger.warning(f"Cost alert: Daily spend ${daily_total:.2f} exceeds threshold")

    def get_summary(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        user_id: Optional[str] = None
    ) -> CostSummary:
        """Get cost summary for a time period."""
        summary = CostSummary()

        for record in self.records:
            record_date = record.timestamp.date()

            # Filter by date range
            if start_date and record_date < start_date:
                continue
            if end_date and record_date > end_date:
                continue

            # Filter by user
            if user_id and record.user_id != user_id:
                continue

            summary.total_cost_usd += record.cost_usd
            summary.total_requests += 1
            summary.total_input_tokens += record.input_tokens
            summary.total_output_tokens += record.output_tokens

            # By provider
            if record.provider not in summary.by_provider:
                summary.by_provider[record.provider] = 0.0
            summary.by_provider[record.provider] += record.cost_usd

            # By task
            if record.task not in summary.by_task:
                summary.by_task[record.task] = 0.0
            summary.by_task[record.task] += record.cost_usd

            # By model
            if record.model not in summary.by_model:
                summary.by_model[record.model] = 0.0
            summary.by_model[record.model] += record.cost_usd

        # Round totals
        summary.total_cost_usd = round(summary.total_cost_usd, 4)
        for key in summary.by_provider:
            summary.by_provider[key] = round(summary.by_provider[key], 4)
        for key in summary.by_task:
            summary.by_task[key] = round(summary.by_task[key], 4)
        for key in summary.by_model:
            summary.by_model[key] = round(summary.by_model[key], 4)

        return summary

    def get_today_summary(self) -> CostSummary:
        """Get cost summary for today."""
        today = date.today()
        return self.get_summary(start_date=today, end_date=today)

    def get_user_total(self, user_id: str) -> float:
        """Get total cost for a specific user."""
        return round(self.user_costs.get(user_id, 0.0), 4)

    def get_alerts(self) -> List[Dict[str, Any]]:
        """Get all triggered alerts."""
        return self._alerts_triggered.copy()

    def estimate_full_generation_cost(self) -> Dict[str, float]:
        """
        Estimate cost for a full property content generation.

        Includes:
        - Public remarks (GPT-4.1 Vision)
        - Walk-thru script (Claude Sonnet 4.5)
        - Features list (Gemini 3 Pro)
        - RESO data (Gemini 3 Pro)
        """
        estimates = {
            "public_remarks": self.calculate_cost("gpt-4.1", 1500, 400),
            "walkthru_script": self.calculate_cost("claude-sonnet-4-20250514", 1000, 800),
            "features": self.calculate_cost("gemini-3-pro-latest", 800, 600),
            "reso_data": self.calculate_cost("gemini-3-pro-latest", 800, 1200)
        }

        estimates["total"] = sum(estimates.values())

        return {k: round(v, 4) for k, v in estimates.items()}

    def to_dict(self) -> Dict[str, Any]:
        """Export tracker state as dictionary."""
        return {
            "total_records": len(self.records),
            "today_summary": {
                "total_cost_usd": self.get_today_summary().total_cost_usd,
                "total_requests": self.get_today_summary().total_requests
            },
            "alerts_count": len(self._alerts_triggered),
            "estimated_full_generation": self.estimate_full_generation_cost()
        }


# Singleton instance
_cost_tracker: Optional[CostTracker] = None


def get_cost_tracker() -> CostTracker:
    """Get or create cost tracker singleton."""
    global _cost_tracker
    if _cost_tracker is None:
        _cost_tracker = CostTracker()
    return _cost_tracker
