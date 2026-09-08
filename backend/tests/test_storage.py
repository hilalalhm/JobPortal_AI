"""Unit test untuk application_storage & profile_storage."""
import json
import sys
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest

from services import application_storage
from services import profile_storage

# ============================================================
# FIXTURES — isolasi storage via monkeypatch
# ============================================================

@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    apps_dir = tmp_path / "applications"
    apps_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(
        application_storage,
        "APPLICATIONS_DIR",
        apps_dir,
    )
    monkeypatch.setattr(
        profile_storage,
        "PROFILE_PATH",
        tmp_path / "profile.json",
    )


# ============================================================
# APPLICATION STORAGE
# ============================================================

def test_create_application_saves_file():
    app = application_storage.create_application(
        {"position": "Dev"},
        status="saved",
    )
    assert app["id"]
    assert app["status"] == "saved"
    assert app["notes"] == ""
    assert app["cover_letter"] == ""
    assert app["created_at"] == app["updated_at"]

    path = application_storage.APPLICATIONS_DIR / f"{app['id']}.json"
    assert path.exists()


def test_create_application_invalid_status_becomes_saved():
    app = application_storage.create_application(
        {"position": "Dev"},
        status="bogus",
    )
    assert app["status"] == "saved"


def test_list_applications_newest_first():
    a = application_storage.create_application({"position": "A"})
    b = application_storage.create_application({"position": "B"})

    apps = application_storage.list_applications()
    assert [x["job"]["position"] for x in apps] == ["B", "A"]


def test_get_application_missing_returns_none():
    assert application_storage.get_application("nope") is None


def test_update_application_status():
    app = application_storage.create_application({"position": "A"})
    updated = application_storage.update_application(
        app["id"],
        {"status": "interview"},
    )
    assert updated["status"] == "interview"


def test_update_application_invalid_status_ignored():
    app = application_storage.create_application({"position": "A"})
    updated = application_storage.update_application(
        app["id"],
        {"status": "bogus"},
    )
    assert updated["status"] == "saved"


def test_update_application_cover_letter():
    app = application_storage.create_application({"position": "A"})
    updated = application_storage.update_application(
        app["id"],
        {"cover_letter": "Halo"},
    )
    assert updated["cover_letter"] == "Halo"


def test_update_application_missing_returns_none():
    assert (
        application_storage.update_application(
            "nope",
            {"status": "applied"},
        )
        is None
    )


def test_delete_application():
    app = application_storage.create_application({"position": "A"})
    assert application_storage.delete_application(app["id"]) is True
    assert application_storage.delete_application(app["id"]) is False


def test_corrupted_file_ignored():
    app = application_storage.create_application({"position": "A"})
    path = application_storage.APPLICATIONS_DIR / f"{app['id']}.json"
    path.write_text("{bad json", encoding="utf-8")

    assert application_storage.get_application(app["id"]) is None
    assert application_storage.list_applications() == []


# ============================================================
# PROFILE STORAGE
# ============================================================

def test_default_profile():
    profile = profile_storage.get_profile()
    assert profile["name"] == ""
    assert profile["cv"] is None
    assert profile["updated_at"] is None


def test_update_profile_defaults_empty_non_provided():
    profile = profile_storage.update_profile(
        {"name": "  Andi  "},
    )
    assert profile["name"] == "Andi"
    assert profile["email"] == ""
    assert profile["updated_at"] is not None


def test_update_profile_none_clears():
    profile_storage.update_profile({"name": "Andi"})
    profile = profile_storage.update_profile({"name": None})
    assert profile["name"] == ""


def test_update_profile_persists():
    profile_storage.update_profile(
        {
            "name": "Andi",
            "email": "andi@x.com",
        }
    )

    loaded = profile_storage.get_profile()
    assert loaded["name"] == "Andi"
    assert loaded["email"] == "andi@x.com"


def test_set_cv_metadata():
    profile = profile_storage.set_cv(
        filename="CV.pdf",
        path=Path("/tmp/CV.pdf"),
    )
    assert profile["cv"]["filename"] == "CV.pdf"
    assert profile["cv"]["path"]
    assert profile["cv"]["uploaded_at"]


def test_updated_at_isoformat():
    profile_storage.update_profile({"phone": "08"})
    updated = profile_storage.get_profile()["updated_at"]

    # harus bisa di-parse sebagai ISO
    datetime.fromisoformat(updated)