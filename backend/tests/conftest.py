"""
Pytest configuration and shared fixtures.
Uses an in-memory SQLite database so no PostgreSQL is needed for tests.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

from app.main import app
from app.database import Base, get_db
from app.models.models import User
from app.config import settings

# Force a test SECRET_KEY so JWT works in tests
settings.SECRET_KEY = "test-secret-key-for-pytest-only"

SQLITE_URL = "sqlite:///./test_smart_airport.db"

engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once per test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    import os
    if os.path.exists("test_smart_airport.db"):
        os.remove("test_smart_airport.db")


@pytest.fixture
def db():
    """Provide a fresh DB session per test, with rollback after."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    """TestClient with DB override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def super_admin_user(db):
    """Create a super_admin user in the test DB."""
    user = User(
        email="superadmin@smartairport.tn",
        password_hash=pwd_context.hash("SuperPass@123"),
        full_name="Super Admin",
        role="super_admin",
        is_active=1,
        must_change_password=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def airport_admin_user(db):
    """Create an airport admin user in the test DB."""
    user = User(
        email="ahmed.bensalah@tunis-carthage.tn",
        password_hash=pwd_context.hash("TempPass@456"),
        full_name="Ahmed Ben Salah",
        role="admin",
        airport_iata="TUN",
        employee_id="TUN-0001",
        is_active=1,
        must_change_password=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def super_admin_token(client, super_admin_user):
    """Get JWT token for super admin."""
    resp = client.post("/api/auth/login", json={
        "email": "superadmin@smartairport.tn",
        "password": "SuperPass@123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def admin_token(client, airport_admin_user):
    """Get JWT token for airport admin."""
    resp = client.post("/api/auth/login", json={
        "email": "ahmed.bensalah@tunis-carthage.tn",
        "password": "TempPass@456",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]
