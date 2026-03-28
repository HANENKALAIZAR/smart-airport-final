"""Tests for user management endpoints (super_admin only)."""

import pytest


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

    def test_deactivate_admin_requires_super_admin(self, client, admin_token, airport_admin_user):
        resp = client.delete(
            f"/api/users/admins/{airport_admin_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 403

    def test_deactivate_admin_success(self, client, super_admin_token, db):
        from app.models.models import User
        from passlib.context import CryptContext
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

        db.refresh(user)
        assert user.is_active == 0
