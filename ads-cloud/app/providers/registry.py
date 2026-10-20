"""Central provider registry. New advertising platforms register here."""
from dataclasses import dataclass
from typing import Iterable

from .base import ProviderCapability


@dataclass(frozen=True)
class ProviderConfig:
    key: str
    display_name: str
    configured: bool


class ProviderRegistry:
    def __init__(self, providers: Iterable[ProviderConfig] = ()) -> None:
        self._providers = {provider.key: provider for provider in providers}

    def list_capabilities(self) -> list[ProviderCapability]:
        return [
            ProviderCapability(
                key=p.key,
                display_name=p.display_name,
                configured=p.configured,
                supports_read=p.configured,
                supports_drafts=True,
                # Writes remain unavailable until a real adapter and approval store exist.
                supports_write=False,
            )
            for p in self._providers.values()
        ]

    def get(self, key: str) -> ProviderConfig | None:
        return self._providers.get(key)
