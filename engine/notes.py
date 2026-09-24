from typing import Dict, Any

TEMPLATES = {
    "store": "{place}, {local_time}: likely {finding} ({pct}%), {conf_str}. Place a warning sign and address promptly.",
    "home": "{place}, {local_time}: observed {finding} ({pct}%), {conf_str}. Recommended action: inspect area and secure any hazards.",
    "kitchen": "{place}, {local_time}: potential {finding} ({pct}%), {conf_str}. Corrective action required before food prep.",
    "garden": "{place}, {local_time}: signs of {finding} ({pct}%), {conf_str}. Check soil, moisture, and monitor foliage.",
    "rental": "{place}, {local_time}: recorded {finding} ({pct}%), {conf_str}. Added to property condition log.",
    "vehicle": "{place}, {local_time}: {finding} detected ({pct}%), {conf_str}. Inspect thoroughly before operating vehicle."
}

def generate_incident_note(payload: Dict[str, Any]) -> str:
    domain = payload.get("domain", "store")
    area = payload.get("area", "")
    place = payload.get("place", area)
    local_time = payload.get("local_time", "now")
    q_name = payload.get("q", "hazard").replace("_", " ")
    p = payload.get("p", 0.5)
    pct = round(p * 100)
    confirmations = payload.get("confirmations", 1)
    
    conf_str = "confirmed by multiple snapshots" if confirmations > 1 else "from initial check"
    
    template = TEMPLATES.get(domain, TEMPLATES["store"])
    return template.format(
        place=place,
        local_time=local_time,
        finding=q_name,
        pct=pct,
        conf_str=conf_str
    )
