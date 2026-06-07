"""Tests for user management endpoints (super_admin only)."""

import pytest
from passlib.context import CryptContext

from app.models.models import Message, MessageReply, User


class TestUserManagement:
    def test_list_admins_requires_auth(self, client):
        resp = client.get("/api/users/admins")
        assert resp.status_code == 401

    def test_list_admins_requires_super_admin(self, client, admin_token):
        resp = client.get(
            "/api/users/admins",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 403

    def test_list_admins_as_super_admin(self, client, super_admin_token, airport_admin_user):
        resp = client.get(
            "/api/users/admins",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        emails = [u["email"] for u in data]
        assert "ahmed.bensalah@tunis-carthage.tn" in emails

    def test_create_admin_requires_super_admin(self, client, admin_token):
        resp = client.post(
            "/api/users/admins",
            json={
                "full_name": "Test Admin",
                "airport_iata": "DJE",
                "work_email": "test.admin@dje-airport.tn",
                "personal_email": "test@gmail.com",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 403

    def test_create_admin_unauthenticated(self, client):
        resp = client.post(
            "/api/users/admins",
            json={
                "full_name": "Test Admin",
                "airport_iata": "DJE",
                "work_email": "test.admin@dje-airport.tn",
                "personal_email": "test@gmail.com",
            },
        )
        assert resp.status_code == 401

    def test_create_admin_success(self, client, super_admin_token):
        resp = client.post(
            "/api/users/admins",
            json={
                "full_name": "Fatima Mansour",
                "airport_iata": "DJE",
                "work_email": "fatima.mansour@dje-airport.tn",
                "personal_email": "fatima.mansour@gmail.com",
            },
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "fatima.mansour@dje-airport.tn"
        assert data["role"] == "admin"
        assert data["must_change_password"] == 1
        assert data["airport_iata"] == "DJE"
        assert data.get("employee_id") == "DJE-0001"

    def test_create_admin_duplicate_email(self, client, super_admin_token):
        body = {
            "full_name": "Youssef Zaidi",
            "airport_iata": "MIR",
            "work_email": "youssef.zaidi@mir-airport.tn",
            "personal_email": "youssef@gmail.com",
        }
        client.post(
            "/api/users/admins",
            json=body,
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        resp = client.post(
            "/api/users/admins",
            json=body,
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 409

    def test_create_admin_invalid_airport(self, client, super_admin_token):
        resp = client.post(
            "/api/users/admins",
            json={
                "full_name": "Test Admin",
                "airport_iata": "ZZZ",
                "work_email": "test@invalid-airport.tn",
                "personal_email": "test@gmail.com",
            },
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 422

    def test_delete_admin_requires_super_admin(self, client, admin_token, airport_admin_user):
        resp = client.delete(
            f"/api/users/admins/{airport_admin_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 403

    def test_delete_admin_success(self, client, super_admin_token, db):
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        user = User(
            email="todeactivate@tunis-carthage.tn",
            password_hash=pwd.hash("Pass@123"),
            full_name="To Deactivate",
            role="admin",
            airport_iata="TUN",
            is_active=1,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        resp = client.delete(
            f"/api/users/admins/{user.id}",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 204

        deleted = db.query(User).filter(User.id == user.id).first()
        assert deleted is None

    def test_delete_admin_removes_related_messages(self, client, super_admin_token, db, super_admin_user):
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        admin = User(
            email="thread.admin@tunis-carthage.tn",
            password_hash=pwd.hash("Pass@123"),
            full_name="Thread Admin",
            role="admin",
            airport_iata="TUN",
            is_active=1,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

        message = Message(
            direction="to_super",
            from_user_id=admin.id,
            to_user_id=super_admin_user.id,
            category="general",
            subject="Need help",
            body="Please review this",
            status="open",
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        message_id = message.id

        reply = MessageReply(
            message_id=message_id,
            author_id=admin.id,
            body="Following up",
        )
        db.add(reply)
        db.commit()

        resp = client.delete(
            f"/api/users/admins/{admin.id}",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 204

        assert db.query(Message).filter(Message.id == message_id).first() is None
        assert db.query(MessageReply).filter(MessageReply.message_id == message_id).count() == 0

    def test_super_admin_cannot_delete_self(self, client, super_admin_token, super_admin_user):
        resp = client.delete(
            f"/api/users/admins/{super_admin_user.id}",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 403
        assert resp.json()["error"] == "Super admin cannot delete their own account."


class TestSuperAdminSettings:
    def test_super_admin_get_me(self, client, super_admin_token):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "super_admin"
        assert data["email"] == "superadmin@smartairport.tn"

    def test_super_admin_patch_settings_success(self, client, super_admin_token, db):
        # Base64 for a small 1x1 png image
        small_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        resp = client.patch(
            "/api/users/me/settings",
            json={
                "full_name": "Super Boss",
                "phone_number": "+216 98 765 432",
                "profile_photo_url": small_png,
            },
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Settings updated"

        # Check in DB
        user = db.query(User).filter(User.role == "super_admin").first()
        assert user.full_name == "Super Boss"
        assert user.phone_number == "+21698765432"
        assert user.profile_photo_url == small_png

    def test_super_admin_patch_settings_invalid_phone(self, client, super_admin_token):
        resp = client.patch(
            "/api/users/me/settings",
            json={"phone_number": "123456"},
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 422
        assert "valid Tunisian phone number" in resp.json()["error"]

    def test_super_admin_patch_settings_invalid_fields(self, client, super_admin_token):
        resp = client.patch(
            "/api/users/me/settings",
            json={"gender": "Male"},
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 403
        assert "read-only for Super Admin" in resp.json()["error"]

    def test_super_admin_patch_settings_invalid_photo_format(self, client, super_admin_token):
        # PDF is not a valid photo type (with valid base64 content)
        pdf_data = "data:application/pdf;base64,JVBERi0xLjQK"
        resp = client.patch(
            "/api/users/me/settings",
            json={"profile_photo_url": pdf_data},
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 422
        assert "Only JPG, PNG or JPEG files are accepted" in resp.json()["error"]

    def test_super_admin_patch_settings_oversized_photo(self, client, super_admin_token):
        # Create a payload larger than 2MB
        large_base64 = "data:image/png;base64," + ("A" * (3 * 1024 * 1024))
        resp = client.patch(
            "/api/users/me/settings",
            json={"profile_photo_url": large_base64},
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 422
        assert "File size must be under 2MB" in resp.json()["error"]


class TestExpiredVerificationActions:
    def test_expired_verification_actions(self, client, super_admin_token, admin_token, db):
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        # Create an admin user whose verification is expired
        expired_admin = User(
            email="expired.admin@tunis-carthage.tn",
            password_hash=pwd.hash("Pass@123"),
            full_name="Expired Admin",
            role="admin",
            airport_iata="TUN",
            is_active=1,
            id_document_status="expired_verification",
        )
        db.add(expired_admin)
        db.commit()
        db.refresh(expired_admin)

        # 1. Non-super admin cannot call these actions
        resp = client.post(
            f"/api/users/admins/{expired_admin.id}/reopen-verification",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 403

        # 2. Super admin reopen verification
        resp = client.post(
            f"/api/users/admins/{expired_admin.id}/reopen-verification",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Verification reopened. Admin can now correct and resubmit."
        db.refresh(expired_admin)
        assert expired_admin.id_document_status == "rejected"
        assert expired_admin.is_active == 1

        # Reset back to expired for next action test
        expired_admin.id_document_status = "expired_verification"
        db.commit()

        # 3. Super admin archive account
        resp = client.post(
            f"/api/users/admins/{expired_admin.id}/archive",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Admin account archived successfully."
        db.refresh(expired_admin)
        assert expired_admin.id_document_status == "archived"
        assert expired_admin.is_active == 0

        # Reset back to expired for next action test
        expired_admin.id_document_status = "expired_verification"
        expired_admin.is_active = 1
        db.commit()

        # 4. Super admin permanently reject account
        resp = client.post(
            f"/api/users/admins/{expired_admin.id}/permanently-reject",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Admin account permanently rejected."
        db.refresh(expired_admin)
        assert expired_admin.id_document_status == "permanently_rejected"
        assert expired_admin.is_active == 0


