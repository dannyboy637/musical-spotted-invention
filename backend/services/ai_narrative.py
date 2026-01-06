"""
AI Narrative Generation Service.

Generates executive summaries for weekly reports using Claude API.
Currently uses mock responses - swap MOCK_MODE to False and add
ANTHROPIC_API_KEY to .env to use real Claude API.
"""
import os
from typing import Literal

# Set to False and add ANTHROPIC_API_KEY to .env for real API
MOCK_MODE = True

NarrativeStyle = Literal["full", "bullets"]


def generate_narrative(
    report_data: dict,
    style: NarrativeStyle = "full",
    tenant_name: str = "the restaurant",
) -> str:
    """
    Generate AI narrative for a report.

    Args:
        report_data: The report data dict (kpis, top_items, etc.)
        style: "full" for 2-3 paragraphs, "bullets" for bullet points
        tenant_name: Name of the restaurant for personalization

    Returns:
        Generated narrative text.
    """
    if MOCK_MODE:
        return _generate_mock_narrative(report_data, style, tenant_name)
    else:
        return _generate_real_narrative(report_data, style, tenant_name)


def _generate_mock_narrative(
    report_data: dict,
    style: NarrativeStyle,
    tenant_name: str,
) -> str:
    """Generate a mock narrative based on the data."""
    kpis = report_data.get("kpis", {})
    top_items = report_data.get("top_items", [])
    gainers = report_data.get("gainers", [])
    decliners = report_data.get("decliners", [])
    alerts = report_data.get("alerts", [])
    period = report_data.get("period", {})

    # Format currency
    def fmt_currency(cents: int) -> str:
        return f"₱{cents / 100:,.0f}"

    revenue = kpis.get("revenue", 0)
    revenue_change = kpis.get("revenue_change_pct", 0)
    transactions = kpis.get("transactions", 0)
    avg_check = kpis.get("avg_check", 0)

    top_item = top_items[0]["item_name"] if top_items else "N/A"
    top_gainer = gainers[0]["item_name"] if gainers else None
    top_gainer_pct = gainers[0]["change_pct"] if gainers else 0
    top_decliner = decliners[0]["item_name"] if decliners else None
    top_decliner_pct = decliners[0]["change_pct"] if decliners else 0

    start_date = period.get("start_date", "")
    end_date = period.get("end_date", "")

    if style == "bullets":
        lines = [
            f"**Weekly Report: {start_date} to {end_date}**",
            "",
        ]

        # Revenue
        direction = "up" if revenue_change >= 0 else "down"
        lines.append(f"- Total revenue: {fmt_currency(revenue)} ({direction} {abs(revenue_change):.1f}% vs last week)")

        # Transactions
        lines.append(f"- Total transactions: {transactions:,}")
        lines.append(f"- Average check: {fmt_currency(avg_check)}")

        # Top performer
        if top_items:
            lines.append(f"- Top performer: {top_item}")

        # Movers
        if top_gainer:
            lines.append(f"- Biggest gainer: {top_gainer} (+{top_gainer_pct:.1f}%)")
        if top_decliner:
            lines.append(f"- Needs attention: {top_decliner} ({top_decliner_pct:.1f}%)")

        # Alerts
        if alerts:
            lines.append(f"- Active alerts: {len(alerts)}")

        return "\n".join(lines)

    else:  # full narrative
        paragraphs = []

        # Opening paragraph - overall performance
        if revenue_change >= 0:
            opening = (
                f"This week was a positive one for {tenant_name}. "
                f"Total revenue reached {fmt_currency(revenue)}, up {abs(revenue_change):.1f}% compared to the previous week. "
                f"The team served {transactions:,} transactions with an average check of {fmt_currency(avg_check)}."
            )
        else:
            opening = (
                f"This week presented some challenges for {tenant_name}. "
                f"Total revenue came in at {fmt_currency(revenue)}, down {abs(revenue_change):.1f}% from the previous week. "
                f"Despite this, the team served {transactions:,} transactions with an average check of {fmt_currency(avg_check)}."
            )
        paragraphs.append(opening)

        # Middle paragraph - highlights and movers
        highlights = []
        if top_items:
            highlights.append(f"{top_item} continues to lead as the top-selling item")
        if top_gainer:
            highlights.append(f"{top_gainer} showed impressive growth with a {top_gainer_pct:.1f}% increase")
        if top_decliner:
            highlights.append(f"{top_decliner} may need attention after declining {abs(top_decliner_pct):.1f}%")

        if highlights:
            middle = "Key highlights: " + "; ".join(highlights) + "."
            paragraphs.append(middle)

        # Closing paragraph - recommendations
        if alerts:
            closing = (
                f"There are currently {len(alerts)} active alerts to review. "
                "Consider addressing these items to maintain performance momentum."
            )
        else:
            closing = (
                "No critical alerts this week. "
                "Keep up the great work and continue monitoring key metrics for opportunities to optimize."
            )
        paragraphs.append(closing)

        return "\n\n".join(paragraphs)


