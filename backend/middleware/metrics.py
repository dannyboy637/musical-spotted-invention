"""
Metrics collection middleware for API performance monitoring.
Logs response times and status codes for all API requests.
"""
import time
import asyncio
import logging
import traceback
from typing import Optional, Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Endpoints to exclude from metrics (health checks, static files, etc.)
EXCLUDED_ENDPOINTS = {
    "/health",
    "/",
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Threshold for "slow" endpoints (ms)
SLOW_THRESHOLD_MS = 300


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware that collects API performance metrics.
    Logs to database asynchronously to avoid adding latency.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip excluded endpoints and OPTIONS requests (CORS preflights)
        if request.url.path in EXCLUDED_ENDPOINTS or request.method == "OPTIONS":
            return await call_next(request)

        start_time = time.time()
        response = None
        error_occurred = False

        try:
            response = await call_next(request)
            return response
        except Exception as e:
            error_occurred = True
            raise
        finally:
            # Calculate response time
            response_time_ms = int((time.time() - start_time) * 1000)

            # Get status code (500 if exception occurred)
            status_code = 500 if error_occurred else (response.status_code if response else 500)

            # Get tenant_id from request state if available
            tenant_id = getattr(request.state, 'tenant_id', None)

            # Log slow requests
            if response_time_ms > SLOW_THRESHOLD_MS:
                logger.warning(
                    f"Slow request: {request.method} {request.url.path} "
                    f"took {response_time_ms}ms (threshold: {SLOW_THRESHOLD_MS}ms)"
                )

            # Log metric asynchronously (fire and forget)
            asyncio.create_task(
                self._log_metric(
                    tenant_id=tenant_id,
                    endpoint=request.url.path,
                    method=request.method,
                    response_time_ms=response_time_ms,
                    status_code=status_code,
                )
            )

    async def _log_metric(
        self,
        tenant_id: Optional[str],
        endpoint: str,
        method: str,
        response_time_ms: int,
        status_code: int,
    ) -> None:
        """Log metric to database asynchronously."""
        try:
            # Import here to avoid circular imports
            from db.supabase import supabase

            data = {
                "endpoint": endpoint,
                "method": method,
                "response_time_ms": response_time_ms,
                "status_code": status_code,
            }
            if tenant_id:
                data["tenant_id"] = tenant_id

            supabase.table("api_metrics").insert(data).execute()

        except Exception as e:
            # Don't let metrics logging errors affect the request
            logger.error(f"Failed to log API metric: {e}")


async def log_error(
    tenant_id: Optional[str],
    user_id: Optional[str],
    endpoint: str,
    method: str,
    status_code: int,
    error_message: str,
    stack_trace: Optional[str] = None,
    request_body: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    duration_ms: Optional[int] = None,
    send_alert: bool = False,
) -> None:
    """
    Log an error to the error_logs table.

    Args:
        tenant_id: The tenant ID if available
        user_id: The user ID if authenticated
        endpoint: The API endpoint path
        method: HTTP method (GET, POST, etc.)
        status_code: HTTP status code
        error_message: The error message
        stack_trace: Full stack trace if available
        request_body: Request body (sanitized)
        ip_address: Client IP address
        user_agent: Client user agent
        duration_ms: Request duration in milliseconds
        send_alert: Whether to send email alert for this error
    """
    try:
        from db.supabase import supabase

        data = {
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "error_message": error_message,
        }

        if tenant_id:
            data["tenant_id"] = tenant_id
        if user_id:
            data["user_id"] = user_id
        if stack_trace:
            data["stack_trace"] = stack_trace
        if request_body:
            data["request_body"] = request_body
        if ip_address:
            data["ip_address"] = ip_address
        if user_agent:
            data["user_agent"] = user_agent
        if duration_ms is not None:
            data["duration_ms"] = duration_ms

        supabase.table("error_logs").insert(data).execute()

        # Send email alert for critical errors (5xx)
        if send_alert and status_code >= 500:
            asyncio.create_task(
                _send_error_alert(endpoint, method, status_code, error_message)
            )

    except Exception as e:
        logger.error(f"Failed to log error: {e}")


async def _send_error_alert(
    endpoint: str,
    method: str,
    status_code: int,
    error_message: str,
) -> None:
    """Send email alert for critical errors."""
    try:
        import os
        from services.email import EmailResult

        # Only send if configured
        operator_email = os.getenv("OPERATOR_EMAIL")
        if not operator_email:
            logger.debug("OPERATOR_EMAIL not set, skipping error alert")
            return

        # Check if email service is in mock mode
        from services.email import MOCK_MODE, FROM_EMAIL, FROM_NAME

        subject = f"[CRITICAL] API Error: {method} {endpoint}"
        html_content = f"""
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
            <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 16px;">
                <h2 style="margin: 0 0 8px 0; color: #991b1b;">Critical API Error</h2>
                <p style="margin: 0; color: #7f1d1d;">A 5xx error occurred in the Restaurant Analytics API</p>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Endpoint</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{method} {endpoint}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Status Code</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{status_code}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Error</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><pre style="margin: 0; white-space: pre-wrap;">{error_message}</pre></td>
                </tr>
            </table>
            <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
                View details in the <a href="{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/operator">Operator Control Hub</a>
            </p>
        </body>
        </html>
        """

        if MOCK_MODE:
            logger.info(f"[MOCK ERROR ALERT] To: {operator_email}")
            logger.info(f"[MOCK ERROR ALERT] Subject: {subject}")
            return

        # Send via Resend
        try:
            import resend
            api_key = os.getenv("RESEND_API_KEY")
            if api_key:
                resend.api_key = api_key
                resend.Emails.send({
                    "from": f"{FROM_NAME} <{FROM_EMAIL}>",
                    "to": [operator_email],
                    "subject": subject,
                    "html": html_content,
                })
                logger.info(f"Error alert sent to {operator_email}")
        except ImportError:
            logger.warning("resend package not installed, skipping email alert")

    except Exception as e:
        logger.error(f"Failed to send error alert: {e}")


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP from request headers."""
    # Check for forwarded headers (behind proxy)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()

    # Check for real IP header
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip

    # Fall back to client host
    if request.client:
        return request.client.host

    return None


def sanitize_request_body(body: str, max_length: int = 1000) -> str:
    """Sanitize request body for logging (remove sensitive data, truncate)."""
    if not body:
        return ""

    # List of sensitive field names to redact
    sensitive_fields = ["password", "token", "secret", "api_key", "authorization"]

    sanitized = body
    for field in sensitive_fields:
        # Simple redaction - replace value after field name
        import re
        pattern = rf'"{field}"\s*:\s*"[^"]*"'
        sanitized = re.sub(pattern, f'"{field}": "[REDACTED]"', sanitized, flags=re.IGNORECASE)

    # Truncate if too long
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length] + "... [truncated]"

    return sanitized
