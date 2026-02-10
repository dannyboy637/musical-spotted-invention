"""
Reports API routes.

Provides endpoints for generating, previewing, approving, and sending weekly reports.
"""
from typing import Optional, List, Literal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel

from middleware.auth import get_user_with_tenant, UserPayload
from middleware.rate_limit import limiter
from db.supabase import supabase
from modules.reports import generate_report_data, get_period_bounds, PeriodType
from services.ai_narrative import generate_narrative, NarrativeStyle
from services.email import send_report_email

router = APIRouter(prefix="/api/reports", tags=["reports"])


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class ReportResponse(BaseModel):
    """Single report."""
    id: str
    tenant_id: str
    tenant_name: Optional[str] = None
    period_start: str
    period_end: str
    period_type: str = "week"  # week, month, quarter, year
    status: str  # pending, approved, sent
    narrative_style: str  # full, bullets
    narrative_text: Optional[str] = None
    report_data: dict
    created_at: str
    approved_at: Optional[str] = None
    sent_at: Optional[str] = None
    approved_by: Optional[str] = None
    recipient_email: Optional[str] = None


class ReportsListResponse(BaseModel):
    """List of reports."""
    reports: List[ReportResponse]
    total: int


class GenerateReportRequest(BaseModel):
    """Request body for generating a report."""
    tenant_id: str
    period_type: PeriodType = "week"  # week, month, quarter, year
    narrative_style: NarrativeStyle = "full"


class UpdateReportRequest(BaseModel):
    """Request body for updating a report."""
    narrative_text: Optional[str] = None
    narrative_style: Optional[NarrativeStyle] = None


class RegenerateNarrativeRequest(BaseModel):
    """Request body for regenerating narrative."""
    narrative_style: Optional[NarrativeStyle] = None


class SendReportRequest(BaseModel):
    """Request body for sending a report."""
    recipient_email: Optional[str] = None  # Override tenant's default


# ============================================
# HELPER FUNCTIONS
# ============================================

def require_operator(user: UserPayload):
    """Require operator role."""
    if user.role != "operator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only operators can access reports"
        )


def get_tenant_info(tenant_id: str) -> dict:
    """Get tenant name and recipient email."""
    result = supabase.table("tenants").select(
        "name, report_recipient_email"
    ).eq("id", tenant_id).single().execute()
    return result.data or {}


# ============================================
# REPORTS ENDPOINTS
# ============================================

