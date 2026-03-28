"""Tests for internal messaging endpoints."""

import pytest


class TestMessages:
    def test_list_messages_requires_auth(self, client):
        resp = client.get("/api/messages")
        assert resp.status_code == 401

    def test_admin_can_list_messages(self, client, admin_token):
        resp = client.get(
            "/api/messages",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_admin_sends_message_to_super(self, client, admin_token, super_admin_user):
        resp = client.post(
            "/api/messages",
            json={
                "category": "technical",
                "subject": "API issue at TUN",
                "body": "The AviationStack API is returning empty responses.",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["direction"] == "to_super"
        assert data["subject"] == "API issue at TUN"
        assert data["status"] == "open"

    def test_super_admin_sends_to_admin(self, client, super_admin_token, airport_admin_user):
        resp = client.post(
            "/api/messages",
            json={
                "to_user_id": airport_admin_user.id,
                "category": "general",
                "subject": "Holiday staffing",
                "body": "Please ensure 85% attendance during holidays.",
            },
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["direction"] == "to_admin"
        assert data["to_user_id"] == airport_admin_user.id

    def test_super_admin_requires_to_user_id(self, client, super_admin_token):
        resp = client.post(
            "/api/messages",
            json={
                "category": "general",
                "subject": "Test",
                "body": "Missing to_user_id",
            },
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 422

    def test_reply_to_message(self, client, admin_token, super_admin_token, super_admin_user):
        # Admin sends message
        msg_resp = client.post(
            "/api/messages",
            json={
                "category": "request",
                "subject": "Need kiosk access",
                "body": "Requesting 2 more kiosks in Terminal 2.",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert msg_resp.status_code == 201
        msg_id = msg_resp.json()["id"]

        # Super admin replies
        reply_resp = client.post(
            f"/api/messages/{msg_id}/reply",
            json={"body": "Approved. Proceed with the installation."},
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert reply_resp.status_code == 201
        assert reply_resp.json()["body"] == "Approved. Proceed with the installation."

    def test_resolve_message(self, client, admin_token, super_admin_token):
        # Admin sends message
        msg_resp = client.post(
            "/api/messages",
            json={"category": "technical", "subject": "Test issue", "body": "Details here."},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        msg_id = msg_resp.json()["id"]

        # Super admin resolves
        resolve_resp = client.patch(
            f"/api/messages/{msg_id}/resolve",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["status"] == "resolved"

    def test_cannot_reply_to_resolved(self, client, admin_token, super_admin_token):
        msg_resp = client.post(
            "/api/messages",
            json={"category": "general", "subject": "Done", "body": "All good."},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        msg_id = msg_resp.json()["id"]

        client.patch(
            f"/api/messages/{msg_id}/resolve",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )

        reply_resp = client.post(
            f"/api/messages/{msg_id}/reply",
            json={"body": "Late reply"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert reply_resp.status_code == 400

    def test_empty_body_rejected(self, client, admin_token):
        resp = client.post(
            "/api/messages",
            json={"category": "general", "subject": "No body", "body": ""},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 422
