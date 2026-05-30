"""
Provider Health Registry
=========================
Thread-safe in-memory stats + circuit breaker for external API providers.

Usage:
    from app.services.provider_health import health_registry

    # Check before calling
    if await health_registry.is_circuit_open("flightaware"):
        return None   # suspended

    # After outcomes
    await health_registry.record_success("flightaware")
    await health_registry.record_failure("flightaware")
    await health_registry.record_timeout("flightaware")
    await health_registry.record_rate_limit("flightaware")

Circuit Breaker Rules:
  - Opens after 5 consecutive failures  → suspends for 30 min
  - Opens after 3 consecutive timeouts  → suspends for 30 min
  - Auto-closes after 30 min cooldown   → resets consecutive counters
  - Any success resets consecutive counters
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# ── Circuit breaker thresholds ─────────────────────────────────────────────────
CIRCUIT_FAILURE_THRESHOLD: int = 5          # consecutive failures
CIRCUIT_TIMEOUT_THRESHOLD: int = 3          # consecutive timeouts
CIRCUIT_COOLDOWN_SECONDS:  int = 1800       # 30-minute suspension


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


class ProviderHealthRegistry:
    """
    Thread-safe, singleton health registry for external flight data providers.

    Tracks per-provider metrics and manages a circuit breaker that
    suspends enrichment for CIRCUIT_COOLDOWN_SECONDS when consecutive
    failures or timeouts exceed their respective thresholds.
    """

    _PROVIDERS = ("flightaware",)

    def __init__(self):
        self._lock = asyncio.Lock()
        self._stats: dict[str, dict] = {
            p: self._fresh_stats() for p in self._PROVIDERS
        }

    @staticmethod
    def _fresh_stats() -> dict:
        return {
            # Lifetime counters
            "total_enrichments":    0,
            "total_misses":         0,
            "total_failures":       0,
            "total_timeouts":       0,
            "total_rate_limits":    0,
            # Recency timestamps
            "last_successful_call": None,   # datetime | None
            "last_rate_limit":      None,   # datetime | None
            "last_error":           None,   # datetime | None
            # Circuit breaker
            "circuit_state":          "CLOSED",  # "CLOSED" | "OPEN"
            "circuit_opened_at":      None,       # datetime | None
            "circuit_closes_at":      None,       # datetime | None
            "consecutive_failures":   0,
            "consecutive_timeouts":   0,
        }

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _maybe_open_circuit(self, provider: str, reason: str) -> None:
        """Open the circuit if a threshold has been reached. Must be called under lock."""
        s = self._stats[provider]
        should_open = (
            s["consecutive_failures"] >= CIRCUIT_FAILURE_THRESHOLD
            or s["consecutive_timeouts"] >= CIRCUIT_TIMEOUT_THRESHOLD
        )
        if should_open and s["circuit_state"] == "CLOSED":
            now = _now_utc()
            closes_at = now + timedelta(seconds=CIRCUIT_COOLDOWN_SECONDS)
            s["circuit_state"]     = "OPEN"
            s["circuit_opened_at"] = now
            s["circuit_closes_at"] = closes_at
            logger.warning(
                f"[FA CIRCUIT OPEN] Provider={provider} reason={reason} "
                f"consecutive_failures={s['consecutive_failures']} "
                f"consecutive_timeouts={s['consecutive_timeouts']} "
                f"suspended_until={closes_at.isoformat()}"
            )

    def _maybe_close_circuit(self, provider: str) -> None:
        """Auto-close the circuit if the cooldown has elapsed. Must be called under lock."""
        s = self._stats[provider]
        if s["circuit_state"] == "OPEN" and s["circuit_closes_at"]:
            closes_at = s["circuit_closes_at"]
            if closes_at.tzinfo is None:
                closes_at = closes_at.replace(tzinfo=timezone.utc)
            if _now_utc() >= closes_at:
                s["circuit_state"]       = "CLOSED"
                s["circuit_opened_at"]   = None
                s["circuit_closes_at"]   = None
                s["consecutive_failures"]= 0
                s["consecutive_timeouts"]= 0
                logger.info(
                    f"[FA CIRCUIT CLOSED] Provider={provider} "
                    f"cooldown elapsed — enrichment resuming"
                )

    # ── Public API ─────────────────────────────────────────────────────────────

    async def is_circuit_open(self, provider: str) -> bool:
        """
        Returns True if the circuit is OPEN and the cooldown has NOT yet elapsed.
        Auto-closes the circuit if the cooldown has elapsed (logs [FA CIRCUIT CLOSED]).
        """
        if provider not in self._stats:
            return False
        async with self._lock:
            self._maybe_close_circuit(provider)
            return self._stats[provider]["circuit_state"] == "OPEN"

    async def record_success(self, provider: str) -> None:
        """Record a successful FA call. Resets consecutive failure/timeout counters."""
        if provider not in self._stats:
            return
        async with self._lock:
            s = self._stats[provider]
            s["total_enrichments"]    += 1
            s["last_successful_call"]  = _now_utc()
            s["consecutive_failures"]  = 0
            s["consecutive_timeouts"]  = 0
            # A success while circuit is OPEN closes it immediately
            if s["circuit_state"] == "OPEN":
                s["circuit_state"]       = "CLOSED"
                s["circuit_opened_at"]   = None
                s["circuit_closes_at"]   = None
                logger.info(
                    f"[FA CIRCUIT CLOSED] Provider={provider} "
                    f"successful call received — circuit closed early"
                )

    async def record_miss(self, provider: str) -> None:
        """Record a FA 404 / no-flight-found miss. Does NOT affect circuit breaker."""
        if provider not in self._stats:
            return
        async with self._lock:
            self._stats[provider]["total_misses"] += 1

    async def record_failure(self, provider: str) -> None:
        """Record a FA API error (non-timeout, non-429). May open circuit."""
        if provider not in self._stats:
            return
        async with self._lock:
            s = self._stats[provider]
            s["total_failures"]      += 1
            s["consecutive_failures"]+= 1
            s["last_error"]           = _now_utc()
            self._maybe_open_circuit(provider, reason="consecutive_failures")

    async def record_timeout(self, provider: str) -> None:
        """Record an HTTP timeout. May open circuit."""
        if provider not in self._stats:
            return
        async with self._lock:
            s = self._stats[provider]
            s["total_timeouts"]      += 1
            s["consecutive_timeouts"]+= 1
            s["last_error"]           = _now_utc()
            self._maybe_open_circuit(provider, reason="consecutive_timeouts")

    async def record_rate_limit(self, provider: str) -> None:
        """Record HTTP 429. Does NOT open circuit (rate-limiting is recoverable)."""
        if provider not in self._stats:
            return
        async with self._lock:
            s = self._stats[provider]
            s["total_rate_limits"] += 1
            s["last_rate_limit"]    = _now_utc()

    async def get_stats(self, provider: str) -> dict:
        """Return a serialisable copy of the provider's health stats."""
        if provider not in self._stats:
            return {}
        async with self._lock:
            self._maybe_close_circuit(provider)
            s = self._stats[provider]
            return {
                "total_enrichments":    s["total_enrichments"],
                "total_misses":         s["total_misses"],
                "total_failures":       s["total_failures"],
                "total_timeouts":       s["total_timeouts"],
                "total_rate_limits":    s["total_rate_limits"],
                "last_successful_call": _iso(s["last_successful_call"]),
                "last_rate_limit":      _iso(s["last_rate_limit"]),
                "last_error":           _iso(s["last_error"]),
                "circuit_state":        s["circuit_state"],
                "circuit_opened_at":    _iso(s["circuit_opened_at"]),
                "circuit_closes_at":    _iso(s["circuit_closes_at"]),
                "consecutive_failures": s["consecutive_failures"],
                "consecutive_timeouts": s["consecutive_timeouts"],
            }

    async def get_all(self) -> dict:
        """Return serialisable health stats for all providers."""
        result = {}
        for provider in self._PROVIDERS:
            result[provider] = await self.get_stats(provider)
        return result


# ── Module-level singleton ─────────────────────────────────────────────────────
health_registry = ProviderHealthRegistry()
