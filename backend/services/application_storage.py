import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

APPLICATIONS_DIR = BASE_DIR / "storage" / "applications"

APPLICATIONS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

VALID_STATUSES = {
    "saved",
    "applied",
    "interview",
    "offered",
    "rejected",
}


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _file_path(app_id):
    return APPLICATIONS_DIR / f"{app_id}.json"


def _read_file(path):
    with open(
        path,
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def _write_file(path, data):
    with open(
        path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2,
        )


def create_application(job_data, status="saved"):
    if status not in VALID_STATUSES:
        status = "saved"

    now = _now_iso()

    application = {
        "id": uuid.uuid4().hex,
        "status": status,
        "job": job_data,
        "notes": "",
        "created_at": now,
        "updated_at": now,
    }

    _write_file(
        _file_path(application["id"]),
        application,
    )

    return application


def list_applications():
    applications = []

    for path in APPLICATIONS_DIR.glob("*.json"):
        try:
            applications.append(_read_file(path))

        except (OSError, json.JSONDecodeError):
            continue

    applications.sort(
        key=lambda app: app.get(
            "created_at",
            "",
        ),
        reverse=True,
    )

    return applications


def get_application(app_id):
    path = _file_path(app_id)

    if not path.exists():
        return None

    try:
        return _read_file(path)

    except (OSError, json.JSONDecodeError):
        return None


def update_application(app_id, updates):
    application = get_application(app_id)

    if not application:
        return None

    for key, value in updates.items():
        if key == "status":
            if value in VALID_STATUSES:
                application["status"] = value

        elif key == "notes":
            application["notes"] = value or ""

        elif key == "job":
            application["job"] = value

    application["updated_at"] = _now_iso()

    _write_file(
        _file_path(app_id),
        application,
    )

    return application


def delete_application(app_id):
    path = _file_path(app_id)

    if not path.exists():
        return False

    path.unlink()

    return True