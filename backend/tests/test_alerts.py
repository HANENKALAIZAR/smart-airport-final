import pytest


def test_passenger_alerts_lifecycle(client):
    # 1. Initially check status for an unsubscribed email
    resp = client.get("/api/passenger/alerts/status?email=test@example.com&flight_number=TU720")
    assert resp.status_code == 200
    assert resp.json() == {"subscribed": False}

    # 2. Subscribe to alerts
    resp = client.post("/api/passenger/alerts/subscribe", json={
        "email": "test@example.com",
        "flight_number": "TU720",
        "dep_iata": "TUN",
        "arr_iata": "CDG",
        "airline": "Tunisair",
        "scheduled_departure": "2026-05-20T10:35:00Z"
    })
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["flight"] == "TU720"

    # 3. Check status again
    resp = client.get("/api/passenger/alerts/status?email=test@example.com&flight_number=TU720")
    assert resp.status_code == 200
    data = resp.json()
    assert data["subscribed"] is True
    assert data["is_active"] is True
    assert data["status"] == "ACTIVE"

    # 4. Unsubscribe
    resp = client.post("/api/passenger/alerts/unsubscribe", json={
        "email": "test@example.com",
        "flight_number": "TU720"
    })
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # 5. Check status after unsubscribe
    resp = client.get("/api/passenger/alerts/status?email=test@example.com&flight_number=TU720")
    assert resp.status_code == 200
    data = resp.json()
    assert data["subscribed"] is True
    assert data["is_active"] is False
    assert data["status"] == "CANCELLED"
    assert data["completion_reason"] == "cancelled_by_user"


def test_unsubscribe_not_found(client):
    resp = client.post("/api/passenger/alerts/unsubscribe", json={
        "email": "notfound@example.com",
        "flight_number": "TU999"
    })
    assert resp.status_code == 404
