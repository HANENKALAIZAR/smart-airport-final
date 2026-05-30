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
    login_url = f"{base}/admin/login"
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


def send_passenger_reply_email(
    passenger_name: str,
    passenger_email: str,
    original_subject: str,
    original_body: str,
    reply_body: str,
    admin_name: str,
    airport_iata: str,
    reference_id: str,
    message_id_header: str = None,
    in_reply_to_header: str = None,
    references_header: str = None,
) -> bool:
    """
    Sends a premium-styled HTML email reply to a passenger's feedback/inquiry.
    Includes headers for email threading and disclaimers.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(f"SMTP not configured — skipping passenger reply email to {passenger_email}.")
        return False
    
    to_addr = (passenger_email or "").strip()
    if not to_addr:
        return False

    airport_display = AIRPORT_DISPLAY.get(airport_iata, airport_iata)
    subject = f"Re: {original_subject}"
    
    text = (
        f"Hello {passenger_name},\n\n"
        f"Thank you for contacting {airport_display} Airport. Our team has reviewed your inquiry:\n\n"
        f"\" {original_body} \"\n\n"
        f"--- Reply from {admin_name} ({airport_display}): ---\n"
        f"{reply_body}\n\n"
        f"Best regards,\n"
        f"Smart Airport Operations Network\n\n"
        f"--------------------------------------------------\n"
        f"This message was sent from the Smart Airport Operations Support Desk.\n"
        f"Please do not reply directly to this email.\n"
        f"Email replies are currently not monitored by the airport operations team.\n\n"
        f"Please do not share sensitive payment or identity information by email.\n\n"
        f"For additional assistance or follow-up requests, please submit a new message\n"
        f"through the official contact portal and include your reference ID.\n\n"
        f"Reference ID: {reference_id}\n"
        f"--------------------------------------------------"
    )
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 20px; color: #1E293B; }}
        .card {{ background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 600px; margin: 0 auto; overflow: hidden; border: 1px solid #E2E8F0; }}
        .header {{ background: linear-gradient(135deg, #1e3a5f, #1E90FF); color: #ffffff; padding: 24px 32px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .header p {{ margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); }}
        .content {{ padding: 32px; }}
        .greeting {{ font-size: 16px; font-weight: 600; margin-bottom: 16px; }}
        .reply-box {{ background: #F1F5F9; border-left: 4px solid #1E90FF; border-radius: 8px; padding: 18px; margin: 24px 0; font-size: 15px; line-height: 1.6; color: #0F172A; white-space: pre-line; }}
        .original-quote {{ font-style: italic; color: #64748B; padding-left: 12px; border-left: 2px solid #CBD5E1; margin: 16px 0; font-size: 13px; }}
        .disclaimer-box {{ background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 12px 16px; margin: 24px 0; font-size: 12px; color: #B45309; line-height: 1.5; }}
        .footer {{ background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 32px; text-align: center; font-size: 11px; color: #94A3B8; line-height: 1.6; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Smart Airport Operations</h1>
          <p>{airport_display} Airport Office</p>
        </div>
        <div class="content">
          <div class="greeting">Hello {passenger_name},</div>
          <p>Thank you for contacting our customer assistance desk. A representative from our operations team has responded to your feedback:</p>
          
          <div class="reply-box">
            <strong>Response from {admin_name}:</strong><br/>
            {reply_body}
          </div>

          <div class="disclaimer-box">
            <strong>⚠️ Security & Response Warning:</strong><br/>
            This message was sent from the airport operations support desk. Please do not share sensitive payment or identity information by email.
          </div>

          <p style="font-size: 13px; color: #64748B; font-weight: 600; margin-top: 32px; margin-bottom: 4px;">Original Inquiry Details:</p>
          <div class="original-quote">
            <strong>Subject:</strong> {original_subject}<br/>
            "{original_body}"
          </div>

          <p style="margin-top: 24px; font-size: 14px;">If you have any further questions, please submit a new request through the contact portal.</p>
        </div>
        <div class="footer">
          <strong>Smart Airport Operations Support Desk</strong><br/>
          ⚠️ Please do not reply directly to this email. Email replies are currently not monitored.<br/>
          For additional assistance, please submit a new ticket quoting <strong>Reference ID: {reference_id}</strong>.<br/>
          Sent automatically by Smart Airport Operations Network &middot; {airport_display}<br/>
          &copy; {datetime.utcnow().year} Smart Airport. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Smart Airport Ops <{settings.SMTP_USER}>"
    msg["To"] = to_addr
    
    if message_id_header:
        msg["Message-ID"] = message_id_header
    if in_reply_to_header:
        msg["In-Reply-To"] = in_reply_to_header
    if references_header:
        msg["References"] = references_header

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))
    
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_addr], msg.as_string())
        logger.info(f"Passenger reply email sent successfully to {to_addr}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send passenger reply email to {to_addr}: {exc}")
        return False


def send_passenger_confirmation_email(
    passenger_name: str,
    passenger_email: str,
    airport_iata: str,
    subject: str,
    message_body: str,
    reference_id: str,
    message_id_header: str = None,
) -> bool:
    """
    Sends an automated HTML acknowledgment email confirming a new contact ticket request was received.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(f"SMTP not configured — skipping passenger confirmation email.")
        return False
    
    to_addr = (passenger_email or "").strip()
    if not to_addr:
        return False

    airport_display = AIRPORT_DISPLAY.get(airport_iata, airport_iata)
    email_subject = f"Received: Contact Inquiry [{reference_id}]"
    
    text = (
        f"Hello {passenger_name},\n\n"
        f"We have received your message and forwarded it to the {airport_display} Airport operations team.\n\n"
        f"Our support desk representatives will review your request shortly.\n\n"
        f"--- Ticket Details ---\n"
        f"Reference ID: {reference_id}\n"
        f"Airport: {airport_display} ({airport_iata})\n"
        f"Subject: {subject}\n\n"
        f"--------------------------------------------------\n"
        f"⚠️ Please do not reply directly to this email.\n"
        f"Replies are not monitored. To submit additional comments, open a new ticket.\n"
        f"--------------------------------------------------"
    )
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 20px; color: #1E293B; }}
        .card {{ background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 600px; margin: 0 auto; overflow: hidden; border: 1px solid #E2E8F0; }}
        .header {{ background: linear-gradient(135deg, #1e3a5f, #1E90FF); color: #ffffff; padding: 24px 32px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .header p {{ margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); }}
        .content {{ padding: 32px; }}
        .greeting {{ font-size: 16px; font-weight: 600; margin-bottom: 16px; }}
        .ticket-details {{ background: #F1F5F9; border-radius: 8px; padding: 18px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #0F172A; }}
        .footer {{ background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 32px; text-align: center; font-size: 11px; color: #94A3B8; line-height: 1.6; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Smart Airport Support</h1>
          <p>Ticket Received &middot; {airport_display}</p>
        </div>
        <div class="content">
          <div class="greeting">Hello {passenger_name},</div>
          <p>We have successfully received your inquiry and routed it to the {airport_display} operations helpdesk.</p>
          <p>Our team reviews and processes requests in order of priority. No further action is required from you at this time.</p>
          
          <div class="ticket-details">
            <strong>🎫 Ticket Information:</strong><br/>
            Reference ID: <strong>{reference_id}</strong><br/>
            Airport: {airport_display} ({airport_iata})<br/>
            Subject: {subject}<br/>
            Message Preview: <em>{message_body[:100] + ("..." if len(message_body) > 100 else "")}</em>
          </div>

          <p style="font-size: 13px; color: #64748B;">For safety reasons, please do not reply directly to this message. We look forward to assisting you.</p>
        </div>
        <div class="footer">
          <strong>Smart Airport Operations Support Desk</strong><br/>
          ⚠️ Please do not reply directly to this email. Email replies are currently not monitored.<br/>
          To provide additional information, please submit a new inquiry quoting Reference ID.<br/>
          Sent automatically by Smart Airport Operations Network &middot; {airport_display}<br/>
          &copy; {datetime.utcnow().year} Smart Airport. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = email_subject
    msg["From"] = f"Smart Airport Support <{settings.SMTP_USER}>"
    msg["To"] = to_addr
    
    if message_id_header:
        msg["Message-ID"] = message_id_header

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))
    
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_addr], msg.as_string())
        logger.info(f"Passenger confirmation email sent successfully to {to_addr}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send passenger confirmation email: {exc}")
        return False



