"""Provider contracts for extensible advertising integrations.

Concrete provider adapters must use official APIs and least-privilege scopes.
They must never expose access/refresh tokens to Android clients or logs.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ProviderCapability:
    key: str
    display_name: str
    configured: bool
    supports_read: bool = True
    supports_drafts: bool = True
    supports_write: bool = False


class AdsProvider(ABC):
    """Common interface so future ad networks can be added without UI rewrites."""

    key: str
    display_name: str

    @abstractmethod
    def capability(self) -> ProviderCapability:
        raise NotImplementedError

    @abstractmethod
    async def fetch_campaign_summary(self, account_ref: str) -> dict[str, Any]:
        """Return normalized campaign metrics; implementations call official APIs."""
        raise NotImplementedError

    @abstractmethod
    async def validate_proposed_change(self, account_ref: str, change: dict[str, Any]) -> dict[str, Any]:
        """Validate a proposed change without applying it."""
        raise NotImplementedError

    @abstractmethod
    async def apply_approved_change(self, account_ref: str, change: dict[str, Any], approval_id: str) -> dict[str, Any]:
        """Apply only a previously approved change; concrete adapters must re-check approval."""
        raise NotImplementedError
