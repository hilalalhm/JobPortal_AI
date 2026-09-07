from pathlib import Path
from typing import Optional

import fitz

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    File,
    Form,
    UploadFile,
)

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from services.ai_service import AIService
from services.application_storage import (
    create_application,
    delete_application,
    get_application,
    list_applications,
    update_application,
)
from services.email_service import send_email
from services.profile_storage import (
    get_profile,
    set_cv,
    update_profile,
)


# ============================================================
# SUBJECT HELPER
# ============================================================

def _fill_subject_placeholders(subject, profile, position=""):
    """
    Ganti placeholder nama & posisi pada subjek email sesuai
    ketentuan lowongan dengan berbagai format umum, misalnya:

    - "Lamar_Nama_IT Staff"       → "Lamar_Andi Prasetyo_IT Staff"
    - "Lamaran [Nama Lengkap]"    → "Lamaran Andi Prasetyo"
    - "Lamaran [Posisi]"          → "Lamaran IT Staff"
    - "Lamar_Posisi_Nama"         → "Lamar_IT Staff_Andi Prasetyo"
    - "SUBJEK: {NAMA} - {POSISI}" → "SUBJEK: Andi Prasetyo - IT Staff"
    - "Application ~ FULLNAME ~"  → "Application ~ Andi Prasetyo ~"

    Nama selalu dipertahankan dengan spasi (mis. "Andi Prasetyo"),
    meskipun placeholder berada di antara separator seperti
    "Lamar_Nama_IT" → "Lamar_Andi Prasetyo_IT".
    Jika `position` dikosongkan, placeholder posisi dibiarkan.
    """
    if not subject:
        return subject

    name = profile.get("name") or "Kandidat"

    import re

    result = subject

    # ------------------------------------------------------------
    # 1) Placeholder berbungkus jelas (memastikan itu placeholder):
    #    [Nama], [NAMA], [Nama Lengkap], [nama_lengkap], (Nama),
    #    <Nama>, {Nama}, %Nama%, $name. Case-insensitive.
    #    Bungkus dibuang.
    # ------------------------------------------------------------
    # _sep: pemisah yang boleh muncul DI DALAM frasa "nama X"
    # (spasi, underscore, tanda hubung, titik, slash).
    _sep = r"[\s_\-./~|]"

    # Frasa seperti "nama lengkap", "nama_lengkap", "nama-lengkap",
    # "namalengkap", juga "nama anda", "nama_kandidat", dsb.
    # Serta varian dengan "Anda" di belakang: "nama lengkap anda",
    # "nama anda", "nama lengkap kamu".
    _footer = (
        r"(?:"
        + _sep
        + r"+(?:anda|kamu))?"
    )
    _frase_name = (
        r"(?:nama"
        + _sep
        + r"+(?:lengkap|kandidat|anda|pelamar)"
        + _footer
        + r"|namalengkap|namakandidat|namaanda|namapelamar)"
    )

    # Kandidat teks yang boleh dianggap placeholder di dalam bungkus:
    # frasa di atas ATAU kata "nama" polos.
    _name_or_frase = r"(?:" + _frase_name + r"|nama)"

    bracket_forms = [
        r"\[\s*" + _name_or_frase + r"\s*\]",
        r"\(\s*" + _name_or_frase + r"\s*\)",
        r"<\s*" + _name_or_frase + r"\s*>",
        r"\{\s*" + _name_or_frase + r"\s*\}",
        r"%\s*" + _name_or_frase + r"\s*%",
        r"\$\s*nama\b",
        r"\$\s*NAME\b",
    ]
    for pattern in bracket_forms:
        result = re.sub(pattern, name, result, flags=re.IGNORECASE)

    # ------------------------------------------------------------
    # 2) Keyword nama penuh internasional (nama lengkap tersirat).
    # ------------------------------------------------------------
    result = re.sub(
        r"\bFULL\s*NAME\b", name, result, flags=re.IGNORECASE
    )
    result = re.sub(
        r"\bFULLNAME\b", name, result, flags=re.IGNORECASE
    )
    result = re.sub(
        r"\bFULL\s*_?\s*NAME\b", name, result, flags=re.IGNORECASE
    )

    # ------------------------------------------------------------
    # 3) Kata "Nama Lengkap"/"Nama Anda"/dst berdiri sendiri
    #    (bukan dalam bungkus). Ganti keseluruhan frasa.
    #    Termasuk varian dengan separator internal seperti
    #    "nama_lengkap", "nama-lengkap", "namalengkap" ketika
    #    berada di dalam token dengan separator.
    # ------------------------------------------------------------
    result = re.sub(
        r"\b(?:nama\s+(?:lengkap|kandidat|anda|pelamar)"
        r"(?:\s+(?:anda|kamu))?)\b",
        name,
        result,
        flags=re.IGNORECASE,
    )

    # 3b) Frasa dengan pemisah internal (nama_lengkap / nama-lengkap /
    #     namalengkap) yang berdiri sendiri atau di antara separator
    #     (contoh "Lamar_nama_lengkap_IT" → "Lamar_Andi Prasetyo_IT").
    #     CATATAN: hanya frasa ber-suffix yang diganti — kata "nama"
    #     polos TIDAK disentuh agar tidak merusak kalimat biasa.
    result = re.sub(
        r"(?i)(?<![A-Za-z0-9])" + _frase_name + r"(?![A-Za-z0-9])",
        name,
        result,
    )

    # ------------------------------------------------------------
    # 4) Token "Nama"/"NAMA"/"nama" di ANTARA separator tanpa spasi
    #    (contoh "_Nama_", "_NAMA_") → ganti dengan nama lengkap.
    #    Lookaround langsung mengecek separator TANPA menelan spasi
    #    di sekeliling, agar " - Nama" tetap " - Andi Prasetyo".
    # ------------------------------------------------------------
    result = re.sub(
        r"(?i)(?<=[_\-./~|])(?:nama|lengkap-?lengkap)(?=[_\-./~|])",
        name,
        result,
    )
    result = re.sub(
        r"(?i)(?<=^)(?:nama|lengkap-?lengkap)(?=[_\-./~|])",
        name,
        result,
    )
    result = re.sub(
        r"(?i)(?<=[_\-./~|])(?:nama|lengkap-?lengkap)(?=$)",
        name,
        result,
    )
    # " - Nama" di akhir (separator, spasi, Nama): hanya ganti kata
    # "Nama" (jangan menelan spasi) agar tetap " - Andi Prasetyo".
    result = re.sub(
        r"(?i)(?<=[_\-./~|] )(?:nama|lengkap-?lengkap)(?=$)",
        name,
        result,
    )
    result = re.sub(
        r"(?i)(?<=^ )(?:nama|lengkap-?lengkap)(?=$)",
        name,
        result,
    )

    # ------------------------------------------------------------
    # 5) Frasa "Nama Lengkap"/"Nama Anda"/dst yang berada DI ANTARA
    #    separator (contoh "Lamar_Nama Lengkap_IT") → nama lengkap
    #    dengan spasi.
    # ------------------------------------------------------------
    for phrase in [
        "nama lengkap",
        "nama kandidat",
        "nama anda",
        "nama pelamar",
    ]:
        result = re.sub(
            r"(?i)(?<=[_\-./~|])\s*"
            + phrase.replace(" ", r"\s+")
            + r"\s*(?=[_\-./~|])",
            name,
            result,
        )
        result = re.sub(
            r"(?i)(?<=^)\s*"
            + phrase.replace(" ", r"\s+")
            + r"\s*(?=[_\-./~|])",
            name,
            result,
        )
        result = re.sub(
            r"(?i)(?<=[_\-./~|])\s*"
            + phrase.replace(" ", r"\s+")
            + r"\s*(?=$)",
            name,
            result,
        )

    # ------------------------------------------------------------
    # 6) UPPERCASE "NAMA" yang berdiri sendiri (contoh "SUBJEK: NAMA")
    #    — kasus khusus huruf kapital penuh agar tidak menimpa kata
    #    "nama" dalam kalimat biasa.
    # ------------------------------------------------------------
    result = re.sub(
        r"\bNAMA\b", name, result
    )

    # ============================================================
    # 7) Placeholder POSISI (posisi yang dilamar). Berbagai format:
    #    "Posisi", "POSISI", "[Posisi]", "{POSISI}", "(Position)",
    #    "_Posisi_", "$POSISI", "posisi yang dilamar",
    #    "JOB TITLE", "JOBTITLE". Konservatif: hanya diganti jika
    #    jelas berupa placeholder (bungkus / separator / uppercase /
    #    $ / frasa). Jika tidak ada data position → dibiarkan apa
    #    adanya.
    # ============================================================
    if position:
        # varian kata yang menandakan "posisi"
        _pos = r"posisi|jabatan|position|job\s*title|jobtitle"

        # 7a) Berbungkus: [Posisi], (Posisi), <Posisi>, {POSISI}, %Posisi%
        bracket_pos = [
            r"\[\s*(?:" + _pos + r"|posisi\s+yang\s+dilamar|jabatan\s+yang\s+dilamar)\s*\]",
            r"\(\s*(?:" + _pos + r"|posisi\s+yang\s+dilamar|jabatan\s+yang\s+dilamar)\s*\)",
            r"<\s*(?:" + _pos + r"|posisi\s+yang\s+dilamar|jabatan\s+yang\s+dilamar)\s*>",
            r"\{\s*(?:" + _pos + r"|posisi\s+yang\s+dilamar|jabatan\s+yang\s+dilamar)\s*\}",
            r"%\s*(?:" + _pos + r"|posisi\s+yang\s+dilamar|jabatan\s+yang\s+dilamar)\s*%",
        ]
        for pattern in bracket_pos:
            result = re.sub(
                pattern, position, result, flags=re.IGNORECASE
            )

        # 7b) $Posisi / $POSISI / $position
        result = re.sub(
            r"\$\s*(?:" + _pos + r")\b",
            position, result, flags=re.IGNORECASE
        )

        # 7d) Frasa "posisi yang dilamar" / "jabatan yang dilamar"
        #     berdiri sendiri (bukan dalam bungkus).
        #     DiJalankan SEBELUM 7c agar "Posisi yang dilamar"
        #     tertangkap utuh dulu.
        result = re.sub(
            r"(?i)(?<![A-Za-z0-9])(?:posisi|jabatan)\s+yang\s+dilamar(?![A-Za-z0-9])",
            position, result,
        )

        # 7c) UPPERCASE / Title-Case berdiri sendiri: POSISI, POSITION,
        #     JABATAN, JOB TITLE, JOBTITLE, JOB_TITLE, Posisi, Position.
        result = re.sub(
            r"\b(POSISI|POSITION|JABATAN|JobTitle|Job\s+Title)\b",
            position, result,
        )
        result = re.sub(
            r"\b(Posisi|Position|Jabatan)\b",
            position, result,
        )
        result = re.sub(
            r"\b(JOB\s*TITLE|JOBTITLE|JOB_TITLE)\b",
            position, result,
        )

        # 7e) Token posisi di antara separator → posisi (dengan spasi).
        result = re.sub(
            r"(?i)(?<=[_\-./~|])\s*(?:" + _pos + r")\s*(?=[_\-./~|])",
            position, result,
        )
        result = re.sub(
            r"(?i)(?<=^)\s*(?:" + _pos + r")\s*(?=[_\-./~|])",
            position, result,
        )
        result = re.sub(
            r"(?i)(?<=[_\-./~|])\s*(?:" + _pos + r")\s*(?=$)",
            position, result,
        )

    # ============================================================
    # 8) Placeholder kosong yang umum di template: garis bawah,
    #    titik-titik, atau kurung kosong sebagai tempat nama.
    #    Contoh: "[____]", "[........]", "(......)", {___}.
    #    Hanya diganti bila di dalam bungkus (kurung) agar tidak
    #    menyentuh teks biasa. Murah & aman.
    # ============================================================
    _blank = r"[_\.\s]{3,}"
    for open_, close in [("[", "]"), ("(", ")"), ("{", "}"), ("<", ">")]:
        result = re.sub(
            re.escape(open_) + r"\s*" + _blank + r"\s*" + re.escape(close),
            name,
            result,
        )

    return result


