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


# ── Ticket Threading Tests ─────────────────────────────────────────────────


def test_reference_in_message_appends_to_existing_ticket(client, db):
    """Submitting with a reference ID in the message body appends to the existing ticket."""
    # 1. Create first ticket
    resp1 = client.post("/api/public/contact-message", json={
        "fullName": "Thread Passenger",
        "email": "thread.pax@gmail.com",
        "airportIata": "DJE",
        "subject": "Lost iPhone",
        "message": "I lost my iPhone at the airport."
    })
    assert resp1.status_code == 201
    ref_id = resp1.json()["reference_id"]

    # 2. Second submission with the reference in the message
    resp2 = client.post("/api/public/contact-message", json={
        "fullName": "Thread Passenger",
        "email": "thread.pax@gmail.com",
        "airportIata": "DJE",
        "subject": "Thank you",
        "message": f"Thank you for your assistance. Reference: {ref_id}"
    })
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["reference_id"] == ref_id
    assert data2.get("thread_appended") is True
    assert "Your message has been added to ticket" in data2["message"]

    # 3. Verify only one ticket exists, with two thread entries (original + reply)
    tickets = db.query(PassengerMessage).filter(
        PassengerMessage.sender_email == "thread.pax@gmail.com"
    ).all()
    assert len(tickets) == 1
    assert len(tickets[0].replies) == 3  # confirm_email thread + system timeline + passenger reply


def test_reference_in_subject_appends_to_existing_ticket(client, db):
    """Submitting with a reference ID in the subject line appends to the existing ticket."""
    # 1. Create first ticket
    resp1 = client.post("/api/public/contact-message", json={
        "fullName": "Subject Pax",
        "email": "subject.pax@gmail.com",
        "airportIata": "MIR",
        "subject": "Baggage delay at MIR",
        "message": "My luggage did not arrive."
    })
    assert resp1.status_code == 201
    ref_id = resp1.json()["reference_id"]

    # 2. Reply with reference in subject
    resp2 = client.post("/api/public/contact-message", json={
        "fullName": "Subject Pax",
        "email": "subject.pax@gmail.com",
        "airportIata": "MIR",
        "subject": f"Re: {ref_id}",
        "message": "Any updates on my luggage?"
    })
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["reference_id"] == ref_id
    assert data2.get("thread_appended") is True

    tickets = db.query(PassengerMessage).filter(
        PassengerMessage.sender_email == "subject.pax@gmail.com"
    ).all()
    assert len(tickets) == 1


def test_no_reference_creates_new_ticket(client, db):
    """Submitting without a reference ID creates a new ticket."""
    resp1 = client.post("/api/public/contact-message", json={
        "fullName": "New Pax",
        "email": "new.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "First issue",
        "message": "This is my first message."
    })
    assert resp1.status_code == 201
    ref1 = resp1.json()["reference_id"]

    resp2 = client.post("/api/public/contact-message", json={
        "fullName": "New Pax",
        "email": "new.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Second issue",
        "message": "This is a completely different issue."
    })
    assert resp2.status_code == 201
    ref2 = resp2.json()["reference_id"]
    assert ref2 != ref1

    tickets = db.query(PassengerMessage).filter(
        PassengerMessage.sender_email == "new.pax@gmail.com"
    ).all()
    assert len(tickets) == 2


def test_nonexistent_reference_creates_new_ticket(client, db):
    """Submitting with a reference ID that does not exist creates a new ticket."""
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Ghost Pax",
        "email": "ghost.pax@gmail.com",
        "airportIata": "NBE",
        "subject": "Hello",
        "message": "Regarding DJE-20250601-9999, I need help."
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["reference_id"] != "DJE-20250601-9999"
    assert data.get("thread_appended") is None


def test_reply_preserves_new_status(client, db):
    """A reply to a NEW ticket keeps it as NEW."""
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Status Pax",
        "email": "status.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Status test",
        "message": "Initial message."
    })
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()
    assert ticket.status == "NEW"

    # Reply
    client.post("/api/public/contact-message", json={
        "fullName": "Status Pax",
        "email": "status.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Follow-up",
        "message": f"More info: {ref_id}"
    })
    db.expire_all()
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()
    assert ticket.status == "NEW"


def test_reply_to_replied_ticket_returns_to_assigned(client, db, admin_token):
    """A reply to a REPLIED ticket sets status back to ASSIGNED."""
    from datetime import datetime, timezone, timedelta

    # 1. Create ticket
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Cycle Pax",
        "email": "cycle.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Cycle test",
        "message": "Initial inquiry."
    })
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()

    # 2. Admin claims and replies
    headers = {"Authorization": f"Bearer {admin_token}"}
    client.post(f"/api/admin/messages/{ticket.id}/claim", headers=headers)
    client.post(f"/api/admin/messages/{ticket.id}/reply", json={"body": "We are looking into it."}, headers=headers)

    db.expire_all()
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()
    assert ticket.status == "REPLIED"

    # Set claim expiry to future so ticket stays ASSIGNED-visible
    ticket.claim_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()

    # 3. Passenger replies with reference
    client.post("/api/public/contact-message", json={
        "fullName": "Cycle Pax",
        "email": "cycle.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Thanks",
        "message": f"Thank you for the update. {ref_id}"
    })

    db.expire_all()
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()
    assert ticket.status == "ASSIGNED"


