"""Deterministic campaign analysis helpers."""

def analyze_campaign(metrics: dict) -> dict:
    impressions = int(metrics.get("impressions", 0))
    clicks = int(metrics.get("clicks", 0))
    spend = float(metrics.get("spend", 0))
    ctr = round(clicks / impressions * 100, 2) if impressions else None
    cpc = round(spend / clicks, 2) if clicks else None
    recommendations = []
    if not metrics.get("conversion_tracking_configured", False):
        recommendations.append({"priority": "high", "code": "verify_conversion_tracking", "message": "Configure and test conversion/call tracking before judging campaign success or changing budgets."})
    if impressions >= 500 and ctr is not None and ctr < 1:
        recommendations.append({"priority": "medium", "code": "review_creative_and_targeting", "message": "CTR is below 1% after at least 500 impressions. Review intent/audience fit and test clearer creative."})
    conversions = metrics.get("conversions") if metrics.get("conversion_tracking_configured", False) else None
    if clicks >= 20 and conversions == 0:
        recommendations.append({"priority": "high", "code": "investigate_zero_conversions", "message": "Clicks but zero recorded conversions: check the contact flow and tracking before increasing spend."})
    if not recommendations:
        recommendations.append({"priority": "low", "code": "continue_measurement", "message": "No high-confidence rule triggered; compare against campaign goals and historical baseline."})
    return {"metrics": {"impressions": impressions, "clicks": clicks, "click_through_rate_percent": ctr, "spend": round(spend, 2), "cost_per_click": cpc, "conversions": conversions}, "recommendations": recommendations, "limitations": ["Rule-based preliminary analysis, not a guarantee.", "No live provider data is fetched.", "Recommendations never change campaigns or budgets."]}
