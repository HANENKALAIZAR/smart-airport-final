import pytest
from datetime import datetime, timezone, timedelta
from app.models.models import PassengerMessage, PassengerMessageThread, User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@pytest.fixture
def mir_admin_user(db):
    """Create a Monastir (MIR) airport admin user in the test DB."""
    user = User(
        email="salah.mir@monastir.tn",
        password_hash=pwd_context.hash("MirPass@456"),
        full_name="Salah MIR Admin",
        role="admin",
        airport_iata="MIR",
        employee_id="MIR-0002",
        is_active=1,
        must_change_password=0,
        profile_complete=1,
        id_document_status="approved",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def mir_admin_token(client, mir_admin_user):
    """Get JWT token for MIR admin."""
    resp = client.post(
        "/api/auth/login",
        json={
            "email": "salah.mir@monastir.tn",
            "password": "MirPass@456",
        },
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


def test_public_ingestion_validations(client, db):
    # 1. Test missing fields
    resp = client.post("/api/public/contact-message", json={
        "fullName": "",
        "email": "passenger@gmail.com",
        "airportIata": "TUN",
        "subject": "Lost Luggage",
        "message": "My baggage was lost."
    })
    assert resp.status_code == 422

    # 2. Test invalid airport code
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Passenger One",
        "email": "passenger@gmail.com",
        "airportIata": "PAR",  # Paris, not supported
        "subject": "General",
        "message": "How to get to Tunis?"
    })
    assert resp.status_code == 400

    # 3. Test valid submission
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Passenger One",
        "email": "passenger@gmail.com",
        "airportIata": "TUN",
        "subject": "General",
        "message": "How to get to Tunis Carthage?"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert "TUN-" in data["reference_id"]


def test_priority_engine_operational_reality(client, db):
    # 1. English High keyword ("cancelled flight")
    resp = client.post("/api/public/contact-message", json={
        "fullName": "English Passenger",
        "email": "passenger@gmail.com",
        "airportIata": "TUN",
        "subject": "My flight was cancelled today",
        "message": "What should I do now?"
    })
    assert resp.status_code == 201
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()
    assert ticket.priority == "HIGH"
    assert ticket.category == "delay"

    # 2. French High keyword ("sécurité")
    resp = client.post("/api/public/contact-message", json={
        "fullName": "French Passenger",
        "email": "passenger@gmail.com",
        "airportIata": "MIR",
        "subject": "Avis sur la sécurité",
        "message": "Il y avait un problème de police à la douane."
    })
    assert resp.status_code == 201
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()
    assert ticket.priority == "HIGH"
    assert ticket.category == "security"

    # 3. Medium keyword ("baggage" / "fauteuil roulant")
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Wheelchair Passenger",
        "email": "passenger@gmail.com",
        "airportIata": "DJE",
        "subject": "Fauteuil roulant d'assistance",
        "message": "J'ai besoin d'une assistance pour débarquer."
    })
    assert resp.status_code == 201
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()
    assert ticket.priority == "MEDIUM"
    assert ticket.category == "accessibility"


def test_rate_limiting_passenger(client, db):
    # Submit 5 times successfully
    for i in range(5):
        resp = client.post("/api/public/contact-message", json={
            "fullName": f"Spammer {i}",
            "email": "spammer@gmail.com",
            "airportIata": "TUN",
            "subject": f"Inquiry {i}",
            "message": f"Hello Smart Airport {i} text long message."
        })
        assert resp.status_code == 201

    # 6th submission should be rate-limited
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Spammer 6",
        "email": "spammer@gmail.com",
        "airportIata": "TUN",
        "subject": "Inquiry 6",
        "message": "Hello Smart Airport 6 text long message."
    })
    assert resp.status_code == 429


def test_duplicate_protection_merging(client, db):
    # 1. First submission
    resp1 = client.post("/api/public/contact-message", json={
        "fullName": "Passenger Dup",
        "email": "dup@gmail.com",
        "airportIata": "TUN",
        "subject": "Lost Luggage",
        "message": "My black suitcase was lost on Nouvelair flight."
    })
    assert resp1.status_code == 201
    ref1 = resp1.json()["reference_id"]

    # 2. Duplicate submission within 10 mins should merge
    resp2 = client.post("/api/public/contact-message", json={
        "fullName": "Passenger Dup",
        "email": "dup@gmail.com",
        "airportIata": "TUN",
        "subject": "Lost Luggage",
        "message": "My black suitcase was lost on Nouvelair flight."
    })
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["reference_id"] == ref1
    assert data2.get("appended") is True

    # Confirm thread row appended
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref1).first()
    assert len(ticket.replies) == 2  # Confirmation log + duplicate message log


