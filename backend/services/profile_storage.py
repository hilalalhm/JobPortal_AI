import json
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

PROFILE_PATH = BASE_DIR / "storage" / "profile.json"

DEFAULT_PROFILE = {
    "name": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "github": "",
    "cv": None,
    "updated_at": None,
}

EDITABLE_FIELDS = (
    "name",
    "email",
    "phone",
    "linkedin",
    "github",
)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def get_profile():
    if not PROFILE_PATH.exists():
        return dict(DEFAULT_PROFILE)

    try:
        with open(
            PROFILE_PATH,
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)

        profile = dict(DEFAULT_PROFILE)
        profile.update(data)

        return profile

    except (OSError, json.JSONDecodeError):
        return dict(DEFAULT_PROFILE)


def _save_profile(profile):
    PROFILE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with open(
        PROFILE_PATH,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            profile,
            file,
            ensure_ascii=False,
            indent=2,
        )


def update_profile(fields):
    profile = get_profile()

    for key in EDITABLE_FIELDS:
        if key in fields:
            value = fields[key]

            if value is None:
                profile[key] = ""

            else:
                profile[key] = str(value).strip()

    profile["updated_at"] = _now_iso()

    _save_profile(profile)

    return profile


def set_cv(filename, path):
    profile = get_profile()

    profile["cv"] = {
        "filename": filename,
        "path": str(path),
        "uploaded_at": _now_iso(),
    }

    profile["updated_at"] = _now_iso()

    _save_profile(profile)

    return profile