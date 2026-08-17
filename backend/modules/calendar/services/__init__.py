from modules.calendar.services.oauth import PROVIDERS


def provider_meta() -> list[dict]:
    """Public metadata for the providers, including whether credentials are configured."""
    return [
        {
            "key": p.key,
            "name": p.name,
            "description": {
                "google": "Sync interviews with your team's Google Workspace calendars.",
                "microsoft": "Connect Outlook / Microsoft 365 calendars for the company.",
                "zoho": "Use Zoho Calendar as the company-wide scheduling source.",
            }.get(p.key, ""),
            "configured": bool(p.client_id and p.client_secret),
        }
        for p in PROVIDERS.values()
    ]