def test_strict_airport_boundaries(client, db, admin_token, mir_admin_token):
    # Create a MIR ticket
    resp = client.post("/api/public/contact-message", json={
        "fullName": "MIR Passenger",
        "email": "passenger.mir@gmail.com",
        "airportIata": "MIR",
        "subject": "Monastir Info",
        "message": "Is Monastir airport open?"
    })
    assert resp.status_code == 201
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()

    # 1. TUN admin (admin_token) tries to list - should NOT see the MIR ticket
    headers_tun = {"Authorization": f"Bearer {admin_token}"}
    resp_list_tun = client.get("/api/admin/messages", headers=headers_tun)
    assert resp_list_tun.status_code == 200
    tickets_tun = resp_list_tun.json()["data"]
    assert not any(t["reference_id"] == ref_id for t in tickets_tun)

    # 2. TUN admin tries to claim MIR ticket - should be blocked
    resp_claim_tun = client.post(f"/api/admin/messages/{ticket.id}/claim", headers=headers_tun)
    assert resp_claim_tun.status_code == 403

    # 3. MIR admin lists - should see it
    headers_mir = {"Authorization": f"Bearer {mir_admin_token}"}
    resp_list_mir = client.get("/api/admin/messages", headers=headers_mir)
    assert resp_list_mir.status_code == 200
    tickets_mir = resp_list_mir.json()["data"]
    assert any(t["reference_id"] == ref_id for t in tickets_mir)


def test_atomic_lock_claiming(client, db, admin_token, mir_admin_token):
    # Create a TUN ticket
    resp = client.post("/api/public/contact-message", json={
        "fullName": "TUN Passenger",
        "email": "passenger.tun@gmail.com",
        "airportIata": "TUN",
        "subject": "TUN Info",
        "message": "Is Tunis airport open?"
    })
    assert resp.status_code == 201
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()

    # 1. Admin 1 claims ticket
    headers1 = {"Authorization": f"Bearer {admin_token}"}
    resp_claim1 = client.post(f"/api/admin/messages/{ticket.id}/claim", headers=headers1)
    assert resp_claim1.status_code == 200
    assert resp_claim1.json()["data"]["status"] == "ASSIGNED"

    # 2. Admin 2 tries to claim same ticket - should return 409 Conflict
    db.expire_all()
    # Mocking another TUN admin using mir_admin_token for simplicity (we'll make him super admin to bypass airport boundary)
    # Actually let's create another TUN admin to test boundary + conflict
    user2 = User(
        email="salah.tun2@tunis.tn",
        password_hash=pwd_context.hash("TunPass@123"),
        full_name="Salah TUN Admin 2",
        role="admin",
        airport_iata="TUN",
        employee_id="TUN-0003",
        is_active=1,
        profile_complete=1,
        id_document_status="approved"
    )
    db.add(user2)
    db.commit()

    resp_login = client.post("/api/auth/login", json={"email": "salah.tun2@tunis.tn", "password": "TunPass@123"})
    token2 = resp_login.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    resp_claim2 = client.post(f"/api/admin/messages/{ticket.id}/claim", headers=headers2)
    assert resp_claim2.status_code == 409
    assert "already being handled" in resp_claim2.json()["error"]


