import os
from supabase import create_client, Client, ClientOptions

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Configurable timeout for analytics queries (default 120 seconds)
SUPABASE_QUERY_TIMEOUT = int(os.getenv("SUPABASE_QUERY_TIMEOUT", "120"))

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Missing Supabase environment variables")

# Ensure URL has trailing slash (required by storage client in newer versions)
if not SUPABASE_URL.endswith("/"):
    SUPABASE_URL = SUPABASE_URL + "/"

# Configure client with extended timeout for analytics queries
# Default PostgREST timeout is ~10s which is too short for large datasets
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    options=ClientOptions(
        postgrest_client_timeout=SUPABASE_QUERY_TIMEOUT,
    )
)
