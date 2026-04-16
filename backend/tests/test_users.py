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
        assert resp.json()["detail"] == "Super admin cannot delete their own account."