@router.post("/generate", response_model=ReportResponse)
@limiter.limit("20/minute")
async def generate_report(
    request: Request,
    body: GenerateReportRequest,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Generate a new report for a tenant.

    Creates report data, generates AI narrative, and saves as pending.
    Operator only.
    """
    require_operator(user)
    print(f"[generate] Starting report generation for tenant: {body.tenant_id}")

    # Calculate period bounds based on period_type
    start_date, end_date = get_period_bounds(body.period_type)
    print(f"[generate] Period ({body.period_type}): {start_date} to {end_date}")

    # Check for existing report for this period
    print("[generate] Checking for existing report...")
    existing = supabase.table("reports").select("id").eq(
        "tenant_id", body.tenant_id
    ).eq("period_start", start_date).eq("period_end", end_date).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Report already exists for this period. ID: {existing.data[0]['id']}"
        )

    # Get tenant info
    print("[generate] Getting tenant info...")
    tenant_info = get_tenant_info(body.tenant_id)
    tenant_name = tenant_info.get("name", "Restaurant")
    print(f"[generate] Tenant name: {tenant_name}")

    # Generate report data
    print("[generate] Generating report data...")
    try:
        report_data = generate_report_data(
            body.tenant_id, start_date, end_date, period_type=body.period_type
        )
        print(f"[generate] Report data generated. KPIs: {report_data.get('kpis', {})}")
    except Exception as e:
        print(f"[generate] ERROR in generate_report_data: {e}")
        raise

    # Generate AI narrative
    print(f"[generate] Generating narrative (style: {body.narrative_style})...")
    try:
        narrative_text = generate_narrative(
            report_data,
            style=body.narrative_style,
            tenant_name=tenant_name,
        )
        print(f"[generate] Narrative generated ({len(narrative_text)} chars)")
    except Exception as e:
        print(f"[generate] ERROR in generate_narrative: {e}")
        raise

    # Save to database
    print("[generate] Saving to database...")
    insert_data = {
        "tenant_id": body.tenant_id,
        "period_start": start_date,
        "period_end": end_date,
        "period_type": body.period_type,
        "status": "pending",
        "narrative_style": body.narrative_style,
        "narrative_text": narrative_text,
        "report_data": report_data,
    }

    try:
        result = supabase.table("reports").insert(insert_data).execute()
        print(f"[generate] Saved! Report ID: {result.data[0]['id'] if result.data else 'NONE'}")
    except Exception as e:
        print(f"[generate] ERROR in database insert: {e}")
        raise

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create report"
        )

    report = result.data[0]

    return ReportResponse(
        id=report["id"],
        tenant_id=report["tenant_id"],
        tenant_name=tenant_name,
        period_start=report["period_start"],
        period_end=report["period_end"],
        period_type=report.get("period_type", "week"),
        status=report["status"],
        narrative_style=report["narrative_style"],
        narrative_text=report["narrative_text"],
        report_data=report["report_data"],
        created_at=report["created_at"],
        approved_at=report.get("approved_at"),
        sent_at=report.get("sent_at"),
        approved_by=report.get("approved_by"),
        recipient_email=report.get("recipient_email"),
    )


@router.get("", response_model=ReportsListResponse)
async def list_reports(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = Query(None, description="Filter by tenant"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    List reports.

    Operators see all reports. Owners see their tenant's reports.
    """
    query = supabase.table("reports").select("*", count="exact")

    # Filter by role
    if user.role == "operator":
        if tenant_id:
            query = query.eq("tenant_id", tenant_id)
    else:
        # Non-operators only see their tenant's reports
        if not user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No tenant assigned"
            )
        query = query.eq("tenant_id", user.tenant_id)

    if status_filter:
        query = query.eq("status", status_filter)

    query = query.order("created_at", desc=True)
    query = query.range(offset, offset + limit - 1)

    result = query.execute()

    # Get tenant names
    tenant_ids = list(set(r["tenant_id"] for r in (result.data or [])))
    tenant_names = {}
    if tenant_ids:
        tenants_result = supabase.table("tenants").select("id, name").in_("id", tenant_ids).execute()
        tenant_names = {t["id"]: t["name"] for t in (tenants_result.data or [])}

    reports = [
        ReportResponse(
            id=r["id"],
            tenant_id=r["tenant_id"],
            tenant_name=tenant_names.get(r["tenant_id"]),
            period_start=r["period_start"],
            period_end=r["period_end"],
            period_type=r.get("period_type", "week"),
            status=r["status"],
            narrative_style=r["narrative_style"],
            narrative_text=r.get("narrative_text"),
            report_data=r["report_data"],
            created_at=r["created_at"],
            approved_at=r.get("approved_at"),
            sent_at=r.get("sent_at"),
            approved_by=r.get("approved_by"),
            recipient_email=r.get("recipient_email"),
        )
        for r in (result.data or [])
    ]

    return ReportsListResponse(reports=reports, total=result.count or 0)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Get a single report by ID.
    """
    result = supabase.table("reports").select("*").eq("id", report_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    report = result.data

    # Check access
    if user.role != "operator" and report["tenant_id"] != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    tenant_info = get_tenant_info(report["tenant_id"])

    return ReportResponse(
        id=report["id"],
        tenant_id=report["tenant_id"],
        tenant_name=tenant_info.get("name"),
        period_start=report["period_start"],
        period_end=report["period_end"],
        period_type=report.get("period_type", "week"),
        status=report["status"],
        narrative_style=report["narrative_style"],
        narrative_text=report.get("narrative_text"),
        report_data=report["report_data"],
        created_at=report["created_at"],
        approved_at=report.get("approved_at"),
        sent_at=report.get("sent_at"),
        approved_by=report.get("approved_by"),
        recipient_email=report.get("recipient_email"),
    )


@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    body: UpdateReportRequest,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Update a report's narrative text or style.

    Operator only. Only pending reports can be edited.
    """
    require_operator(user)

    # Get current report
    result = supabase.table("reports").select("*").eq("id", report_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    report = result.data

    if report["status"] == "sent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit a sent report"
        )

    # Build update data
    update_data = {}
    if body.narrative_text is not None:
        update_data["narrative_text"] = body.narrative_text
    if body.narrative_style is not None:
        update_data["narrative_style"] = body.narrative_style

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    # Reset approval if edited
    if report["status"] == "approved":
        update_data["status"] = "pending"
        update_data["approved_at"] = None
        update_data["approved_by"] = None

    result = supabase.table("reports").update(update_data).eq("id", report_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update report"
        )

    updated = result.data[0]
    tenant_info = get_tenant_info(updated["tenant_id"])

    return ReportResponse(
        id=updated["id"],
        tenant_id=updated["tenant_id"],
        tenant_name=tenant_info.get("name"),
        period_start=updated["period_start"],
        period_end=updated["period_end"],
        period_type=updated.get("period_type", "week"),
        status=updated["status"],
        narrative_style=updated["narrative_style"],
        narrative_text=updated.get("narrative_text"),
        report_data=updated["report_data"],
        created_at=updated["created_at"],
        approved_at=updated.get("approved_at"),
        sent_at=updated.get("sent_at"),
        approved_by=updated.get("approved_by"),
        recipient_email=updated.get("recipient_email"),
    )


