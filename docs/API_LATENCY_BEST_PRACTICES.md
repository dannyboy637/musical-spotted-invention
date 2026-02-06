# API & Endpoint Latency Best Practices

> Portable playbook extracted from production experience on FastAPI + PostgreSQL + Fly.io.
> Apply to any Python API project connecting to a managed PostgreSQL provider.

---

## Table of Contents

1. [Diagnose Before Optimizing](#1-diagnose-before-optimizing)
2. [Connection Overhead Is the Real Problem](#2-connection-overhead-is-the-real-problem)
3. [Query Consolidation with CTEs](#3-query-consolidation-with-ctes)
4. [CTE Pitfalls to Avoid](#4-cte-pitfalls-to-avoid)
5. [Pool Warming on Startup](#5-pool-warming-on-startup)
6. [Auth Dependency Optimization](#6-auth-dependency-optimization)
7. [In-Memory TTL Caching](#7-in-memory-ttl-caching)
8. [Slow Request Logging](#8-slow-request-logging)
9. [Database Index Strategy](#9-database-index-strategy)
10. [Window Functions for Navigation](#10-window-functions-for-navigation)
11. [Decision Framework](#11-decision-framework)
12. [Measuring Impact](#12-measuring-impact)

---

## 1. Diagnose Before Optimizing

Don't guess. Identify the bottleneck category first.

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| All queries take ~200ms regardless of complexity | Connection overhead (SSL + auth) | Query consolidation |
| Simple queries fast, complex queries slow | Actual query execution time | Indexes, query optimization |
| First request slow, subsequent ones fast | Cold connection pool | Pool warming |
| Random spikes in latency | Pool exhaustion | Increase pool size or use NullPool |
| Consistent slowness on one endpoint | N+1 queries or missing joins | Consolidate queries, add joinedload |

**Step 1:** Add SQL timing logs. If `SELECT 1` takes 200ms, the problem is connection latency, not your query.

**Step 2:** Check if all queries have a similar baseline. If yes, consolidation will help more than indexing.

---

## 2. Connection Overhead Is the Real Problem

When connecting to a managed PostgreSQL provider (Supabase, RDS, Neon, etc.) over the network, each round-trip costs:

- ~200ms on Fly.io to Supabase (SSL handshake + PG auth)
- ~50-100ms within the same cloud region
- ~5-20ms within the same VPC/private network

**The math that changes everything:**

```
5 sequential queries x 200ms overhead = 1,000ms total
1 consolidated query x 200ms overhead =   200ms total  (5x faster)
```

This means **reducing the number of queries matters more than optimizing individual queries** when connection overhead dominates.

---

## 3. Query Consolidation with CTEs

### The Pattern

Replace sequential ORM queries with a single CTE-based raw SQL query.

**Before (5 round-trips, ~1000ms):**
```python
farm = await db.execute(select(Farm).where(Farm.id == farm_id))
ponds = await db.execute(select(Pond).where(Pond.farm_id == farm_id))
cycles = await db.execute(select(Cycle).where(Cycle.status == "active"))
readings = await db.execute(select(WaterReading).where(...))
count = await db.execute(select(func.count()).where(...))
```

**After (1 round-trip, ~200ms):**
```python
query = text("""
    WITH entity AS (
        SELECT id, name, settings
        FROM farms WHERE id = :farm_id AND deleted_at IS NULL
    ),
    children AS (
        SELECT id, name, status
        FROM ponds WHERE farm_id = :farm_id AND deleted_at IS NULL
        ORDER BY name
    ),
    active_items AS (
        SELECT id, pond_id, start_date
        FROM cycles
        WHERE farm_id = :farm_id AND status = 'active' AND deleted_at IS NULL
    ),
    latest_data AS (
        SELECT DISTINCT ON (cycle_id)
            id, cycle_id, reading_date, value
        FROM readings
        WHERE deleted_at IS NULL
        ORDER BY cycle_id, reading_date DESC
    ),
    counts AS (
        SELECT COUNT(*) as cnt FROM readings
        WHERE farm_id = :farm_id AND reading_date = :today AND deleted_at IS NULL
    )
    SELECT 'entity' AS _type, e.id::text, e.name, NULL, NULL
    FROM entity e
    UNION ALL
    SELECT 'child' AS _type, c.id::text, c.name, ac.id::text, ld.reading_date::text
    FROM children c
    LEFT JOIN active_items ac ON ac.pond_id = c.id
    LEFT JOIN latest_data ld ON ld.cycle_id = ac.id
    UNION ALL
    SELECT 'count' AS _type, cnt::text, NULL, NULL, NULL
    FROM counts
""")

result = await db.execute(query, {"farm_id": str(farm_id), "today": today})
rows = result.fetchall()

# Parse rows by _type discriminator
for row in rows:
    if row._type == "entity":
        ...
    elif row._type == "child":
        ...
```

### Key Techniques

1. **UNION ALL with type discriminator** - Return heterogeneous data in one result set. Use a `_type` column to distinguish row types.

2. **DISTINCT ON for "latest per group"** - PostgreSQL-specific, extremely useful:
   ```sql
   SELECT DISTINCT ON (group_col)
       group_col, value, date
   FROM table
   ORDER BY group_col, date DESC
   ```

3. **Conditional aggregation** - Multiple aggregations in one pass:
   ```sql
   SELECT
       SUM(CASE WHEN date = :today THEN amount ELSE 0 END) AS today_total,
       SUM(CASE WHEN date >= :week_start THEN amount ELSE 0 END) AS week_total,
       SUM(amount) AS all_time_total
   FROM records WHERE deleted_at IS NULL
   ```

### Real-World Impact

| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| Dashboard overview | 5 queries, ~1000ms | 1 CTE, ~200ms | 80% faster |
| Detail page | 8 queries, ~1600ms | 1 CTE, ~210ms | 87% faster |
| Entry checklist | 6 queries, ~1200ms | 1 CTE, ~200ms | 83% faster |

---

## 4. CTE Pitfalls to Avoid

### The NULL vs Not Found Bug

CTEs with subselects return NULL both when the CTE is empty (entity not found) AND when the column value is NULL.

```sql
-- BAD: Can't tell "not found" from "found but column is NULL"
(SELECT settings::text FROM entity_data) AS settings

-- GOOD: NULL = not found, '{}' = found but settings is NULL
CASE
    WHEN EXISTS (SELECT 1 FROM entity_data)
    THEN COALESCE((SELECT settings::text FROM entity_data), '{}')
    ELSE NULL
END AS settings
```

### Test Mocks Break on ORM-to-CTE Migration

When switching from ORM queries to raw SQL:

- Mock result objects need a `fetchall()` method (not just `scalars()`)
- Mock data changes from ORM model instances to raw tuples matching SQL column order
- Module-level caches persist across tests - always clear them in fixtures

```python
# Test fixture cleanup
@pytest.fixture(autouse=True)
def clear_caches():
    _my_cache.invalidate()  # Clear before each test
    yield
    _my_cache.invalidate()  # Clear after each test
```

### When NOT to Consolidate

- **Writes** - Keep transactions focused and simple
- **Queries needing different error handling** - If query A failing should return 404 but query B failing should return 500
- **When CTE complexity hurts maintainability** more than the latency matters (low-traffic endpoints)

---

## 5. Pool Warming on Startup

On platforms with suspend/resume (Fly.io, Railway, Render), the connection pool is empty after cold start. Pre-warm it before accepting requests.

### FastAPI Implementation

```python
from contextlib import asynccontextmanager
import time
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up connection pool before accepting requests
    try:
        async with async_session() as db:
            start = time.perf_counter()
            await db.execute(text("SELECT 1"))
            elapsed = (time.perf_counter() - start) * 1000
            logger.info(f"Pool warmed in {elapsed:.0f}ms")
    except Exception as e:
        logger.warning(f"Pool warm-up failed: {e}")

    yield
    # Shutdown cleanup here

app = FastAPI(lifespan=lifespan)
```

### Why It Matters

Without warming, the first real user request pays the full SSL handshake + PG authentication cost (~200-400ms extra). With warming, that cost is absorbed during startup before any user traffic arrives.

---

## 6. Auth Dependency Optimization

Auth runs on **every request**. Even small inefficiencies compound.

### The Problem: N+1 in Auth

```python
# BAD: Auth fetches user, then role checker does another query
async def get_current_user(db, token):
    user = await db.execute(select(User).where(User.id == user_id))
    return user  # No role data loaded

# Role checker hits DB again
async def check_role(user, db):
    memberships = await db.execute(
        select(Membership).where(Membership.user_id == user.id)
    )  # +200ms on every request!
```

### The Fix: Eager Load in Auth

```python
# GOOD: Load roles with the user in one query
async def get_current_user(db, token):
    result = await db.execute(
        select(User)
        .options(joinedload(User.memberships))
        .where(User.id == user_id)
    )
    user = result.unique().scalar_one_or_none()
    return user  # Memberships already loaded, role checks are in-memory
```

**Impact:** Saves ~200ms on every authenticated request. On a dashboard loading 5 API calls, that's 1 second saved.

---

## 7. In-Memory TTL Caching

Use short-lived caches to smooth bursty reads (e.g., dashboard loads that hit the same endpoint multiple times in quick succession).

### Implementation

```python
import time
from typing import Any, Optional, Callable

class TTLCache:
    """Single-process TTL cache. NOT suitable for multi-instance deployments."""

    def __init__(self, ttl_seconds: int, max_entries: int) -> None:
        self._cache: dict[Any, tuple[float, Any]] = {}
        self._ttl = ttl_seconds
        self._max = max_entries

    def get(self, key: Any) -> Optional[Any]:
        entry = self._cache.get(key)
        if entry and (time.monotonic() - entry[0]) < self._ttl:
            return entry[1]
        return None

    def set(self, key: Any, value: Any) -> None:
        if len(self._cache) >= self._max:
            self._cache.clear()  # Simple eviction: clear all on overflow
        self._cache[key] = (time.monotonic(), value)

    def invalidate(self, key: Any = None) -> None:
        if key is None:
            self._cache.clear()
        else:
            self._cache.pop(key, None)

    def invalidate_matching(self, predicate: Callable[[Any], bool]) -> None:
        keys = [k for k in self._cache if predicate(k)]
        for k in keys:
            self._cache.pop(k, None)
```

### Usage Pattern

```python
_detail_cache = TTLCache(ttl_seconds=45, max_entries=200)

@router.get("/{item_id}")
async def get_detail(item_id: UUID, db: AsyncSession = Depends(get_db)):
    cached = _detail_cache.get(item_id)
    if cached is not None:
        return cached

    # ... expensive query ...

    response = make_response(data=result)
    _detail_cache.set(item_id, response)
    return response

# Explicit invalidation on writes
@router.put("/{item_id}")
async def update_item(item_id: UUID, ...):
    # ... update logic ...
    _detail_cache.invalidate(item_id)
    return updated
```

### TTL Guidelines

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Dashboard overview | 45s | Changes on data entry, users expect near-real-time |
| List endpoints | 60s | Slightly stale is fine for lists |
| Reference data (settings, config) | 300s | Rarely changes |
| User-specific data | 30-45s | Balance freshness with performance |

### When to Use Redis Instead

| Scenario | In-Memory TTLCache | Redis |
|----------|-------------------|-------|
| Single instance deployment | Use this | Overkill |
| Multi-instance / auto-scaling | Cache misses across instances | Required |
| Cache > 100MB | Memory pressure | Better fit |
| Need cache persistence across deploys | Lost on restart | Persists |

---

## 8. Slow Request Logging

You can't optimize what you can't measure. Add middleware to flag slow requests.

### FastAPI Middleware

```python
import time
from starlette.requests import Request

@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000

    if elapsed_ms >= SLOW_THRESHOLD_MS:
        logger.warning(
            "Slow request %s %s -> %d in %.0fms",
            request.method, request.url.path, response.status_code, elapsed_ms,
        )

    return response
```

### SQL Timing (SQLAlchemy Events)

```python
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "before_cursor_execute")
def before_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info["query_start"] = time.perf_counter()

@event.listens_for(engine.sync_engine, "after_cursor_execute")
def after_execute(conn, cursor, statement, parameters, context, executemany):
    elapsed = (time.perf_counter() - conn.info["query_start"]) * 1000
    if elapsed > SQL_SLOW_THRESHOLD_MS:
        logger.warning("Slow SQL (%.0fms): %s", elapsed, statement[:200])
```

### Analyzing Logs

```bash
# Find slowest endpoints
grep "Slow request" app.log | awk '{print $5, $6}' | sort | uniq -c | sort -rn

# Find slowest queries
grep "Slow SQL" app.log | sort | uniq -c | sort -rn
```

---

## 9. Database Index Strategy

### Principles

1. **Partial indexes for soft-delete** - Only index active rows:
   ```sql
   CREATE INDEX idx_items_active
     ON items (tenant_id, created_at)
     WHERE deleted_at IS NULL;
   ```
   Smaller index, faster scans, automatically excludes soft-deleted rows.

2. **Composite index column order matters:**
   - Equality filters first (tenant_id, status)
   - Range/sort columns last (date DESC, created_at)
   ```sql
   -- Matches: WHERE tenant_id = ? AND status = ? ORDER BY date DESC
   CREATE INDEX idx_readings
     ON readings (tenant_id, status, date DESC)
     WHERE deleted_at IS NULL;
   ```

3. **Small tables don't need indexes** - Under ~100 rows, sequential scan is often faster than index overhead.

4. **Don't blindly drop "unused" indexes:**
   - Many back unique constraints (can't drop without dropping the constraint)
   - Usage stats reset on DB restart
   - Low-traffic paths show low usage but still need the index

### When to Add Indexes

- After identifying slow queries in production logs (see section 8)
- Tables > 1,000 rows with frequent filtered queries
- When `EXPLAIN ANALYZE` shows Seq Scan on large tables
- After adding new query patterns (new filters, new sort orders)

---

## 10. Window Functions for Navigation

Replace multiple queries for "previous/next" navigation with a single window function query.

**Before (3 queries):**
```python
current = await db.execute(select(Item).where(Item.id == item_id))
prev = await db.execute(
    select(Item).where(Item.name < current.name).order_by(Item.name.desc()).limit(1)
)
next = await db.execute(
    select(Item).where(Item.name > current.name).order_by(Item.name).limit(1)
)
```

**After (1 query):**
```sql
WITH ordered AS (
    SELECT id, name,
           LAG(id)   OVER (ORDER BY name) AS prev_id,
           LAG(name) OVER (ORDER BY name) AS prev_name,
           LEAD(id)   OVER (ORDER BY name) AS next_id,
           LEAD(name) OVER (ORDER BY name) AS next_name
    FROM items
    WHERE tenant_id = :tenant_id AND deleted_at IS NULL
)
SELECT prev_id, prev_name, next_id, next_name
FROM ordered WHERE id = :item_id
```

---

## 11. Decision Framework

### What to Optimize First

```
1. Connection overhead        → Query consolidation (biggest wins)
2. Auth dependency             → Eager loading (saves per-request)
3. N+1 queries in endpoints   → Batch queries or CTEs
4. Repeated reads              → TTL caching
5. Slow individual queries     → Indexes, EXPLAIN ANALYZE
```

### Optimization vs Caching

| Scenario | Approach |
|----------|----------|
| Sequential queries to same DB | **Consolidate queries** (always wins) |
| Expensive aggregations | Cache or materialized views |
| Rarely-changing reference data | Cache with longer TTL |
| User-specific data | Query optimization first, short TTL cache second |

**Rule of thumb:** Optimize queries first, cache second. Caching adds complexity and staleness risk.

---

## 12. Measuring Impact

### Before/After Template

```
Endpoint: GET /api/v1/items/{id}/detail
Before:   8 queries, p50=1,600ms, p99=2,400ms
After:    1 CTE,     p50=210ms,   p99=380ms
Change:   87% faster, 7 fewer round-trips
```

### Key Metrics to Track

| Metric | Where | Target |
|--------|-------|--------|
| p50 response time | Request logs | < 300ms |
| p99 response time | Request logs | < 1,000ms |
| Queries per request | SQL logs | 1-3 (consolidated) |
| Cold start time | Startup logs | < 2,000ms |
| Cache hit rate | Cache metrics | > 60% for read-heavy endpoints |

### Configuration

```python
# settings.py
class Settings(BaseSettings):
    slow_request_threshold_ms: int = 500
    slow_sql_threshold_ms: int = 200
    log_request_timing: bool = True
    log_sql_timing: bool = False  # Enable in staging, not prod
```

---

## Quick Reference Card

| Problem | Solution | Impact |
|---------|----------|--------|
| All queries ~200ms | Consolidate into 1 CTE | 5-8x faster |
| First request slow | Pool warming at startup | ~200ms saved |
| Auth adds latency | joinedload in auth dependency | ~200ms/request |
| Dashboard burst reads | TTL cache (45-60s) | Near-instant on cache hit |
| prev/next navigation | LAG/LEAD window functions | 3x fewer queries |
| Diagnosing slowness | Slow request middleware | Identifies bottlenecks |
| Index on deleted rows | Partial index (WHERE deleted_at IS NULL) | Smaller, faster index |

---

*Extracted from production experience: FastAPI + PostgreSQL (Supabase) + Fly.io, Feb 2026*