# ============================================================
# PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

CV_DIR = BASE_DIR / "storage" / "cv"

CV_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

# ============================================================
# ENV
# ============================================================

load_dotenv(BASE_DIR / ".env")


# ============================================================
# CV TEXT HELPER
# ============================================================

def _extract_cv_text():
    file_path = CV_DIR / "CV.pdf"

    if not file_path.exists():
        raise FileNotFoundError(
            "CV belum diupload."
        )

    document = fitz.open(file_path)

    text = ""

    for page in document:
        text += page.get_text()

    document.close()

    return text


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="JobPilot AI",
    description="AI-powered job application assistant",
    version="0.1.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODELS
# ============================================================

class ApplicationCreate(BaseModel):
    job: dict
    status: Optional[str] = "saved"


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None


class SendEmailRequest(BaseModel):
    cover_letter: Optional[str] = None
    subject: Optional[str] = None
    to: Optional[str] = None


# ============================================================
# BASIC
# ============================================================

@app.get("/")
def root():
    return {
        "app": "JobPilot AI",
        "status": "running",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
    }


# ============================================================
# PROFILE
# ============================================================

@app.get("/api/profile")
def get_user_profile():
    return {
        "success": True,
        "data": get_profile(),
    }


@app.put("/api/profile")
def edit_profile(payload: ProfileUpdate):
    fields = {}

    for key in (
        "name",
        "email",
        "phone",
        "linkedin",
        "github",
    ):
        value = getattr(
            payload,
            key,
            None,
        )

        if value is not None:
            fields[key] = value

    profile = update_profile(fields)

    return {
        "success": True,
        "message": "Profil berhasil diperbarui.",
        "data": profile,
    }


