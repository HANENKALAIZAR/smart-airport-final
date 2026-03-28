"""Tests for authentication endpoints."""

import pytest


class TestLogin:
    def test_login_success_super_admin(self, client, super_admin_user):
        resp = client.post("/api/auth/login", json={
            "email": "superadmin@smartairport.tn",
            "password": "SuperPass@123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["role"] == "super_admin"
        assert data["must_change_password"] is False

    def test_login_success_admin(self, client, airport_admin_user):
        resp = client.post("/api/auth/login", json={
            "email": "ahmed.bensalah@tunis-carthage.tn",
            "password": "TempPass@456",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["role"] == "admin"
        assert data["user"]["airport_iata"] == "TUN"

    def test_login_wrong_password(self, client, super_admin_user):
        resp = client.post("/api/auth/login", json={
            "email": "superadmin@smartairport.tn",
            "password": "WrongPassword",
        })
        assert resp.status_code == 401
        assert "Invalid" in resp.json()["detail"]

    def test_login_unknown_email(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@nowhere.com",
            "password": "SomePassword",
        })
        assert resp.status_code == 401

    def test_login_inactive_user(self, client, db):
        from app.models.models import User
        from passlib.context import CryptContext
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        user = User(
            email="inactive@airport.tn",
            password_hash=pwd.hash("Pass@123"),
            full_name="Inactive User",
            role="admin",
            is_active=0,
        )
        db.add(user)
        db.commit()
        resp = client.post("/api/auth/login", json={
            "email": "inactive@airport.tn",
            "password": "Pass@123",
        })
        assert resp.status_code == 403

    def test_get_me_authenticated(self, client, admin_token):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "ahmed.bensalah@tunis-carthage.tn"

    def test_get_me_unauthenticated(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_change_password_success(self, client, admin_token, airport_admin_user):
        resp = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "TempPass@456",
                "new_password": "NewSecurePass@789",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert "success" in resp.json()["message"].lower()

    def test_change_password_wrong_current(self, client, admin_token):
        resp = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "WrongCurrent",
                "new_password": "NewPass@789",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 401

    def test_change_password_too_short(self, client, admin_token):
        resp = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "TempPass@456",
                "new_password": "short",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 422

    def test_change_password_same_as_current(self, client, admin_token):
        resp = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "TempPass@456",
                "new_password": "TempPass@456",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 422

    def test_change_password_unauthenticated(self, client):
        resp = client.post(
            "/api/auth/change-password",
            json={"current_password": "old", "new_password": "newpassword123"},
        )
        assert resp.status_code == 401
