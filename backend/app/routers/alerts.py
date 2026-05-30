"""
Flight Alerts Router
======================
Allows passengers to subscribe for real-time flight status updates via email.

POST /api/alerts/subscribe
  Body: { email, flight_number, dep_iata, arr_iata, scheduled_departure }
  → Sends a confirmation email immediately
"""

import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertSubscription(BaseModel):
    email: str
    flight_number: str
    dep_iata: str
    arr_iata: str
    scheduled_departure: str   # ISO string e.g. "2026-05-13T10:35:00"
    airline: str = ""


def _send_alert_confirmation(
    to_email: str,
    flight_number: str,
    dep_iata: str,
    arr_iata: str,
    scheduled_departure: str,
    airline: str,
) -> bool:
    """Send a beautifully formatted confirmation email for a flight alert subscription."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping alert confirmation email")
        return False

    try:
        dt = datetime.fromisoformat(scheduled_departure.replace("Z", "+00:00"))
        dep_display = dt.strftime("%A, %b %d · %H:%M")
    except Exception:
        dep_display = scheduled_departure

    airline_display = airline or "your airline"
    year = datetime.utcnow().year

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Flight Alert Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">

      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#1E293B;border-radius:20px;overflow:hidden;
                    box-shadow:0 8px 40px rgba(0,0,0,0.4);max-width:600px;width:100%;
                    border:1px solid rgba(255,255,255,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#0ea5e9 100%);
                     padding:36px 40px;text-align:center;">
            <div style="font-size:36px;margin-bottom:10px;">✈️</div>
            <h1 style="color:#fff;margin:0;font-size:1.4rem;font-weight:700;letter-spacing:-0.02em;">
              Smart Airport · Tunisia
            </h1>
            <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:0.88rem;">
              Flight Alert Confirmation
            </p>
          </td>
        </tr>

        <!-- Flight card -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="color:#94A3B8;font-size:0.88rem;margin:0 0 20px;text-transform:uppercase;
                      letter-spacing:0.12em;">You're now tracking</p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.3);
                          border-radius:14px;">
              <tr>
                <td style="padding:24px 28px;">
                  <div style="font-size:2rem;font-weight:800;color:#fff;letter-spacing:-0.03em;
                              font-family:monospace;">{flight_number}</div>
                  <div style="color:#94A3B8;font-size:0.88rem;margin-top:4px;">{airline_display}</div>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                    <tr>
                      <td style="text-align:center;width:40%;">
                        <div style="font-size:1.5rem;font-weight:700;color:#fff;">{dep_iata}</div>
                        <div style="color:#94A3B8;font-size:0.78rem;margin-top:2px;">Origin</div>
                      </td>
                      <td style="text-align:center;color:#0ea5e9;font-size:1.4rem;">→</td>
                      <td style="text-align:center;width:40%;">
                        <div style="font-size:1.5rem;font-weight:700;color:#fff;">{arr_iata}</div>
                        <div style="color:#94A3B8;font-size:0.78rem;margin-top:2px;">Destination</div>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);
                              color:#CBD5E1;font-size:0.88rem;">
                    🕐 Departure: <strong style="color:#fff;">{dep_display}</strong>
                  </div>
                </td>
              </tr>
            </table>

            <p style="color:#CBD5E1;font-size:0.92rem;margin:24px 0 0;line-height:1.7;">
              You'll receive email notifications for any status changes — delays, gate changes,
              boarding calls, and cancellations — for this flight.
            </p>
          </td>
        </tr>

        <!-- What you'll receive -->
        <tr>
          <td style="padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:rgba(255,255,255,0.04);border-radius:12px;
                          border:1px solid rgba(255,255,255,0.07);">
              <tr><td style="padding:20px 24px;">
                <p style="color:#94A3B8;font-size:0.78rem;text-transform:uppercase;
                          letter-spacing:0.1em;margin:0 0 14px;">You'll be notified of</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  {"".join(f'<tr><td style="padding:5px 0;color:#CBD5E1;font-size:0.88rem;">✓ &nbsp;{item}</td></tr>'
                           for item in ["Departure delays", "Gate changes", "Boarding calls",
                                       "Flight cancellations", "Estimated arrival updates"])}
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.06);
                     padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:0.72rem;color:#475569;">
              © {year} Smart Airport Operations · Tunisia<br/>
              <span style="color:#334155;">To unsubscribe, reply STOP to this email.</span>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    text = (
        f"Flight Alert Confirmed — Smart Airport\n\n"
        f"You're now tracking flight {flight_number} ({dep_iata} → {arr_iata}).\n"
        f"Departure: {dep_display}\n\n"
        f"You'll receive email notifications for delays, gate changes, boarding calls "
        f"and cancellations.\n\n"
        f"To unsubscribe, reply STOP to this email.\n"
        f"© {year} Smart Airport Operations"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"✈ Alert activated for {flight_number} ({dep_iata} → {arr_iata})"
    msg["From"] = f"Smart Airport Alerts <{settings.SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
        logger.info(f"Alert confirmation sent to {to_email} for {flight_number}")
        return True
    except Exception as exc:
        logger.error(f"Alert email failed for {to_email}: {exc}")
        return False


@router.post("/subscribe")
async def subscribe_flight_alert(
    sub: AlertSubscription,
    background_tasks: BackgroundTasks,
):
    """
    Subscribe a passenger email to flight status alerts.
    Sends a confirmation email immediately in the background.
    """
    email = sub.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="A valid email address is required")

    background_tasks.add_task(
        _send_alert_confirmation,
        to_email=email,
        flight_number=sub.flight_number.upper(),
        dep_iata=sub.dep_iata.upper(),
        arr_iata=sub.arr_iata.upper(),
        scheduled_departure=sub.scheduled_departure,
        airline=sub.airline,
    )

    return {
        "ok": True,
        "message": f"Alert activated. A confirmation email has been sent to {email}.",
        "flight": sub.flight_number.upper(),
    }
