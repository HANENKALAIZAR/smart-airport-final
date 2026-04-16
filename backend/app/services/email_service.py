"""
Smart Airport Operations – Email Service
=========================================
Sends HTML emails via Gmail SMTP (App Password).
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)


# ── Airport display names map ─────────────────────────────────
AIRPORT_DISPLAY = {
    "TUN": "Tunis-Carthage",
    "MIR": "Monastir-Habib Bourguiba",
    "DJE": "Djerba-Zarzis",
    "NBE": "Enfidha-Hammamet",
}


def _build_welcome_email(
    full_name: str,
    work_email: str,
    temp_password: str,
    airport_iata: str,
    login_url: str,
) -> str:
    """HTML welcome email: credentials go to personal inbox; body shows login (work) email."""
    airport_display = AIRPORT_DISPLAY.get(airport_iata, airport_iata)
    year = datetime.utcnow().year
    first = full_name.split()[0] if full_name.strip() else "there"

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Airport admin account</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">

      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.09);max-width:600px;width:100%;">

        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#1E90FF);
                     padding:32px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">&#9992;&#65039;</div>
            <h1 style="color:#fff;margin:0;font-size:1.35rem;font-weight:700;">
              Smart Airport Operations
            </h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:0.9rem;">
              {airport_display}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="color:#1E293B;font-size:1.05rem;margin:0 0 16px;line-height:1.6;">
              Hello {first},
            </p>
            <p style="color:#334155;font-size:0.95rem;margin:0 0 20px;line-height:1.65;">
              Your airport admin account has been created for
              <strong>{airport_display}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#F1F5F9;border-radius:12px;border:1px solid #E2E8F0;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="margin:0 0 10px;font-size:0.9rem;color:#334155;line-height:1.6;">
                    <strong>Your login email:</strong><br/>
                    <span style="font-family:monospace;font-size:1rem;color:#0F172A;">{work_email}</span>
                  </p>
                  <p style="margin:0;font-size:0.9rem;color:#334155;line-height:1.6;">
                    <strong>Your temporary password:</strong><br/>
                    <span style="font-family:monospace;font-size:1.05rem;font-weight:700;color:#4338CA;letter-spacing:0.06em;">{temp_password}</span>
                  </p>
                </td>
              </tr>
            </table>
            <p style="color:#475569;font-size:0.92rem;margin:22px 0 0;line-height:1.6;">
              Please log in and change your password immediately.
            </p>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:0 40px 36px;text-align:center;">
            <a href="{login_url}"
               style="display:inline-block;padding:14px 36px;background:#1E90FF;
                      color:#fff;text-decoration:none;border-radius:10px;
                      font-weight:700;font-size:0.95rem;">
              Log in
            </a>
            <p style="margin:14px 0 0;font-size:0.78rem;color:#94A3B8;">
              <a href="{login_url}" style="color:#1E90FF;">{login_url}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 28px;">
            <p style="margin:0;font-size:0.8rem;color:#94A3B8;line-height:1.5;text-align:center;">
              If you did not expect this message, contact your Super Admin.<br/>
              Sent automatically by Smart Airport Operations.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;
                     padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:0.72rem;color:#CBD5E1;">
              &copy; {year} Smart Airport Operations &middot; {airport_display}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>
"""


