"""Tests for AI Operational Suggestions endpoint access control."""

import pytest


def test_super_admin_cannot_decide(client, super_admin_token):
    """Super admin calling POST /api/admin/ai-suggestions/decide must return 403."""
    resp = client.post(
        "/api/admin/ai-suggestions/decide",
        json={
            "suggestion_key": "2026-06-08:delay:TUN:TU712:TUN→CDG",
            "airport_iata": "TUN",
            "suggestion_type": "delay",
            "status": "approved",
            "suggestion_payload": {
                "flightNumber": "TU712",
                "route": "TUN→CDG",
                "predictedDelay": 45,
                "priority": "high",
                "recommendedAction": "Prioritise gate",
            },
        },
        headers={"Authorization": f"Bearer {super_admin_token}"},
    )
    assert resp.status_code == 403
    assert "Only airport admins" in resp.json()["error"]