# ============================================================
# CV UPLOAD
# ============================================================

@app.post("/api/profile/cv")
async def upload_cv(
    file: UploadFile = File(...),
):
    if file.content_type != "application/pdf":
        return {
            "success": False,
            "message": "CV must be a PDF file.",
        }

    file_path = CV_DIR / "CV.pdf"

    content = await file.read()

    file_path.write_bytes(content)

    set_cv(
        filename=file.filename,
        path=file_path,
    )

    return {
        "success": True,
        "filename": file.filename,
        "path": str(file_path),
    }


# ============================================================
# CV TEXT
# ============================================================

@app.get("/api/profile/cv/text")
def get_cv_text():
    try:
        text = _extract_cv_text()

        return {
            "success": True,
            "text": text,
        }

    except FileNotFoundError as error:
        return {
            "success": False,
            "message": str(error),
        }

    except Exception as error:
        return {
            "success": False,
            "message": str(error),
        }


# ============================================================
# JOB INPUT / AI ANALYSIS
# ============================================================

@app.post("/api/jobs/analyze-input")
async def analyze_job_input(
    text: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    try:
        job_text = text or ""

        image_bytes = None
        image_content_type = None

        # ========================================================
        # IMAGE
        # ========================================================

        if image:
            if (
                not image.content_type
                or not image.content_type.startswith(
                    "image/"
                )
            ):
                return {
                    "success": False,
                    "message": "File harus berupa gambar.",
                }

            image_bytes = await image.read()

            if len(image_bytes) > 10 * 1024 * 1024:
                return {
                    "success": False,
                    "message": (
                        "Ukuran gambar maksimal 10 MB."
                    ),
                }

            image_content_type = image.content_type

        # ========================================================
        # VALIDATION
        # ========================================================

        if not job_text.strip() and not image_bytes:
            return {
                "success": False,
                "message": (
                    "Masukkan job description "
                    "atau screenshot lowongan."
                ),
            }

        # ========================================================
        # AI
        # ========================================================

        ai = AIService()

        job_data = ai.analyze_job(
            job_text=job_text,
            image_bytes=image_bytes,
            image_content_type=image_content_type,
        )

        # ========================================================
        # SOURCE URL
        # ========================================================

        if url:
            job_data["source_url"] = url

        # ========================================================
        # RESPONSE
        # ========================================================

        return {
            "success": True,
            "message": "Job berhasil dianalisis.",
            "data": job_data,
        }

    except Exception as error:
        print(
            "AI ERROR:",
            error,
        )

        return {
            "success": False,
            "message": str(error),
        }


# ============================================================
# APPLICATIONS (JOB TRACKER)
# ============================================================

@app.get("/api/applications")
def get_applications():
    return {
        "success": True,
        "data": list_applications(),
    }


@app.post("/api/applications")
def add_application(payload: ApplicationCreate):
    application = create_application(
        job_data=payload.job,
        status=payload.status,
    )

    return {
        "success": True,
        "message": "Lamaran berhasil disimpan.",
        "data": application,
    }


@app.get("/api/applications/{app_id}")
def get_single_application(app_id: str):
    application = get_application(app_id)

    if not application:
        return {
            "success": False,
            "message": "Lamaran tidak ditemukan.",
        }

    return {
        "success": True,
        "data": application,
    }


@app.patch("/api/applications/{app_id}")
def edit_application(
    app_id: str,
    payload: ApplicationUpdate,
):
    updates = {}

    if payload.status is not None:
        updates["status"] = payload.status

    if payload.notes is not None:
        updates["notes"] = payload.notes

    application = update_application(
        app_id,
        updates,
    )

    if not application:
        return {
            "success": False,
            "message": "Lamaran tidak ditemukan.",
        }

    return {
        "success": True,
        "message": "Lamaran berhasil diperbarui.",
        "data": application,
    }


@app.delete("/api/applications/{app_id}")
def remove_application(app_id: str):
    deleted = delete_application(app_id)

    if not deleted:
        return {
            "success": False,
            "message": "Lamaran tidak ditemukan.",
        }

    return {
        "success": True,
        "message": "Lamaran berhasil dihapus.",
    }


# ============================================================
# COVER LETTER
# ============================================================

@app.post("/api/applications/{app_id}/cover-letter")
def generate_cover_letter(app_id: str):
    application = get_application(app_id)

    if not application:
        return {
            "success": False,
            "message": "Lamaran tidak ditemukan.",
        }

    try:
        cv_text = _extract_cv_text()

    except FileNotFoundError as error:
        cv_text = ""

    profile = get_profile()

    ai = AIService()

    try:
        cover_letter = ai.generate_cover_letter(
            profile=profile,
            cv_text=cv_text,
            job=application.get("job", {}),
        )

    except Exception as error:
        print("COVER LETTER ERROR:", error)

        return {
            "success": False,
            "message": str(error),
        }

    return {
        "success": True,
        "message": "Cover letter berhasil dibuat.",
        "data": {
            "cover_letter": cover_letter,
            "application_id": app_id,
        },
    }


# ============================================================
# SEND EMAIL
# ============================================================

@app.post("/api/applications/{app_id}/send-email")
def send_application_email(
    app_id: str,
    payload: SendEmailRequest,
):
    application = get_application(app_id)

    if not application:
        return {
            "success": False,
            "message": "Lamaran tidak ditemukan.",
        }

    job = application.get("job", {})

    profile = get_profile()

    name = profile.get("name") or "Kandidat"
    position = job.get("position") or "posisi"
    company = job.get("company") or "perusahaan"

    # ========================================================
    # TO
    # ========================================================

    to_email = (payload.to or "").strip() or (
        job.get("contact_email") or ""
    ).strip()

    if not to_email:
        return {
            "success": False,
            "message": (
                "Tidak ada email tujuan. "
                "Isi email kontak di hasil analisis "
                "atau kirim dengan parameter 'to'."
            ),
        }

    # ========================================================
    # COVER LETTER (body)
    # ========================================================

    if payload.cover_letter:
        cover_letter = payload.cover_letter

    else:
        try:
            cv_text = _extract_cv_text()

        except FileNotFoundError:
            cv_text = ""

        ai = AIService()

        try:
            cover_letter = ai.generate_cover_letter(
                profile=profile,
                cv_text=cv_text,
                job=job,
            )

        except Exception as error:
            print("COVER LETTER ERROR:", error)

            return {
                "success": False,
                "message": (
                    "Gagal membuat cover letter: "
                    f"{error}"
                ),
            }

    # ========================================================
    # SUBJECT
    # ========================================================

    subject = (
        payload.subject
        or job.get("subject")
        or f"Lamaran Kerja {position} - {name}"
    )

    subject = _fill_subject_placeholders(
        subject,
        profile,
        position=position,
    )

    # ========================================================
    # CV ATTACHMENT
    # ========================================================

    cv_path = CV_DIR / "CV.pdf"

    cv_bytes = None
    cv_name = None

    if cv_path.exists():
        cv_bytes = cv_path.read_bytes()
        cv_name = "CV.pdf"

    # ========================================================
    # SEND
    # ========================================================

    try:
        sent = send_email(
            to_email=to_email,
            subject=subject,
            body=cover_letter,
            attachment_bytes=cv_bytes,
            attachment_name=cv_name,
        )

    except Exception as error:
        print("SEND EMAIL ERROR:", error)

        return {
            "success": False,
            "message": str(error),
        }

    return {
        "success": True,
        "message": f"Email terkirim ke {to_email}.",
        "data": {
            "to": to_email,
            "subject": subject,
            "attachment": sent.get("attachment"),
        },
    }