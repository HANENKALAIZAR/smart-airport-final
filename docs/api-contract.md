# API Contract Baseline — Phase 0 Contract Freeze

> **STATUS: FROZEN**
> This document captures the exact API contract at the time of the refactor.
> Do NOT modify this file during refactoring phases.
> Any divergence from these shapes during refactoring constitutes a breaking change.

---

## 1. Authentication Endpoints

### POST `/api/auth/login`
**Rate Limit:** 10 requests/minute per IP

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Success Response `200 OK`:**
```json
{
  "access_token": "string (JWT)",
  "token_type": "bearer",
  "must_change_password": false,
  "profile_complete": false,
  "is_approved": false,
  "user": { /* See UserOut shape below */ }
}
```

**Error Responses:**
- `401 Unauthorized` — `{ "detail": "Invalid email or password" }`
- `403 Forbidden` — `{ "detail": "Account is deactivated" }`
- `429 Too Many Requests` — Rate limit exceeded

---

### POST `/api/auth/change-password`
**Auth Required:** Yes (Bearer token)

**Request Body:**
```json
{
  "current_password": "string (required if must_change_password=0)",
  "new_password": "string"
}
```

**Success Response `200`:**
```json
{ "message": "Password updated successfully" }
```

**Error Responses:**
- `401` — `{ "detail": "Current password is incorrect" }`
- `422` — `{ "detail": "new_password is required" }`
- `422` — `{ "detail": "New password must be at least 8 characters" }`
- `422` — `{ "detail": "New password must contain at least one uppercase letter" }`
- `422` — `{ "detail": "New password must contain at least one number" }`
- `422` — `{ "detail": "New password must contain at least one special character (!@#$%^&*)" }`
- `422` — `{ "detail": "New password must be different from your current password" }`

---

### GET `/api/auth/me`
**Auth Required:** Yes (Bearer token)

**Success Response `200`:**
```json
{ /* UserOut shape — see Section 2 */ }
```

---

### POST `/api/auth/forgot-password`
**Request Body:**
```json
{ "work_email": "string" }
```

### POST `/api/auth/reset-password`
**Request Body:**
```json
{
  "token": "string",
  "new_password": "string",
  "confirm_password": "string"
}
```

---

## 2. Core Object Shapes (Frozen)

### `UserOut` (returned in login and `/me`)
```json
{
  "id": 1,
  "email": "string",
  "full_name": "string",
  "role": "admin | super_admin | passenger",
  "is_active": 1,
  "airport_iata": "TUN | null",
  "must_change_password": 0,
  "profile_complete": 0,
  "is_approved": false,
  "personal_email": "string | null",
  "employee_id": "string | null",
  "phone_number": "string | null",
  "date_of_birth": "YYYY-MM-DD | null",
  "nationality": "string | null",
  "gender": "Male | Female | null",
  "residential_address": "string | null",
  "emergency_contact_name": "string | null",
  "emergency_contact_phone": "string | null",
  "emergency_contact_relationship": "Parent | Spouse | Sibling | Friend | Other | null",
  "cin_number": "string | null",
  "cin_document_url": "string | null",
  "passport_number": "string | null",
  "passport_document_url": "string | null",
  "passport_expiry_date": "YYYY-MM-DD | null",
  "profile_photo_url": "string | null",
  "id_document_status": "pending | approved | rejected | null",
  "id_document_rejection_reason": "string | null",
  "rejected_fields": ["field_name"] 
}
```