def test_expired_claim_auto_release(client, db, admin_token):
    # Create a TUN ticket
    resp = client.post("/api/public/contact-message", json={
        "fullName": "TUN Passenger",
        "email": "passenger.tun@gmail.com",
        "airportIata": "TUN",
        "subject": "TUN Info",
        "message": "Is Tunis airport open?"
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id

    # 1. Admin claims it
    headers = {"Authorization": f"Bearer {admin_token}"}
    client.post(f"/api/admin/messages/{ticket_id}/claim", headers=headers)

    # 2. Modify expiration date to be in the past
    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first()
    ticket.claim_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()

    # 3. Retrieval list should auto-release
    resp_list = client.get("/api/admin/messages", headers=headers)
    assert resp_list.status_code == 200
    
    db.expire_all()
    ticket_released = db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first()
    assert ticket_released.status == "NEW"
    assert ticket_released.assigned_admin_id is None


def test_autosave_draft_preserves_expired_claim(client, db, admin_token):
    # Create a TUN ticket
    client.post("/api/public/contact-message", json={
        "fullName": "TUN Passenger",
        "email": "passenger.tun@gmail.com",
        "airportIata": "TUN",
        "subject": "TUN Info",
        "message": "Is Tunis airport open?"
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id

    # 1. Claim
    headers = {"Authorization": f"Bearer {admin_token}"}
    client.post(f"/api/admin/messages/{ticket_id}/claim", headers=headers)

    # 2. Save draft
    client.patch(f"/api/admin/messages/{ticket_id}/draft", json={"draft_body": "Typing a response..."}, headers=headers)

    # 3. Modify expiration date to be in the past
    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first()
    ticket.claim_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()

    # 4. Retrieval should NOT release since draft was recently updated
    client.get("/api/admin/messages", headers=headers)
    
    db.expire_all()
    ticket_preserved = db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first()
    assert ticket_preserved.status == "ASSIGNED"
    assert ticket_preserved.draft_body == "Typing a response..."


def test_internal_notes_not_emailed(client, db, admin_token):
    # Create a TUN ticket
    client.post("/api/public/contact-message", json={
        "fullName": "TUN Passenger",
        "email": "passenger.tun@gmail.com",
        "airportIata": "TUN",
        "subject": "TUN Info",
        "message": "Is Tunis airport open?"
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Claim the ticket so we can reply/interact with it
    client.post(f"/api/admin/messages/{ticket_id}/claim", headers=headers)

    # Add internal note
    resp = client.post(f"/api/admin/messages/{ticket_id}/internal-note", json={"body": "Internal coordination details."}, headers=headers)
    assert resp.status_code == 200
    
    # Confirm note inside replies with None email status
    note = db.query(PassengerMessageThread).filter(
        PassengerMessageThread.message_id == ticket_id,
        PassengerMessageThread.sender_type == "internal_note"
    ).first()
    assert note is not None
    assert note.email_status is None


def test_resolution_safety_flow(client, db, admin_token, super_admin_token):
    # 1. Create ticket
    resp = client.post("/api/public/contact-message", json={
        "fullName": "TUN Passenger",
        "email": "passenger.tun@gmail.com",
        "airportIata": "TUN",
        "subject": "TUN Safety",
        "message": "Safety information inquiry."
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # 2. Try to resolve directly - blocked since NEW and no replies
    resp_res = client.post(f"/api/admin/messages/{ticket_id}/resolve", headers=headers_admin)
    assert resp_res.status_code == 400

    # 3. Super admin resolves directly - blocked (managed by airport admins only)
    headers_super = {"Authorization": f"Bearer {super_admin_token}"}
    resp_res_super = client.post(f"/api/admin/messages/{ticket_id}/resolve", headers=headers_super)
    assert resp_res_super.status_code == 403
    assert resp_res_super.json()["success"] is False
    assert "managed by airport admins only" in resp_res_super.json()["message"]


def test_super_admin_reassignment_reopen(client, db, admin_token, super_admin_token):
    # Create a TUN ticket
    client.post("/api/public/contact-message", json={
        "fullName": "TUN Passenger",
        "email": "passenger.tun@gmail.com",
        "airportIata": "TUN",
        "subject": "TUN Safety",
        "message": "Safety information inquiry."
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id
    
    # Manually resolve it via DB so it is resolved
    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first()
    ticket.status = "RESOLVED"
    db.commit()

    headers_super = {"Authorization": f"Bearer {super_admin_token}"}

    # 1. Reopen - must return 403
    resp_reopen = client.post(f"/api/admin/messages/{ticket_id}/reopen", headers=headers_super)
    assert resp_reopen.status_code == 403
    assert resp_reopen.json()["success"] is False
    assert "managed by airport admins only" in resp_reopen.json()["message"]

    # 2. Reassign to another admin - must return 403
    admin = db.query(User).filter(User.role == "admin").first()
    resp_reassign = client.post(
        f"/api/admin/messages/{ticket_id}/reassign",
        json={"new_admin_id": admin.id},
        headers=headers_super
    )
    assert resp_reassign.status_code == 403
    assert resp_reassign.json()["success"] is False
    assert "managed by airport admins only" in resp_reassign.json()["message"]


def test_super_admin_blocks_and_unread_states(client, db, admin_token, super_admin_token):
    # 1. Create a ticket
    resp = client.post("/api/public/contact-message", json={
        "fullName": "TUN Passenger",
        "email": "passenger.tun@gmail.com",
        "airportIata": "TUN",
        "subject": "TUN Safety",
        "message": "Safety information inquiry."
    })
    assert resp.status_code == 201
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id

    # 2. Super Admin tries to claim - must return 403
    headers_super = {"Authorization": f"Bearer {super_admin_token}"}
    resp_claim = client.post(f"/api/admin/messages/{ticket_id}/claim", headers=headers_super)
    assert resp_claim.status_code == 403
    assert resp_claim.json()["success"] is False
    assert "managed by airport admins only" in resp_claim.json()["message"]

    # 3. Super Admin tries to reply - must return 403
    resp_reply = client.post(f"/api/admin/messages/{ticket_id}/reply", json={"body": "Hello Passenger!"}, headers=headers_super)
    assert resp_reply.status_code == 403
    assert resp_reply.json()["success"] is False
    assert "managed by airport admins only" in resp_reply.json()["message"]

    # 4. Check unread counts
    # The new ticket is unread for admin, but 0 for super admin
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    resp_count = client.get("/api/admin/messages/unread-count", headers=headers_admin)
    assert resp_count.status_code == 200
    assert resp_count.json()["passengerUnread"] > 0

    resp_count_super = client.get("/api/admin/messages/unread-count", headers=headers_super)
    assert resp_count_super.status_code == 200
    assert resp_count_super.json()["passengerUnread"] == 0

    # 5. Admin opens/reads the ticket
    resp_read = client.post(f"/api/admin/messages/{ticket_id}/read", headers=headers_admin)
    assert resp_read.status_code == 200

    # Counts should decrease for admin, but remain 0 for super admin!
    resp_count_after = client.get("/api/admin/messages/unread-count", headers=headers_admin)
    assert resp_count_after.json()["passengerUnread"] == resp_count.json()["passengerUnread"] - 1

    resp_count_super_after = client.get("/api/admin/messages/unread-count", headers=headers_super)
    assert resp_count_super_after.json()["passengerUnread"] == 0