def send_welcome_email(
    full_name: str,
    personal_email: str,
    work_email: str,
    temp_password: str,
    airport_iata: str,
    id_verification_required: bool = False,
) -> bool:
    """
    Send welcome email to the admin's personal address.
    Body states their work (login) email and temporary password.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured — skipping welcome email.")
        return False

    base = (settings.FRONTEND_URL or "").rstrip("/")
    login_url = f"{base}/login"
    personal_email = personal_email.strip()
    work_email = work_email.lower().strip()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your airport admin account — {full_name.split()[0] if full_name.strip() else 'Admin'}"
    msg["From"] = f"Smart Airport Ops <{settings.SMTP_USER}>"
    msg["To"] = personal_email

    html_body = _build_welcome_email(
        full_name, work_email, temp_password, airport_iata, login_url
    )
    if id_verification_required:
        id_warn = (
            '<tr><td style="padding:0 40px 20px;">'
            '<table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px;">'
            '<tr><td style="padding:14px 18px;">'
            '<p style="margin:0;color:#991B1B;font-size:0.83rem;line-height:1.5;">'
            '<strong>Identity verification:</strong> Please have your ID (CIN or Passport) ready. '
            'You will upload it during first login.'
            '</p></td></tr></table></td></tr>'
        )
        html_body = html_body.replace('<!-- CTA Button -->', id_warn + '\n        <!-- CTA Button -->')

    text_body = (
        f"Hello,\n\n"
        f"Your airport admin account has been created.\n\n"
        f"Your login email: {work_email}\n"
        f"Your temporary password: {temp_password}\n\n"
        f"Please log in and change your password immediately.\n"
        f"{login_url}\n"
    )

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [personal_email], msg.as_string())
        logger.info(f"Welcome email sent to personal {personal_email} (login: {work_email})")
        return True
    except Exception as exc:
        logger.error(f"Failed to send welcome email to {personal_email}: {exc}")
        return False


def send_id_document_review_request_to_super_admins(
    admin_full_name: str,
    airport_iata: str,
    super_admin_emails: list[str],
) -> int:
    """Notify all active super admins that an admin submitted ID for review."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD or not super_admin_emails:
        logger.warning("SMTP or super admin list missing — skipping ID review notification.")
        return 0
    airport_display = AIRPORT_DISPLAY.get(airport_iata, airport_iata or "Unknown")
    subject = f"ID document pending review — {admin_full_name}"
    body = (
        f"Admin {admin_full_name} assigned to {airport_display} ({airport_iata or '—'}) has completed "
        f"their profile and submitted their ID document for review. Please log in to review and approve."
    )
    html = f"""<html><body style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#1E293B;">
    <p>{body}</p>
    <p style="color:#64748B;font-size:13px;">Smart Airport Operations</p>
    </body></html>"""
    sent = 0
    for to_addr in super_admin_emails:
        to_addr = (to_addr or "").strip()
        if not to_addr:
            continue
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Smart Airport Ops <{settings.SMTP_USER}>"
        msg["To"] = to_addr
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(html, "html"))
        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, [to_addr], msg.as_string())
            sent += 1
        except Exception as exc:
            logger.error(f"ID review email failed for {to_addr}: {exc}")
    return sent


def send_id_rejection_email(
    personal_email: str,
    admin_first_name: str,
    reason: str,
) -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping ID rejection email.")
        return False
    to_addr = (personal_email or "").strip()
    if not to_addr:
        return False
    subject = "ID document requires re-upload"
    text = (
        f"Hello {admin_first_name},\n\n"
        f"Your ID document was rejected. Reason: {reason}\n\n"
        f"Please log in and re-upload a valid document.\n"
    )
    html = f"""<html><body style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;">
    <p>Hello {admin_first_name},</p>
    <p>Your ID document was rejected.</p>
    <p><strong>Reason:</strong> {reason}</p>
    <p>Please log in and re-upload a valid document.</p>
    </body></html>"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Smart Airport Ops <{settings.SMTP_USER}>"
    msg["To"] = to_addr
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_addr], msg.as_string())
        logger.info(f"ID rejection email sent to {to_addr}")
        return True
    except Exception as exc:
        logger.error(f"ID rejection email failed: {exc}")
        return False


def send_password_reset_email(
    personal_email: str,
    reset_url: str,
    first_name: str,
) -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping password reset email.")
        return False
    to_addr = (personal_email or "").strip()
    if not to_addr:
        return False
    subject = "Reset your Smart Airport admin password"
    text = (
        f"Hello {first_name},\n\n"
        f"Use this link to reset your password (valid 24 hours, one use):\n{reset_url}\n\n"
        f"If you did not request this, ignore this email.\n"
    )
    html = f"""<html><body style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;">
    <p>Hello {first_name},</p>
    <p>Use the button below to reset your password. This link is valid for <strong>24 hours</strong> and can only be used once.</p>
    <p><a href="{reset_url}" style="display:inline-block;padding:12px 24px;background:#1E90FF;color:#fff;
    text-decoration:none;border-radius:8px;font-weight:600;">Reset password</a></p>
    <p style="word-break:break-all;font-size:13px;color:#64748B;">{reset_url}</p>
    </body></html>"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Smart Airport Ops <{settings.SMTP_USER}>"
    msg["To"] = to_addr
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_addr], msg.as_string())
        logger.info(f"Password reset email sent to {to_addr}")
        return True
    except Exception as exc:
        logger.error(f"Password reset email failed: {exc}")
        return False