### `TokenOut` (login response wrapper)
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "must_change_password": false,
  "profile_complete": false,
  "is_approved": false,
  "user": { /* UserOut */ }
}
```

### `FlightListOut`
```json
{
  "id": 1,
  "flight_number": "TU718",
  "scheduled_departure": "ISO8601 datetime",
  "scheduled_arrival": "ISO8601 datetime",
  "status": "scheduled | on_time | delayed | cancelled",
  "delay_minutes": 0,
  "distance_km": 1490,
  "aircraft_type": "A320 | null",
  "airline": { "id": 1, "iata_code": "TU", "name": "string", "reliability_score": 0.71 },
  "origin_airport": { "id": 1, "iata_code": "TUN", "name": "string", "city": "string", "country": "string", "region": "string" },
  "dest_airport":   { "id": 2, "iata_code": "CDG", "name": "string", "city": "string", "country": "string", "region": "string" }
}
```

### `FlightDetailOut` (extends FlightListOut)
```json
{
  "actual_departure": "ISO8601 | null",
  "actual_arrival":   "ISO8601 | null",
  "prediction": { /* PredictionOut | null */ },
  "passenger_rights": [ /* PassengerRightOut[] */ ]
}
```

### `PredictionOut`
```json
{
  "risk_score": 78.4,
  "predicted_delay_min": 85,
  "confidence": 0.784,
  "shap_explanation": { "feature": 12.3 },
  "model_version": "string | null",
  "predicted_at": "ISO8601 | null"
}
```

### `DashboardOverview`
```json
{
  "total_flights": 5000,
  "on_time_count": 3606,
  "delayed_count": 1394,
  "cancelled_count": 42,
  "at_risk_count": 187,
  "avg_delay_minutes": 68.3,
  "delay_rate": 27.9
}
```

### `MessageOut`
```json
{
  "id": 1,
  "direction": "string",
  "from_user_id": 1,
  "from_user_name": "string",
  "from_user_airport": "TUN | null",
  "to_user_id": 2,
  "to_user_name": "string | null",
  "category": "string",
  "subject": "string",
  "body": "string",
  "status": "pending | in_progress | resolved",
  "is_read": false,
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "replies": [ /* MessageReplyOut[] */ ]
}
```

---

## 3. JWT Payload Structure (Frozen)

```json
{
  "sub": "1",
  "role": "admin | super_admin | passenger",
  "airport": "TUN | null",
  "exp": 1745500000
}
```

**Algorithm:** `HS256`
**Expiry:** Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 60 minutes)
**Transport:** `Authorization: Bearer <token>` header

---

## 4. Standard Error Response Format (Frozen)

All FastAPI HTTP errors follow this shape:
```json
{ "detail": "Human-readable error message" }
```

Validation errors (422) follow:
```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "error message",
      "type": "error_type"
    }
  ]
}
```

---

## 5. RBAC Enforcement Map (Frozen)

| Dependency                          | Enforces                                           |
|-------------------------------------|----------------------------------------------------|
| `get_current_user`                  | Valid JWT + active account                         |
| `require_admin`                     | `role in (admin, super_admin)`                     |
| `require_super_admin`               | `role == super_admin`                              |
| `require_approved_admin`            | `role in (admin, super_admin)` + `id_document_status == approved` (admins only) |
| `require_correction_or_approved_admin` | `role in (admin, super_admin)` + `id_document_status in (approved, rejected)` |

---

## 6. Frontend localStorage Keys (Frozen)

| Key                    | Value                                 |
|------------------------|---------------------------------------|
| `admin_token`          | Raw JWT string                        |
| `admin_user`           | Minimal JSON: `{id, email, role, status, token}` |
| `admin_role`           | Role string fallback                  |
| `admin_airport_iata`   | Airport IATA code string              |
| `admin_sidebar_collapsed` | `"true" | "false"`               |

---

## 7. Prediction Request Shape (Frozen)

### POST `/api/predictions`
```json
{
  "weather_severity": 0.0,
  "origin_weather_severity": 0.0,
  "dest_weather_severity": 0.0,
  "hour_of_day": 14,
  "day_of_week": 2,
  "month": 2,
  "is_weekend": 0,
  "congestion_level": 0.5,
  "origin_congestion": 0.4,
  "dest_congestion": 0.6,
  "airline_reliability": 0.71,
  "distance_km": 1490,
  "historical_delay_rate": 0.28
}
```

---

*Document generated: 2026-04-24 — Phase 0 Contract Freeze*
*DO NOT EDIT. This is a reference baseline only.*
