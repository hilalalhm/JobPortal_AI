"""Integrasi API (FastAPI TestClient) tanpa menyentuh data asli.

Strategi:
- Fixture `isolated_storage` memindahkan folder storage backend ke tmp_path
  sehingga CRUD aplikasi/profil tidak menyentuh data user nyata.
- Endpoint AI & email dimonkeypatch agar deterministik tanpa jaringan.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest

from fastapi.testclient import TestClient

import main
from services import application_storage
from services import profile_storage


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    # Pindahkan directory CV & storage ke tmp_path
    cv_dir = tmp_path / "cv"
    cv_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(main, "CV_DIR", cv_dir)

    apps_dir = tmp_path / "applications"
    apps_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(
        application_storage,
        "APPLICATIONS_DIR",
        apps_dir,
    )

    profile_path = tmp_path / "profile.json"
    monkeypatch.setattr(profile_storage, "PROFILE_PATH", profile_path)


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


@pytest.fixture(autouse=True)
def mock_ai_for_cover_letter(monkeypatch):
    """Gantikan AI cover letter dengan hasil tetap; email dimonkeypatch."""
    import services.ai_router as ar

    class FakeAI:
        def analyze_job(self, **kwargs):
            return {
                "company": "PT Contoh",
                "position": "Backend Dev",
                "subject": "Lamar [Posisi] - [Nama Lengkap]",
                "contact_email": "hrd@contoh.com",
            }

        def generate_cover_letter(self, **kwargs):
            return "Kepada Yth. Tim Rekrutmen,\n\nSalam,\nAndi Prasetyo"

    monkeypatch.setattr(
        main,
        "AIService",
        lambda: FakeAI(),
    )


# ============================================================
# HEALTH & ROOT
# ============================================================

def test_health(client):
    r = client.get("/health")
    assert r.json()["status"] == "ok"


def test_root(client):
    r = client.get("/")
    body = r.json()
    assert body["app"] == "JobPilot AI"
    assert body["status"] == "running"


# ============================================================
# PROFILE
# ============================================================

def test_profile_default_empty(client):
    r = client.get("/api/profile")
    body = r.json()
    assert body["success"] is True
    assert body["data"]["name"] == ""
    assert body["data"]["cv"] is None


def test_profile_update_and_get(client):
    r = client.put(
        "/api/profile",
        json={
            "name": "  Andi Prasetyo  ",
            "email": "andi@x.com",
        },
    )
    assert r.json()["success"] is True
    assert r.json()["data"]["name"] == "Andi Prasetyo"

    got = client.get("/api/profile").json()
    assert got["data"]["name"] == "Andi Prasetyo"


# ============================================================
# CV UPLOAD
# ============================================================

def test_cv_upload_rejects_non_pdf(client):
    r = client.post(
        "/api/profile/cv",
        files={"file": ("cv.txt", b"hello", "text/plain")},
    )
    assert r.json()["success"] is False


def test_cv_upload_rejects_fake_pdf(client):
    r = client.post(
        "/api/profile/cv",
        files={"file": ("cv.pdf", b"{}", "application/pdf")},
    )
    assert r.json()["success"] is False
    assert "bukan PDF" in r.json()["message"]


def test_cv_upload_accepts_real_pdf(client):
    r = client.post(
        "/api/profile/cv",
        files={
            "file": (
                "cv.pdf",
                b"%PDF-1.4 fake-content",
                "application/pdf",
            )
        },
    )
    assert r.json()["success"] is True
    assert r.json()["filename"] == "cv.pdf"


def test_cv_text_missing_returns_message(client):
    r = client.get("/api/profile/cv/text")
    body = r.json()
    assert body["success"] is False
    assert "belum" in body["message"].lower()


# ============================================================
# APPLICATIONS
# ============================================================

def test_create_and_list_application(client):
    r = client.post(
        "/api/applications",
        json={
            "job": {"company": "PT A", "position": "Dev"},
            "status": "saved",
        },
    )
    body = r.json()
    assert body["success"] is True
    app_id = body["data"]["id"]

    apps = client.get("/api/applications").json()
    assert len(apps["data"]) == 1
    assert apps["data"][0]["id"] == app_id


def test_create_application_invalid_status_becomes_saved(client):
    r = client.post(
        "/api/applications",
        json={
            "job": {"company": "PT A", "position": "Dev"},
            "status": "bogus",
        },
    )
    assert r.json()["data"]["status"] == "saved"


def test_get_single_application(client):
    created = client.post(
        "/api/applications",
        json={"job": {"position": "Dev"}, "status": "saved"},
    ).json()["data"]

    r = client.get(f"/api/applications/{created['id']}")
    assert r.json()["success"] is True
    assert r.json()["data"]["id"] == created["id"]


def test_get_missing_application(client):
    r = client.get("/api/applications/nope")
    assert r.json()["success"] is False


def test_patch_status(client):
    created = client.post(
        "/api/applications",
        json={"job": {"position": "Dev"}, "status": "saved"},
    ).json()["data"]

    r = client.patch(
        f"/api/applications/{created['id']}",
        json={"status": "interview"},
    )
    assert r.json()["data"]["status"] == "interview"


def test_delete_application(client):
    created = client.post(
        "/api/applications",
        json={"job": {"position": "Dev"}, "status": "saved"},
    ).json()["data"]

    r = client.delete(f"/api/applications/{created['id']}")
    assert r.json()["success"] is True

    got = client.get(f"/api/applications/{created['id']}").json()
    assert got["success"] is False


# ============================================================
# ANALYSIS INPUT (AI-dismock + URL fetch behavior)
# ============================================================

def test_analyze_input_text_only(client):
    r = client.post(
        "/api/jobs/analyze-input",
        data={"text": "Backend Dev di Jakarta"},
    )
    body = r.json()
    assert body["success"] is True
    assert body["data"]["position"] == "Backend Dev"


def test_analyze_input_with_url_sets_source(client, monkeypatch):
    monkeypatch.setattr(
        main,
        "_fetch_url_text",
        lambda url: "Isi halaman job posting",
    )

    r = client.post(
        "/api/jobs/analyze-input",
        data={
            "url": "https://ex.com/job",
        },
    )
    body = r.json()
    assert body["success"] is True
    assert body["data"]["source_url"] == "https://ex.com/job"


def test_analyze_input_empty_returns_error(client):
    r = client.post("/api/jobs/analyze-input", data={})
    assert r.json()["success"] is False


def test_analyze_input_bad_image_type(client):
    r = client.post(
        "/api/jobs/analyze-input",
        files={"image": ("x.txt", b"data", "text/plain")},
    )
    assert r.json()["success"] is False


# ============================================================
# COVER LETTER & EMAIL
# ============================================================

def test_generate_cover_letter_persists(client, monkeypatch):
    created = client.post(
        "/api/applications",
        json={
            "job": {
                "company": "PT A",
                "position": "Dev",
                "contact_email": "hrd@a.com",
            },
            "status": "saved",
        },
    ).json()["data"]

    r = client.post(
        f"/api/applications/{created['id']}/cover-letter"
    )
    assert r.json()["success"] is True
    assert r.json()["data"]["cover_letter"].startswith("Kepada Yth.")

    saved = application_storage.get_application(created["id"])
    assert saved["cover_letter"].startswith("Kepada Yth.")


def test_send_email_uses_persisted_cover_letter(client, monkeypatch):
    import main as main_module

    # Profil harus punya nama agar subjek pakai nama asli
    client.put(
        "/api/profile",
        json={"name": "Andi Prasetyo"},
    )

    sent = {}

    def fake_send_email(**kwargs):
        sent.update(kwargs)
        return {"attachment": kwargs.get("attachment_name")}

    monkeypatch.setattr(main_module, "send_email", fake_send_email)

    created = client.post(
        "/api/applications",
        json={
            "job": {
                "company": "PT A",
                "position": "Dev",
                "contact_email": "hrd@a.com",
                "subject": "Lamar_Posisi_Nama",
            },
            "status": "saved",
        },
    ).json()["data"]

    application_storage.update_application(
        created["id"],
        {"cover_letter": "Isi surat"},
    )

    r = client.post(
        f"/api/applications/{created['id']}/send-email",
        json={},
    )
    body = r.json()
    assert body["success"] is True
    assert sent["to_email"] == "hrd@a.com"
    # subject placeholder diganti dgn posisi & nama profil
    assert sent["subject"] == "Lamar_Dev_Andi Prasetyo"


def test_send_email_without_target_fails(client):
    created = client.post(
        "/api/applications",
        json={
            "job": {"company": "PT A", "position": "Dev"},
            "status": "saved",
        },
    ).json()["data"]

    r = client.post(
        f"/api/applications/{created['id']}/send-email",
        json={},
    )
    assert r.json()["success"] is False
    assert "tujuan" in r.json()["message"].lower()


def test_send_email_to_missing_application(client):
    r = client.post(
        "/api/applications/nope/send-email",
        json={},
    )
    assert r.json()["success"] is False