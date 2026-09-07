import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr


def _get(key, default=""):
    return os.getenv(key, default)


def is_configured():
    return bool(_get("SMTP_HOST"))


def _from_address():
    user = _get("SMTP_USER")
    sender = _get("SMTP_FROM") or user
    name = _get("SMTP_FROM_NAME") or "JobPilot AI"

    return formataddr((name, sender))


def send_email(
    to_email,
    subject,
    body,
    attachment_bytes=None,
    attachment_name="CV.pdf",
):
    if not is_configured():
        raise RuntimeError(
            "SMTP belum dikonfigurasi. "
            "Isi SMTP_HOST (dan SMTP_USER/SMTP_PASS) "
            "di file .env."
        )

    host = _get("SMTP_HOST")
    port = int(_get("SMTP_PORT", "587"))
    user = _get("SMTP_USER")
    password = _get("SMTP_PASS")
    use_tls = _get("SMTP_TLS", "true").lower() == "true"

    if not to_email:
        raise RuntimeError(
            "Alamat email tujuan kosong."
        )

    message = EmailMessage()

    message["Subject"] = subject
    message["From"] = _from_address()
    message["To"] = to_email
    message.set_content(body)

    if attachment_bytes:
        message.add_attachment(
            attachment_bytes,
            maintype="application",
            subtype="pdf",
            filename=attachment_name,
        )

    with smtplib.SMTP(host, port, timeout=30) as server:

        if use_tls:
            server.starttls()

        if user:
            server.login(user, password)

        server.send_message(message)

    return {
        "to": to_email,
        "subject": subject,
        "attachment": attachment_name if attachment_bytes else None,
    }