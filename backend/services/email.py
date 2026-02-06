"""
Email Service using Resend.

Sends formatted weekly reports via email.
Set RESEND_API_KEY in .env to enable actual sending.
"""
import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Set EMAIL_MOCK_MODE=false and add RESEND_API_KEY to enable real sending
MOCK_MODE = os.getenv("EMAIL_MOCK_MODE", "true").lower() == "true"

# Email configuration
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "reports@yourdomain.com")
FROM_NAME = os.getenv("RESEND_FROM_NAME", "Restaurant Analytics")


class EmailResult:
    """Result of an email send attempt."""
    def __init__(self, success: bool, message_id: Optional[str] = None, error: Optional[str] = None):
        self.success = success
        self.message_id = message_id
        self.error = error


def send_report_email(
    to_email: str,
    subject: str,
    report_data: dict,
    narrative: str,
    tenant_name: str,
) -> EmailResult:
    """
    Send a weekly report email.

    Args:
        to_email: Recipient email address
        subject: Email subject line
        report_data: The report data dict
        narrative: AI-generated narrative text
        tenant_name: Name of the restaurant

    Returns:
        EmailResult with success status and message_id or error
    """
    html_content = _build_report_html(report_data, narrative, tenant_name)

    if MOCK_MODE:
        return _send_mock_email(to_email, subject, html_content)
    else:
        return _send_resend_email(to_email, subject, html_content)


def _send_mock_email(to_email: str, subject: str, html_content: str) -> EmailResult:
    """Mock email sending - logs instead of actually sending."""
    logger.info(f"[MOCK EMAIL] To: {to_email}")
    logger.info(f"[MOCK EMAIL] Subject: {subject}")
    logger.info(f"[MOCK EMAIL] Content length: {len(html_content)} chars")

    # Generate a fake message ID
    import uuid
    mock_id = f"mock_{uuid.uuid4().hex[:16]}"

    return EmailResult(success=True, message_id=mock_id)


def _send_resend_email(to_email: str, subject: str, html_content: str) -> EmailResult:
    """Send email via Resend API."""
    try:
        import resend
    except ImportError:
        return EmailResult(
            success=False,
            error="resend package not installed. Run: pip install resend"
        )

    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return EmailResult(
            success=False,
            error="RESEND_API_KEY not set in environment"
        )

    resend.api_key = api_key

    try:
        response = resend.Emails.send({
            "from": f"{FROM_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        })

        return EmailResult(
            success=True,
            message_id=response.get("id")
        )

    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return EmailResult(
            success=False,
            error=str(e)
        )


def _build_report_html(report_data: dict, narrative: str, tenant_name: str) -> str:
    """Build HTML email content for the report."""
    kpis = report_data.get("kpis", {})
    top_items = report_data.get("top_items", [])
    gainers = report_data.get("gainers", [])
    decliners = report_data.get("decliners", [])
    alerts = report_data.get("alerts", [])
    period = report_data.get("period", {})

    def fmt_currency(cents: int) -> str:
        return f"₱{cents / 100:,.0f}"

    def fmt_pct(pct: float) -> str:
        if pct >= 0:
            return f'<span style="color: #22c55e;">+{pct:.1f}%</span>'
        else:
            return f'<span style="color: #ef4444;">{pct:.1f}%</span>'

    # Convert markdown-style narrative to HTML
    narrative_html = narrative.replace("\n\n", "</p><p>").replace("\n- ", "</li><li>")
    if "- " in narrative:
        narrative_html = narrative_html.replace("- ", "<ul><li>", 1)
        if "</li>" in narrative_html:
            narrative_html += "</li></ul>"
    narrative_html = f"<p>{narrative_html}</p>"
    narrative_html = narrative_html.replace("**", "")  # Remove markdown bold

    # Build top items table
    top_items_html = ""
    if top_items:
        rows = "".join([
            f'<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{i+1}</td>'
            f'<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{item["item_name"]}</td>'
            f'<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">{fmt_currency(item.get("revenue", 0))}</td></tr>'
            for i, item in enumerate(top_items[:5])
        ])
        top_items_html = f'''
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <thead>
                <tr style="background: #f3f4f6;">
                    <th style="padding: 8px; text-align: left;">#</th>
                    <th style="padding: 8px; text-align: left;">Item</th>
                    <th style="padding: 8px; text-align: right;">Revenue</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        '''

    # Build alerts section
    alerts_html = ""
    if alerts:
        alert_items = "".join([
            f'<li style="margin: 8px 0;"><strong>[{a["severity"].upper()}]</strong> {a["title"]}</li>'
            for a in alerts[:5]
        ])
        alerts_html = f'''
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; color: #92400e;">Alerts ({len(alerts)})</h3>
            <ul style="margin: 0; padding-left: 20px;">{alert_items}</ul>
        </div>
        '''

    # Movers section
    movers_html = ""
    if gainers or decliners:
        movers_items = ""
        if gainers:
            for g in gainers[:3]:
                movers_items += f'<span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; margin: 4px;">{g["item_name"]} +{g["change_pct"]:.1f}%</span> '
        if decliners:
            for d in decliners[:3]:
                movers_items += f'<span style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; margin: 4px;">{d["item_name"]} {d["change_pct"]:.1f}%</span> '
        movers_html = f'<div style="margin: 16px 0;">{movers_items}</div>'

    html = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Report - {tenant_name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
    <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 24px;">
            <h1 style="margin: 0; font-size: 24px;">{tenant_name}</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Weekly Performance Report</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.8;">{period.get("start_date", "")} to {period.get("end_date", "")}</p>
        </div>

        <!-- KPIs -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e5e7eb;">
            <div style="background: white; padding: 16px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #1e3a5f;">{fmt_currency(kpis.get("revenue", 0))}</div>
                <div style="font-size: 12px; color: #6b7280;">Revenue</div>
                <div style="font-size: 14px;">{fmt_pct(kpis.get("revenue_change_pct", 0))}</div>
            </div>
            <div style="background: white; padding: 16px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #1e3a5f;">{kpis.get("transactions", 0):,}</div>
                <div style="font-size: 12px; color: #6b7280;">Transactions</div>
                <div style="font-size: 14px;">{fmt_pct(kpis.get("transactions_change_pct", 0))}</div>
            </div>
            <div style="background: white; padding: 16px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #1e3a5f;">{fmt_currency(kpis.get("avg_check", 0))}</div>
                <div style="font-size: 12px; color: #6b7280;">Avg Check</div>
                <div style="font-size: 14px;">{fmt_pct(kpis.get("avg_check_change_pct", 0))}</div>
            </div>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
            <!-- Narrative -->
            <div style="margin-bottom: 24px;">
                {narrative_html}
            </div>

            <!-- Top Items -->
            <h2 style="font-size: 18px; color: #1e3a5f; border-bottom: 2px solid #d4af37; padding-bottom: 8px;">Top Performers</h2>
            {top_items_html}

            <!-- Movers -->
            {movers_html}

            <!-- Alerts -->
            {alerts_html}
        </div>

        <!-- Footer -->
        <div style="background: #f3f4f6; padding: 16px; text-align: center; font-size: 12px; color: #6b7280;">
            <p style="margin: 0;">Generated by Restaurant Analytics</p>
            <p style="margin: 4px 0 0 0;">Report generated at {report_data.get("generated_at", "")}</p>
        </div>
    </div>
</body>
</html>
'''
    return html
