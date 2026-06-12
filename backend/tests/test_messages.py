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
                "body": "The Aviation Edge API is returning empty responses.",
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
            f"/api/messages/{msg_id}/status",
            json={"status": "resolved"},
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
            f"/api/messages/{msg_id}/status",
            json={"status": "resolved"},
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

    # ── Delete (soft / hard) tests ──────────────────────────────────────

    def test_admin_soft_deletes_inbox_message(self, client, admin_token, super_admin_token, super_admin_user):
        """Admin soft-deletes an inbox message — only hidden from that admin, still visible to super admin."""
        # Super admin sends a message to the admin
        resp = client.post(
            "/api/messages",
            json={
                "to_user_id": 1,  # airport_admin_user (id=1 from conftest)
                "category": "general",
                "subject": "Admin inbox test",
                "body": "This is for your inbox.",
            },
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 201
        msg_id = resp.json()["id"]

        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_super = {"Authorization": f"Bearer {super_admin_token}"}

        # Confirm visible in admin inbox
        inbox_admin = client.get("/api/messages?tab=inbox", headers=headers_admin)
        assert inbox_admin.status_code == 200
        ids_admin_before = [m["id"] for m in inbox_admin.json()]
        assert msg_id in ids_admin_before

        # Confirm visible in super sent
        sent_super = client.get("/api/messages?tab=sent", headers=headers_super)
        ids_super_before = [m["id"] for m in sent_super.json()]
        assert msg_id in ids_super_before

        # Admin deletes
        del_resp = client.delete(f"/api/messages/{msg_id}", headers=headers_admin)
        assert del_resp.status_code == 200
        assert del_resp.json()["success"] is True

        # Gone from admin inbox
        inbox_admin2 = client.get("/api/messages?tab=inbox", headers=headers_admin)
        ids_admin_after = [m["id"] for m in inbox_admin2.json()]
        assert msg_id not in ids_admin_after

        # Still visible to super admin
        sent_super2 = client.get("/api/messages?tab=sent", headers=headers_super)
        ids_super_after = [m["id"] for m in sent_super2.json()]
        assert msg_id in ids_super_after

    def test_admin_soft_deletes_sent_message(self, client, admin_token, super_admin_token):
        """Admin soft-deletes a sent message — hidden from admin's sent, still visible to super admin's inbox."""
        resp = client.post(
            "/api/messages",
            json={"category": "technical", "subject": "Sent test", "body": "Check this out."},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        msg_id = resp.json()["id"]

        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_super = {"Authorization": f"Bearer {super_admin_token}"}

        # Confirm visible in admin sent
        sent_admin = client.get("/api/messages?tab=sent", headers=headers_admin)
        ids_sent_before = [m["id"] for m in sent_admin.json()]
        assert msg_id in ids_sent_before

        # Confirm visible in super inbox
        inbox_super = client.get("/api/messages?tab=inbox", headers=headers_super)
        ids_inbox_before = [m["id"] for m in inbox_super.json()]
        assert msg_id in ids_inbox_before

        # Admin deletes from sent
        del_resp = client.delete(f"/api/messages/{msg_id}", headers=headers_admin)
        assert del_resp.status_code == 200

        # Gone from admin sent
        sent_admin2 = client.get("/api/messages?tab=sent", headers=headers_admin)
        ids_sent_after = [m["id"] for m in sent_admin2.json()]
        assert msg_id not in ids_sent_after

        # Still visible to super admin
        inbox_super2 = client.get("/api/messages?tab=inbox", headers=headers_super)
        ids_inbox_after = [m["id"] for m in inbox_super2.json()]
        assert msg_id in ids_inbox_after

    def test_super_admin_hard_deletes_message(self, client, admin_token, super_admin_token, db):
        """Super admin hard-deletes — message is gone for both parties."""
        resp = client.post(
            "/api/messages",
            json={"category": "operational", "subject": "Hard delete", "body": "Remove this forever."},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 201
        msg_id = resp.json()["id"]

        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_super = {"Authorization": f"Bearer {super_admin_token}"}

        # Confirm visible to both
        inbox_super = client.get("/api/messages?tab=inbox", headers=headers_super)
        assert msg_id in [m["id"] for m in inbox_super.json()]

        sent_admin = client.get("/api/messages?tab=sent", headers=headers_admin)
        assert msg_id in [m["id"] for m in sent_admin.json()]

        # Super admin deletes
        del_resp = client.delete(f"/api/messages/{msg_id}", headers=headers_super)
        assert del_resp.status_code == 200

        # Gone from super inbox
        inbox_super2 = client.get("/api/messages?tab=inbox", headers=headers_super)
        assert msg_id not in [m["id"] for m in inbox_super2.json()]

        # Gone from admin sent
        sent_admin2 = client.get("/api/messages?tab=sent", headers=headers_admin)
        assert msg_id not in [m["id"] for m in sent_admin2.json()]

        # Record is deleted from the database
        from app.models.models import Message
        assert db.query(Message).filter(Message.id == msg_id).first() is None

    def test_admin_cannot_delete_others_message(self, client, admin_token, super_admin_token, db):
        """Admin gets 403 trying to delete a message they are not a party to."""
        from app.models.models import User
        from passlib.context import CryptContext
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

        # Create a separate admin user for this test
        other_admin = User(
            email="other.admin@test.tn",
            password_hash=pwd.hash("OtherPass@789"),
            full_name="Other Airport Admin",
            role="admin",
            airport_iata="MIR",
            employee_id="MIR-9999",
            is_active=1,
            must_change_password=0,
            profile_complete=1,
            id_document_status="approved",
        )
        db.add(other_admin)
        db.commit()
        db.refresh(other_admin)

        # Super admin sends to the other admin
        resp = client.post(
            "/api/messages",
            json={
                "to_user_id": other_admin.id,
                "category": "general",
                "subject": "For other admin",
                "body": "This is not for the current admin.",
            },
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 201
        msg_id = resp.json()["id"]

        # Current admin (not the recipient) tries to delete — should be blocked
        del_resp = client.delete(
            f"/api/messages/{msg_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert del_resp.status_code == 403
        assert "cannot delete" in del_resp.json()["error"].lower()
