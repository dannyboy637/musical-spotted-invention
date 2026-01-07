"""
Caching utilities for API performance optimization.
Provides TTL-based in-memory caching for database query results.
"""
import hashlib
import json
from typing import TypeVar, Callable, Any, Optional

from cachetools import TTLCache

T = TypeVar('T')


class DataCache:
    """
    Multi-tier TTL caching for API responses.

    TTL Guidelines:
    - short (30s): Rapidly changing data like real-time metrics
    - medium (2min): Semi-static data like settings
    - long (5min): Static data like branches, categories

    Usage:
        from utils.cache import data_cache

        def fetch_branches():
            return supabase.rpc("get_branches", {"tenant_id": tid}).execute().data

        branches = data_cache.get_or_fetch(
            prefix="branches",
            fetch_fn=fetch_branches,
            ttl="long",
            tenant_id=tid  # Include in cache key
        )
    """

    def __init__(self):
        self._short = TTLCache(maxsize=500, ttl=30)     # 30 seconds
        self._medium = TTLCache(maxsize=500, ttl=120)   # 2 minutes
        self._long = TTLCache(maxsize=500, ttl=300)     # 5 minutes

    def _make_key(self, prefix: str, **kwargs) -> str:
        """Generate cache key from prefix and keyword arguments."""
        if not kwargs:
            return prefix
        key_data = json.dumps(kwargs, sort_keys=True)
        key_hash = hashlib.md5(key_data.encode()).hexdigest()[:12]
        return f"{prefix}:{key_hash}"

    def _get_cache(self, ttl: str) -> TTLCache:
        """Get the appropriate cache by TTL name."""
        caches = {
            "short": self._short,
            "medium": self._medium,
            "long": self._long,
        }
        return caches.get(ttl, self._medium)

    def get(self, prefix: str, ttl: str = "medium", **key_params) -> Optional[Any]:
        """
        Get value from cache if it exists.

        Args:
            prefix: Cache key prefix
            ttl: Which TTL cache to use
            **key_params: Parameters to include in cache key

        Returns:
            Cached value or None if not found
        """
        cache = self._get_cache(ttl)
        key = self._make_key(prefix, **key_params)
        return cache.get(key)

    def set(self, value: Any, prefix: str, ttl: str = "medium", **key_params) -> None:
        """
        Store value in cache.

        Args:
            value: Value to cache
            prefix: Cache key prefix
            ttl: Which TTL cache to use
            **key_params: Parameters to include in cache key
        """
        cache = self._get_cache(ttl)
        key = self._make_key(prefix, **key_params)
        cache[key] = value

    def get_or_fetch(
        self,
        prefix: str,
        fetch_fn: Callable[[], T],
        ttl: str = "medium",
        **key_params
    ) -> T:
        """
        Get from cache or fetch and cache the result.

        Args:
            prefix: Cache key prefix (e.g., "branches", "settings")
            fetch_fn: Function to call if cache miss
            ttl: "short" (30s), "medium" (2min), or "long" (5min)
            **key_params: Parameters to include in cache key

        Returns:
            Cached or freshly fetched value
        """
        cache = self._get_cache(ttl)
        key = self._make_key(prefix, **key_params)

        # Cache hit
        if key in cache:
            return cache[key]

        # Cache miss - fetch and store
        result = fetch_fn()
        cache[key] = result
        return result

    def invalidate(self, prefix: str, **key_params) -> None:
        """
        Invalidate a specific cache entry.

        Args:
            prefix: Cache key prefix
            **key_params: Parameters used in the original cache key
        """
        key = self._make_key(prefix, **key_params)
        for cache in [self._short, self._medium, self._long]:
            if key in cache:
                del cache[key]

    def invalidate_prefix(self, prefix: str) -> None:
        """
        Invalidate all entries with a given prefix.
        Useful when underlying data changes significantly.

        Args:
            prefix: Cache key prefix to invalidate
        """
        for cache in [self._short, self._medium, self._long]:
            keys_to_delete = [k for k in cache.keys() if k.startswith(f"{prefix}:") or k == prefix]
            for key in keys_to_delete:
                del cache[key]

    def invalidate_tenant(self, tenant_id: str) -> None:
        """
        Invalidate all entries related to a specific tenant.
        Searches for tenant_id in the cache key hash.

        Args:
            tenant_id: Tenant ID to invalidate
        """
        # Since tenant_id is hashed into the key, we need to clear broadly
        # Clear all analytics-related caches for safety
        for prefix in ["branches", "categories", "analytics", "overview", "menu"]:
            self.invalidate_prefix(prefix)

    def invalidate_all(self) -> None:
        """Clear all caches. Use sparingly."""
        self._short.clear()
        self._medium.clear()
        self._long.clear()

    @property
    def stats(self) -> dict:
        """Get cache statistics for monitoring."""
        return {
            "short_size": self._short.currsize,
            "short_maxsize": self._short.maxsize,
            "medium_size": self._medium.currsize,
            "medium_maxsize": self._medium.maxsize,
            "long_size": self._long.currsize,
            "long_maxsize": self._long.maxsize,
        }


# Global cache instance
data_cache = DataCache()
