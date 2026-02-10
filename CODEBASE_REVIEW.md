# Codebase Review (Deep Dive)

Date: 2026-02-03

This document captures the in-depth review of the current codebase, including discrepancies, tech debt, and optimization opportunities.

## Findings (Ordered by Severity)

### High Severity
1. `backend/middleware/auth.py` — JWT verification accepts both `ES256` and `HS256`. With a public JWK, accepting `HS256` can enable algorithm‑confusion attacks. Recommendation: lock verification to the JWK’s declared `alg` (likely `ES256` only) and validate `iss` against your Supabase URL.
2. `backend/routes/analytics.py` — `fetch_all_transactions` caps results (`max_rows` defaults to 500k, and some endpoints use 100k/200k) and silently truncates analytics for larger tenants. Endpoints like category items and category‑by‑branch will return incorrect numbers at scale, and the Python aggregation is memory‑heavy.
3. `backend/modules/reports.py` — `_get_top_items` identifies items from the selected period but pulls revenue from `menu_items` (all‑time). This makes report “Top Items” incorrect for the reporting window and can mislead clients.

### Medium Severity
1. `backend/routes/analytics.py` — `get_menu_engineering` ignores `start_date`, `end_date`, and `branches`, so filtered UI results are actually all‑time.
2. `backend/routes/analytics.py` — `include_excluded` and `day_filter` params are accepted but unused, so callers get silently ignored filters.
3. `backend/routes/analytics.py` — `get_overview` computes `unique_items` from `menu_items` (all‑time), not the filtered date range, so KPIs can contradict the selected period.
4. `backend/routes/data.py` — `get_transactions_summary` passes `tenant_id=None` for operators without an active tenant; depending on the RPC this may error or compute cross‑tenant totals.
5. `backend/routes/data.py` — `data_health_check` queries `transactions.date`, but `transactions` has no `date` column in the schema, so it will throw and always return a degraded status.
6. `backend/middleware/metrics.py` — `asyncio.create_task` wraps sync Supabase calls, which still block the event loop and can spawn unbounded tasks under load.
7. `backend/routes/alerts.py` — `trigger_scan` runs a full anomaly scan synchronously inside the request; on large tenants this can time out and block the API.
8. `frontend/src/lib/queryClient.ts` — 401 handling doesn’t check `AxiosError.response.status`, so auth failures may not redirect to login.
9. `frontend/src/stores/filterStore.ts` and `frontend/src/hooks/useAnalytics.ts` — using `toISOString()` for date filters can shift dates for non‑UTC timezones, causing off‑by‑one day queries.
10. `frontend/src/hooks/useReports.ts` — reports are hidden for owners (`enabled` only for operators), while the backend allows owners to list their tenant’s reports.
11. `backend/routes/auto_fetch.py` — the secret token is passed via query string, which can leak via logs or proxies; prefer a header or POST body.
12. `backend/middleware/rate_limit.py` and `backend/middleware/metrics.py` — both expect `request.state.user` / `request.state.tenant_id`, but no middleware sets these; per‑user rate limiting and metric attribution won’t work as documented.

### Low Severity / Tech Debt
1. `backend/services/ai_narrative.py` and `backend/services/email.py` — `MOCK_MODE = True` is hard‑coded, so production can’t enable real narratives or email via env as docs imply.
2. `frontend/src/modules/costs/mockCostData.ts` and `frontend/src/modules/operator/components/ToolsTab/NaturalLanguageQuery.tsx` — production‑visible features still operate on mock data.
3. `frontend/src/stores/authStore.ts` — `onAuthStateChange` subscription is never unsubscribed; if `initialize` runs more than once, listeners can leak.
4. `backend/routes/tenant.py` — mutable default `settings: Optional[dict] = {}` should be `Field(default_factory=dict)` to avoid shared state.
5. `backend/middleware/rate_limit.py` — uses Python `hash()` for token bucketing, which changes per process; consider a stable hash (e.g., SHA‑256).
6. `backend/routes/reports.py` and `backend/routes/data.py` — heavy `print` logging in production paths; use structured logging to control verbosity and avoid leaking data.
7. `backend/requirements.txt` — missing an explicit `PyJWT` dependency even though `backend/middleware/auth.py` imports `jwt.PyJWK`; if this is only transitively installed, upgrades could break auth.

## Discrepancies (Docs vs Code)
1. `docs/standards/DATABASE.md` says migrations live in `supabase/migrations`, but the repo and `CLAUDE.md` place them in `backend/migrations`.
2. `docs/CURRENT_CONTEXT.md` states the theme toggle was removed (light only), but `frontend/src/stores/settingsStore.ts` and `frontend/src/hooks/useTheme.ts` still implement system/dark themes.
3. `CLAUDE.md` claims middleware “extracts tenant context on every request,” but no middleware sets `request.state.user` or `request.state.tenant_id`.

## Optimization Opportunities
1. Replace `fetch_all_transactions` usage in `backend/routes/analytics.py` with SQL/RPC aggregations backed by summary tables; this eliminates silent truncation and reduces memory pressure.
2. Move CSV imports and anomaly scans to a worker queue (RQ/Celery/Sidekiq‑style) and store progress in DB; keep API requests responsive.
3. Run Supabase writes from middleware in a threadpool or use an async client to avoid blocking the event loop.
4. Add a shared frontend API client (Axios instance or fetch wrapper) to inject auth headers, normalize errors, and centralize retry/401 handling.
5. Serialize dates using local date strings (e.g., `format(date, 'yyyy-MM-dd')`) instead of `toISOString()` to avoid timezone shifts.
6. Add composite indexes for common filters if not already covered (tenant_id + store_name + receipt_timestamp, tenant_id + category + receipt_timestamp).

## Test Gaps
There are no automated tests in `backend` or `frontend`. I did not run tests.

## Open Questions / Assumptions
1. Should operators without an active tenant see cross‑tenant analytics, or should those endpoints require an explicit tenant? This affects `backend/routes/data.py` and `backend/routes/analytics.py`.
2. Should owners have UI access to reports, or is operator‑only intended? This is inconsistent between `frontend/src/hooks/useReports.ts` and `backend/routes/reports.py`.
3. Do you want `MOCK_MODE` controlled by environment (production‑toggle) or permanently mocked?

## Next Steps
1. Fix high‑severity issues first (JWT verification hardening, report top‑items correctness, analytics truncation) and open a PR.
2. Or focus on performance work (new RPCs for category endpoints and moving imports/scans to a background worker).
