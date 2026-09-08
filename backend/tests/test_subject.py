"""Unit test untuk _fill_subject_placeholders di main.py."""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main

PROFILE = {"name": "Andi Saputra"}
POSITION = "IT Staff"

# (input, expected) dengan posisi tersedia
SUBJECT_CASES = [
    # ---- Nama ----
    ("Lamar_Nama_IT Staff", "Lamar_Andi Saputra_IT Staff"),
    ("Lamar_NAMA_IT", "Lamar_Andi Saputra_IT"),
    ("Lamar_Nama Lengkap_IT", "Lamar_Andi Saputra_IT"),
    ("Lamaran [Nama Lengkap]", "Lamaran Andi Saputra"),
    ("Lamaran [NAMA]", "Lamaran Andi Saputra"),
    ("Lamaran [nama_lengkap]", "Lamaran Andi Saputra"),
    ("Apply (Nama) - IT", "Apply Andi Saputra - IT"),
    ("Aplikasi <Nama>", "Aplikasi Andi Saputra"),
    ("Lamaran {Nama Lengkap}", "Lamaran Andi Saputra"),
    ("SUBJEK: {NAMA} - DevOps", "SUBJEK: Andi Saputra - DevOps"),
    ("Apply: %Nama_Lengkap% IT", "Apply: Andi Saputra IT"),
    ("$name IT Staff", "Andi Saputra IT Staff"),
    ("$NAMA IT Staff", "Andi Saputra IT Staff"),
    ("Application ~ FULLNAME ~", "Application ~ Andi Saputra ~"),
    ("App FULL_NAME", "App Andi Saputra"),
    ("SUBJEK: NAMA - Backend", "SUBJEK: Andi Saputra - Backend"),
    ("NAMA LENGKAP - Staff", "Andi Saputra - Staff"),
    ("Lamaran IT Staff tanpa nama", "Lamaran IT Staff tanpa nama"),
    ("Lamar_nama_lengkap_IT", "Lamar_Andi Saputra_IT"),
    ("Lamar_nama-lengkap_IT", "Lamar_Andi Saputra_IT"),
    # ---- Posisi ----
    ("Lamar_Posisi", "Lamar_IT Staff"),
    ("Lamar_POSISI", "Lamar_IT Staff"),
    ("Lamaran [Posisi]", "Lamaran IT Staff"),
    ("Lamaran [POSISI]", "Lamaran IT Staff"),
    ("Lamaran (Posisi) - pengalaman", "Lamaran IT Staff - pengalaman"),
    ("Aplikasi <Posisi>", "Aplikasi IT Staff"),
    ("Lamaran {POSISI}", "Lamaran IT Staff"),
    ("Apply: %Posisi% Dev", "Apply: IT Staff Dev"),
    ("$POSISI - lamaran", "IT Staff - lamaran"),
    ("$posisi lamaran", "IT Staff lamaran"),
    ("SUBJEK: POSISI - Backend", "SUBJEK: IT Staff - Backend"),
    ("POSITION - Backend", "IT Staff - Backend"),
    ("JOB TITLE - Resume", "IT Staff - Resume"),
    ("JOBTITLE: Data", "IT Staff: Data"),
    ("Lamaran Posisi yang dilamar", "Lamaran IT Staff"),
    ("Lamar_Posisi_Nama", "Lamar_IT Staff_Andi Saputra"),
    ("Lamaran [Posisi] - [Nama Lengkap]", "Lamaran IT Staff - Andi Saputra"),
    ("Kirim posisi yang dilamar", "Kirim IT Staff"),
    # ---- Format baru (has Spaces preserved) ----
    ("Lamaran Berakhir [____]", "Lamaran Berakhir Andi Saputra"),
    ("Lamaran [........] IT", "Lamaran Andi Saputra IT"),
    ("SUBJEK: Nama Lengkap Anda - IT", "SUBJEK: Andi Saputra - IT"),
    ("Lamaran NAMA LENGKAP ANDA - IT", "Lamaran Andi Saputra - IT"),
    ("Posisi - Nama", "IT Staff - Andi Saputra"),
    ("Posisi/Nama", "IT Staff/Andi Saputra"),
    ("Lamaran_Nama_Lengkap_IT", "Lamaran_Andi Saputra_IT"),
    ("Lamaran [Posisi] - Nama Anda", "Lamaran IT Staff - Andi Saputra"),
    ("Lamar IT Staff - Nama", "Lamar IT Staff - Andi Saputra"),
]


def test_all_subject_cases():
    for subject, expected in SUBJECT_CASES:
        got = main._fill_subject_placeholders(subject, PROFILE, POSITION)
        assert got == expected, (
            f"{subject!r} -> {got!r}, expected {expected!r}"
        )


def test_position_empty_left_alone():
    got = main._fill_subject_placeholders(
        "Lamaran [Posisi] IT",
        PROFILE,
        "",
    )
    assert got == "Lamaran [Posisi] IT"


def test_empty_subject_returns_empty():
    assert main._fill_subject_placeholders("", PROFILE, POSITION) == ""


def test_none_subject_returns_none():
    assert main._fill_subject_placeholders(None, PROFILE, POSITION) is None


def test_no_name_uses_kandidat_fallback():
    got = main._fill_subject_placeholders(
        "[Nama Lengkap]",
        {},
        POSITION,
    )
    assert got == "Kandidat"