def test_resolved_ticket_requires_confirmation(client, db):
    """A reply to a RESOLVED ticket without confirm_reopen asks for confirmation."""
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Resolved Pax",
        "email": "resolved.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Resolved test",
        "message": "My issue is now solved."
    })
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()

    # Manually resolve
    ticket.status = "RESOLVED"
    ticket.resolved_at = datetime.now(timezone.utc)
    db.commit()

    # Reply without confirm_reopen
    resp2 = client.post("/api/public/contact-message", json={
        "fullName": "Resolved Pax",
        "email": "resolved.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Reopen",
        "message": f"I still need help. {ref_id}"
    })
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2.get("requires_confirmation") is True


def test_resolved_ticket_with_confirmation_reopens(client, db):
    """A reply to a RESOLVED ticket with confirm_reopen=True reopens and appends."""
    resp = client.post("/api/public/contact-message", json={
        "fullName": "Reopen Pax",
        "email": "reopen.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Reopen test",
        "message": "Need help with this."
    })
    ref_id = resp.json()["reference_id"]
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()

    # Manually resolve
    ticket.status = "RESOLVED"
    ticket.resolved_at = datetime.now(timezone.utc)
    db.commit()

    # Reply with confirm_reopen=True
    resp2 = client.post("/api/public/contact-message", json={
        "fullName": "Reopen Pax",
        "email": "reopen.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Reopen",
        "message": f"Still need assistance. {ref_id}",
        "confirm_reopen": True
    })
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["reference_id"] == ref_id
    assert data2.get("thread_appended") is True

    db.expire_all()
    ticket = db.query(PassengerMessage).filter(PassengerMessage.reference_id == ref_id).first()
    assert ticket.status != "RESOLVED"
    assert ticket.resolved_at is None


# ── Delete ownership validation ──────────────────────────────────────────────


def test_admin_deletes_own_assigned_ticket(client, db, admin_token, mir_admin_user):
    """Admin can delete a ticket assigned to them."""
    client.post("/api/public/contact-message", json={
        "fullName": "Own Ticket Pax",
        "email": "own.ticket@gmail.com",
        "airportIata": "TUN",
        "subject": "Claim this",
        "message": "Please assign this to me."
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id

    headers = {"Authorization": f"Bearer {admin_token}"}
    client.post(f"/api/admin/messages/{ticket_id}/claim", headers=headers)

    db.expire_all()
    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first()
    assert ticket.assigned_admin_id is not None

    resp = client.delete(f"/api/admin/messages/{ticket_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    db.expire_all()
    assert db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first() is None


def test_admin_deletes_unassigned_ticket(client, db, admin_token):
    """Admin is blocked from deleting an unassigned ticket."""
    client.post("/api/public/contact-message", json={
        "fullName": "Unassigned Pax",
        "email": "unassigned.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "No owner",
        "message": "This ticket has no owner."
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id

    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.delete(f"/api/admin/messages/{ticket_id}", headers=headers)
    assert resp.status_code == 403
    assert "You can only delete tickets assigned to you." in resp.json()["error"]


def test_admin_deletes_other_admins_ticket(client, db, admin_token, mir_admin_user):
    """Admin is blocked from deleting a ticket assigned to another admin."""
    # Create TUN ticket
    client.post("/api/public/contact-message", json={
        "fullName": "Other Admin Pax",
        "email": "other.admin.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Other's ticket",
        "message": "Belongs to someone else."
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id

    # MIR admin claims it (but TUN ticket — MIR can't claim TUN tickets, so assign via DB)
    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first()
    ticket.assigned_admin_id = mir_admin_user.id
    ticket.status = "ASSIGNED"
    db.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.delete(f"/api/admin/messages/{ticket_id}", headers=headers)
    assert resp.status_code == 403
    assert "You can only delete tickets assigned to you." in resp.json()["error"]


def test_super_admin_deletes_assigned_ticket(client, db, admin_token, super_admin_token):
    """Super Admin can delete a ticket even when it is assigned to an admin."""
    client.post("/api/public/contact-message", json={
        "fullName": "Super Own Pax",
        "email": "super.own.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Super delete",
        "message": "Super admin will delete this."
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id

    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    client.post(f"/api/admin/messages/{ticket_id}/claim", headers=headers_admin)

    db.expire_all()
    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first()
    assert ticket.assigned_admin_id is not None

    headers_super = {"Authorization": f"Bearer {super_admin_token}"}
    resp = client.delete(f"/api/admin/messages/{ticket_id}", headers=headers_super)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    db.expire_all()
    assert db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first() is None


def test_super_admin_deletes_unassigned_ticket(client, db, super_admin_token):
    """Super Admin can delete an unassigned ticket."""
    client.post("/api/public/contact-message", json={
        "fullName": "Super Unassigned Pax",
        "email": "super.unassigned.pax@gmail.com",
        "airportIata": "TUN",
        "subject": "Super unassigned",
        "message": "Super admin deletes unowned ticket."
    })
    ticket_id = db.query(PassengerMessage).order_by(PassengerMessage.id.desc()).first().id

    headers_super = {"Authorization": f"Bearer {super_admin_token}"}
    resp = client.delete(f"/api/admin/messages/{ticket_id}", headers=headers_super)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    db.expire_all()
    assert db.query(PassengerMessage).filter(PassengerMessage.id == ticket_id).first() is None

