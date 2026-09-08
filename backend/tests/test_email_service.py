"""Unit test untuk email_service: konfigurasi, TLS vs SSL, validasi."""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest

from services import email_service


@pytest.fixture(autouse=True)
def clear_env(monkeypatch):
    for key in (
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASS",
        "SMTP_FROM",
        "SMTP_FROM_NAME",
        "SMTP_TLS",
    ):
        monkeypatch.delenv(key, raising=False)


def test_not_configured_without_host():
    assert email_service.is_configured() is False

    with pytest.raises(RuntimeError):
        email_service.send_email(
            "to@t.com",
            "subj",
            "body",
        )


def test_send_email_starttls(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.test.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "user@test.com")
    monkeypatch.setenv("SMTP_PASS", "secret")
    monkeypatch.setenv("SMTP_TLS", "true")

    calls = {"starttls": 0, "login": 0, "send": 0, "secure_used": False}

    class FakeSMTP:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self):
            calls["starttls"] += 1

        def login(self, u, p):
            calls["login"] += 1

        def send_message(self, m):
            calls["send"] += 1
            assert m["To"] == "to@t.com"

    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)

    result = email_service.send_email(
        "to@t.com",
        "subj",
        "body",
    )
    assert calls["starttls"] == 1
    assert calls["login"] == 1
    assert calls["send"] == 1
    assert result["to"] == "to@t.com"


def test_send_email_ssl_port465(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.test.com")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_TLS", "false")

    ssl_used = []

    class FakeSMTP_SSL:
        def __init__(self, *a, **k):
            ssl_used.append((a, k))

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def login(self, u, p):
            pass

        def send_message(self, m):
            pass

    monkeypatch.setattr(email_service.smtplib, "SMTP_SSL", FakeSMTP_SSL)

    email_service.send_email(
        "to@t.com",
        "subj",
        "body",
    )
    assert ssl_used, "SMTP_SSL harus dipakai untuk port 465"


def test_empty_to_raises(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.test.com")
    with pytest.raises(RuntimeError):
        email_service.send_email("", "subj", "body")


def test_attachment_added(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.test.com")
    monkeypatch.setenv("SMTP_TLS", "true")

    class FakeSMTP:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self):
            pass

        def login(self, u, p):
            pass

        def send_message(self, msg):
            # body harus ada
            assert "body" in str(msg)
            # attachment harus tertanam (multipart dengan 2 bagian)
            if msg.is_multipart():
                attachments = [
                    part
                    for part in msg.iter_parts()
                    if part.get_content_disposition() == "attachment"
                ]
            else:
                attachments = []

            assert len(attachments) == 1
            assert attachments[0].get_filename() == "CV.pdf"

    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)

    result = email_service.send_email(
        "to@t.com",
        "subj",
        "body",
        attachment_bytes=b"%PDF-fake",
        attachment_name="CV.pdf",
    )
    assert result["attachment"] == "CV.pdf"