def _generate_real_narrative(
    report_data: dict,
    style: NarrativeStyle,
    tenant_name: str,
) -> str:
    """
    Generate narrative using Claude API.

    Requires ANTHROPIC_API_KEY environment variable.
    """
    try:
        import anthropic
    except ImportError:
        raise RuntimeError(
            "anthropic package not installed. "
            "Run: pip install anthropic"
        )

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set in environment")

    client = anthropic.Anthropic(api_key=api_key)

    # Build the prompt
    if style == "bullets":
        format_instruction = (
            "Write 5-7 bullet points summarizing the key insights. "
            "Start with a bold header line, then list bullets with the '-' character. "
            "Keep each bullet concise (one line)."
        )
    else:
        format_instruction = (
            "Write a 2-3 paragraph executive summary. "
            "First paragraph: overall performance. "
            "Second paragraph: key highlights and movers. "
            "Third paragraph: recommendations or next steps."
        )

    prompt = f"""You are a restaurant analytics assistant. Generate a narrative summary for a weekly report.

Restaurant: {tenant_name}

Report Data:
{_format_report_for_prompt(report_data)}

Instructions:
{format_instruction}

Use Philippine Peso (₱) for currency. Be professional but approachable.
Focus on actionable insights. Don't just repeat numbers - interpret what they mean."""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    return message.content[0].text


def _format_report_for_prompt(report_data: dict) -> str:
    """Format report data as readable text for the prompt."""
    lines = []

    period = report_data.get("period", {})
    lines.append(f"Period: {period.get('start_date')} to {period.get('end_date')}")

    kpis = report_data.get("kpis", {})
    lines.append(f"\nKPIs:")
    lines.append(f"- Revenue: ₱{kpis.get('revenue', 0) / 100:,.0f}")
    lines.append(f"- Revenue change: {kpis.get('revenue_change_pct', 0):+.1f}%")
    lines.append(f"- Transactions: {kpis.get('transactions', 0):,}")
    lines.append(f"- Average check: ₱{kpis.get('avg_check', 0) / 100:,.0f}")

    top_items = report_data.get("top_items", [])
    if top_items:
        lines.append(f"\nTop 5 Items by Revenue:")
        for i, item in enumerate(top_items[:5], 1):
            lines.append(f"{i}. {item['item_name']} - ₱{item.get('revenue', 0) / 100:,.0f}")

    gainers = report_data.get("gainers", [])
    if gainers:
        lines.append(f"\nBiggest Gainers:")
        for item in gainers[:3]:
            lines.append(f"- {item['item_name']}: +{item['change_pct']:.1f}%")

    decliners = report_data.get("decliners", [])
    if decliners:
        lines.append(f"\nBiggest Decliners:")
        for item in decliners[:3]:
            lines.append(f"- {item['item_name']}: {item['change_pct']:.1f}%")

    alerts = report_data.get("alerts", [])
    if alerts:
        lines.append(f"\nActive Alerts ({len(alerts)}):")
        for alert in alerts[:5]:
            lines.append(f"- [{alert['severity'].upper()}] {alert['title']}")

    return "\n".join(lines)