@router.post("/{report_id}/regenerate", response_model=ReportResponse)
async def regenerate_narrative(
    report_id: str,
    body: RegenerateNarrativeRequest = None,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Regenerate AI narrative for a report.

    Operator only. Optionally change narrative style.
    """
    require_operator(user)

    # Get current report
    result = supabase.table("reports").select("*").eq("id", report_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    report = result.data

    if report["status"] == "sent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot regenerate for a sent report"
        )

    # Determine style
    style = report["narrative_style"]
    if body and body.narrative_style:
        style = body.narrative_style

    # Get tenant info
    tenant_info = get_tenant_info(report["tenant_id"])
    tenant_name = tenant_info.get("name", "Restaurant")

    # Regenerate narrative
    new_narrative = generate_narrative(
        report["report_data"],
        style=style,
        tenant_name=tenant_name,
    )

    # Update report
    update_data = {
        "narrative_text": new_narrative,
        "narrative_style": style,
    }

    # Reset approval if regenerated
    if report["status"] == "approved":
        update_data["status"] = "pending"
        update_data["approved_at"] = None
        update_data["approved_by"] = None

    result = supabase.table("reports").update(update_data).eq("id", report_id).execute()

    updated = result.data[0]

    return ReportResponse(
        id=updated["id"],
        tenant_id=updated["tenant_id"],
        tenant_name=tenant_name,
        period_start=updated["period_start"],
        period_end=updated["period_end"],
        period_type=updated.get("period_type", "week"),
        status=updated["status"],
        narrative_style=updated["narrative_style"],
        narrative_text=updated.get("narrative_text"),
        report_data=updated["report_data"],
        created_at=updated["created_at"],
        approved_at=updated.get("approved_at"),
        sent_at=updated.get("sent_at"),
        approved_by=updated.get("approved_by"),
        recipient_email=updated.get("recipient_email"),
    )


@router.post("/{report_id}/approve")
async def approve_report(
    report_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Approve a report.

    Operator only. Marks report as ready to send.
    """
    require_operator(user)

    # Get current report
    result = supabase.table("reports").select("status").eq("id", report_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    if result.data["status"] == "sent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report already sent"
        )

    if result.data["status"] == "approved":
        return {"message": "Report already approved", "report_id": report_id}

    # Approve
    supabase.table("reports").update({
        "status": "approved",
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by": user.sub,
    }).eq("id", report_id).execute()

    return {"message": "Report approved", "report_id": report_id}


@router.post("/{report_id}/send")
@limiter.limit("20/minute")
async def send_report(
    request: Request,
    report_id: str,
    body: SendReportRequest = None,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Send a report via email.

    Operator only. Report must be approved first.
    Uses tenant's report_recipient_email unless overridden.
    """
    require_operator(user)

    # Get report
    result = supabase.table("reports").select("*").eq("id", report_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    report = result.data

    if report["status"] == "sent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report already sent"
        )

    if report["status"] != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report must be approved before sending"
        )

    # Get tenant info
    tenant_info = get_tenant_info(report["tenant_id"])
    tenant_name = tenant_info.get("name", "Restaurant")

    # Determine recipient
    recipient_email = None
    if body and body.recipient_email:
        recipient_email = body.recipient_email
    else:
        recipient_email = tenant_info.get("report_recipient_email")

    if not recipient_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No recipient email configured. Set report_recipient_email for tenant or provide in request."
        )

    # Build subject based on period type
    period_type = report.get("period_type", "week")
    period_label = {
        "week": "Weekly",
        "month": "Monthly",
        "quarter": "Quarterly",
        "year": "Annual",
    }.get(period_type, "Weekly")
    subject = f"{period_label} Report: {tenant_name} ({report['period_start']} to {report['period_end']})"

    # Send email
    email_result = send_report_email(
        to_email=recipient_email,
        subject=subject,
        report_data=report["report_data"],
        narrative=report["narrative_text"] or "",
        tenant_name=tenant_name,
    )

    if not email_result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {email_result.error}"
        )

    # Update report status
    supabase.table("reports").update({
        "status": "sent",
        "sent_at": datetime.utcnow().isoformat(),
        "recipient_email": recipient_email,
    }).eq("id", report_id).execute()

    return {
        "message": "Report sent successfully",
        "report_id": report_id,
        "recipient": recipient_email,
        "message_id": email_result.message_id,
    }


@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Delete a report.

    Operator only. Sent reports cannot be deleted.
    """
    require_operator(user)

    # Get report
    result = supabase.table("reports").select("status").eq("id", report_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    if result.data["status"] == "sent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a sent report"
        )

    supabase.table("reports").delete().eq("id", report_id).execute()

    return {"message": "Report deleted", "report_id": report_id}


# ============================================
# BULK OPERATIONS
# ============================================

@router.post("/generate-all")
@limiter.limit("20/minute")
async def generate_all_reports(
    request: Request,
    user: UserPayload = Depends(get_user_with_tenant),
    narrative_style: NarrativeStyle = "full",
):
    """
    Generate reports for all tenants that don't have one for the current period.

    Operator only. Used for weekly scheduled job.
    Returns count of reports generated.
    """
    require_operator(user)

    start_date, end_date = get_period_bounds('week')
    print(f"[generate-all] Period: {start_date} to {end_date}")

    # Get all tenants
    tenants_result = supabase.table("tenants").select("id, name").execute()
    tenants = tenants_result.data or []
    print(f"[generate-all] Found {len(tenants)} tenants")

    # Get existing reports for this period
    existing_result = supabase.table("reports").select("tenant_id").eq(
        "period_start", start_date
    ).eq("period_end", end_date).execute()
    existing_tenant_ids = {r["tenant_id"] for r in (existing_result.data or [])}

    # Generate for tenants without reports
    generated = 0
    errors = []

    for tenant in tenants:
        if tenant["id"] in existing_tenant_ids:
            continue

        try:
            # Generate report data
            report_data = generate_report_data(tenant["id"], start_date, end_date)

            # Generate narrative
            narrative = generate_narrative(
                report_data,
                style=narrative_style,
                tenant_name=tenant["name"],
            )

            # Save report
            supabase.table("reports").insert({
                "tenant_id": tenant["id"],
                "period_start": start_date,
                "period_end": end_date,
                "period_type": "week",
                "status": "pending",
                "narrative_style": narrative_style,
                "narrative_text": narrative,
                "report_data": report_data,
            }).execute()

            generated += 1

        except Exception as e:
            errors.append({"tenant_id": tenant["id"], "error": str(e)})

    return {
        "message": f"Generated {generated} reports",
        "period": {"start_date": start_date, "end_date": end_date},
        "generated": generated,
        "skipped": len(existing_tenant_ids),
        "errors": errors if errors else None,
    }
