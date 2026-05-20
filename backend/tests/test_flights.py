"""Tests for flights API endpoints."""
import pytest


class TestFlights:
    def test_list_flights_no_auth(self, client):
        """Flight listing should work without auth (public data)."""
        resp = client.get("/api/flights")
        # Either 200 (DB connected) or empty from mock fallback
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_flight_requires_auth(self, client):
        """Creating a flight requires a valid JWT."""
        resp = client.post("/api/flights", json={
            "flight_number": "TU999",
            "airline_iata": "TU",
            "origin_iata": "TUN",
            "destination_iata": "CDG",
            "scheduled_departure": "2026-06-01T08:00:00",
            "scheduled_arrival": "2026-06-01T10:30:00",
        })
        assert resp.status_code == 401

    def test_update_flight_requires_auth(self, client):
        resp = client.put("/api/flights/1", json={"status": "delayed"})
        assert resp.status_code == 401

    def test_delete_flight_requires_auth(self, client):
        resp = client.delete("/api/flights/1")
        assert resp.status_code == 401

    def test_predict_requires_auth(self, client):
        resp = client.post("/api/predictions", json={
            "weather_severity": 0.3,
            "origin_weather_severity": 0.2,
            "dest_weather_severity": 0.25,
            "hour_of_day": 14,
            "day_of_week": 1,
            "month": 6,
            "is_weekend": 0,
            "congestion_level": 0.5,
            "origin_congestion": 0.45,
            "dest_congestion": 0.55,
            "airline_reliability": 0.82,
            "distance_km": 1500,
            "historical_delay_rate": 0.25,
        })
        assert resp.status_code == 401

    def test_predict_with_admin_auth(self, client, admin_token):
        resp = client.post(
            "/api/predictions",
            json={
                "weather_severity": 0.8,
                "origin_weather_severity": 0.7,
                "dest_weather_severity": 0.6,
                "hour_of_day": 18,
                "day_of_week": 4,
                "month": 7,
                "is_weekend": 0,
                "congestion_level": 0.9,
                "origin_congestion": 0.85,
                "dest_congestion": 0.8,
                "airline_reliability": 0.6,
                "distance_km": 1490,
                "historical_delay_rate": 0.35,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "risk_score" in data
        assert "predicted_delay_min" in data
        assert "confidence" in data
        assert 0 <= data["risk_score"] <= 100

    def test_dashboard_requires_auth(self, client):
        resp = client.get("/api/dashboard/overview")
        assert resp.status_code == 401

    def test_dashboard_with_admin_auth(self, client, admin_token):
        resp = client.get(
            "/api/dashboard/overview",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_flights" in data
        assert "delay_rate" in data

    def test_airports_list_no_auth(self, client):
        """Airports list is public."""
        resp = client.get("/api/airports")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "healthy"
