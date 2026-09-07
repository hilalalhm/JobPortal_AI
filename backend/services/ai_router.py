import base64
import json
import os
import time

from openai import OpenAI


class AIRouter:
    """
    AI Router dengan automatic fallback.

    Provider dibaca dari environment variable:

    AI_PROVIDER_1_NAME
    AI_PROVIDER_1_KEY
    AI_PROVIDER_1_URL
    AI_PROVIDER_1_MODEL

    AI_PROVIDER_2_NAME
    AI_PROVIDER_2_KEY
    AI_PROVIDER_2_URL
    AI_PROVIDER_2_MODEL

    dst.
    """

    def __init__(self):
        self.providers = []
        self.cooldowns = {}

        self._load_providers()

        if not self.providers:
            raise RuntimeError(
                "Tidak ada AI provider yang dikonfigurasi."
            )

    # ============================================================
    # LOAD PROVIDERS
    # ============================================================

    def _load_providers(self):
        for index in range(1, 11):
            prefix = f"AI_PROVIDER_{index}_"

            name = os.getenv(
                f"{prefix}NAME"
            )

            api_key = os.getenv(
                f"{prefix}KEY"
            )

            base_url = os.getenv(
                f"{prefix}URL"
            )

            model = os.getenv(
                f"{prefix}MODEL"
            )

            if not api_key or not model:
                continue

            provider = {
                "index": index,
                "name": name or f"Provider {index}",
                "api_key": api_key,
                "base_url": base_url or None,
                "model": model,
            }

            self.providers.append(provider)

    # ============================================================
    # PROVIDER STATUS
    # ============================================================

    def _is_available(self, provider):
        name = provider["name"]

        cooldown_until = self.cooldowns.get(
            name,
            0,
        )

        return time.time() >= cooldown_until

    # ============================================================
    # COOLDOWN
    # ============================================================

    def _set_cooldown(
        self,
        provider,
        seconds=300,
    ):
        name = provider["name"]

        self.cooldowns[name] = (
            time.time() + seconds
        )

    # ============================================================
    # CLIENT
    # ============================================================

    def _create_client(self, provider):
        return OpenAI(
            api_key=provider["api_key"],
            base_url=provider["base_url"],
        )

    # ============================================================
    # CHAT (text only, shared worker + cooldown)
    # ============================================================

    def _chat(self, prompt, system=""):
        """
        Kirim prompt teks ke provider yang tersedia (dengan
        fallback + cooldown) dan kembalikan konten respons.
        """
        last_error = None

        for provider in self.providers:

            if not self._is_available(provider):
                continue

            try:
                print(
                    f"[AI ROUTER] Trying "
                    f"{provider['name']} "
                    f"({provider['model']})"
                )

                client = self._create_client(provider)

                messages = []

                if system:
                    messages.append(
                        {
                            "role": "system",
                            "content": system,
                        }
                    )

                messages.append(
                    {
                        "role": "user",
                        "content": prompt,
                    }
                )

                response = client.chat.completions.create(
                    model=provider["model"],
                    messages=messages,
                    temperature=0.5,
                )

                content = (
                    response
                    .choices[0]
                    .message
                    .content
                )

                if not content:
                    raise RuntimeError(
                        "AI tidak mengembalikan response."
                    )

                print(
                    f"[AI ROUTER] SUCCESS: "
                    f"{provider['name']}"
                )

                return content.strip()

            except Exception as error:

                last_error = error

                print(
                    f"[AI ROUTER] FAILED: "
                    f"{provider['name']}"
                )

                print(
                    f"[AI ROUTER] ERROR: {error}"
                )

                # Cooldown provider selama 5 menit
                self._set_cooldown(
                    provider,
                    seconds=300,
                )

                continue

        raise RuntimeError(
            "Semua AI provider gagal digunakan. "
            f"Error terakhir: {last_error}"
        )

    # ============================================================
    # GENERATE COVER LETTER
    # ============================================================

    def generate_cover_letter(
        self,
        profile=None,
        cv_text="",
        job=None,
    ):
        profile = profile or {}
        job = job or {}

        name = profile.get("name") or "Kandidat"
        email = profile.get("email") or ""
        phone = profile.get("phone") or ""
        linkedin = profile.get("linkedin") or ""
        github = profile.get("github") or ""

        job_company = job.get("company") or "-"
        job_position = job.get("position") or "posisi"
        job_location = job.get("location") or "-"
        job_employment_type = (
            job.get("employment_type") or "-"
        )
        job_salary = job.get("salary") or "-"
        job_requirements = job.get("requirements") or []
        job_responsibilities = (
            job.get("responsibilities") or []
        )
        job_contact_email = (
            job.get("contact_email") or ""
        )

        requirements_text = "\n".join(
            f"- {item}"
            for item in job_requirements
        ) or "-"

        responsibilities_text = "\n".join(
            f"- {item}"
            for item in job_responsibilities
        ) or "-"

        system = (
            "You are an expert career advisor and "
            "professional job-application writer. "
            "You write tailored, persuasive cover "
            "letters in Indonesian."
        )

        prompt = f"""
Tulis sebuah cover letter (surat lamaran kerja) profesional
dalam bahasa Indonesia, disesuaikan dengan data di bawah.

Gunakan format email lamaran (asalkan ramah dan profesional):

Kepada Yth. Tim Rekrutmen {job_company}


[paragraf pembuka: posisi yang dilamar + kesan singkat tentang perusahaan]

[paragraf inti: hubungkan pengalaman/keahlian kandidat
dengan tanggung jawab & syarat dari lowongan]

[paragraf penutup: antusiasme, keinginan wawancara,
tanda tangan nama]


Berikut datanya:

DATA KANDIDAT:
Nama: {name}
Email: {email}
Telepon: {phone or "-"}
LinkedIn: {linkedin or "-"}
GitHub: {github or "-"}

RINGKASAN CV (dipakai untuk memperkuat klaim keahlian):
{cv_text.strip() if cv_text.strip() else "(tidak ada teks CV)"}

LOWONGAN YANG DILAMAR:
Perusahaan: {job_company}
Posisi: {job_position}
Lokasi: {job_location}
Tipe Pekerjaan: {job_employment_type}
Gaji: {job_salary}

Tanggung jawab utama:
{responsibilities_text}

Syarat / kualifikasi:
{requirements_text}

EMAIL KONTAK LAMARAN (jika ada): {job_contact_email}

Aturan:
- JANGAN mengarang pengalaman yang tidak ada di CV.
- Jika teks CV kosong, tulis berdasarkan lowongan
  secara umum dan tawarkan melampirkan CV.
- Gunakan bahasa Indonesia yang formal tapi hangat.
- Jangan pakai markup. Hanya teks surat biasa.
- Jangan sebutkan "{{" atau "}}" atau tag placeholder.
"""

        return self._chat(
            prompt=prompt,
            system=system,
        )

    # ============================================================
    # ANALYZE JOB
    # ============================================================

    def analyze_job(
        self,
        job_text="",
        image_bytes=None,
        image_content_type=None,
    ):
        prompt = f"""
You are an expert recruitment assistant.

Analyze the job vacancy information below.

The vacancy may contain:
- Job description text
- Screenshot/image
- Both text and image

Extract the information into valid JSON.

JOB VACANCY TEXT:

{job_text if job_text.strip() else "(No text provided)"}

Return ONLY valid JSON:

{{
    "company": null,
    "position": null,
    "subject": null,
    "location": null,
    "employment_type": null,
    "salary": null,
    "requirements": [],
    "responsibilities": [],
    "preferred_qualifications": [],
    "contact_email": null,
    "contact_phone": null,
    "deadline": null,
    "source_url": null,
    "other_information": []
}}

Rules:

- Read the image carefully if provided.
- Combine text and image information.
- Do not invent information.
- Use null when information is unavailable.
- If the vacancy specifies a preferred email subject line,
  extract it into "subject". Common patterns:
  "Subject: DevOps Engineer - Andi Prasetyo",
  "Gunakan subjek: Backend Developer",
  "Email subject should be: QA Engineer Application".
  If none is specified, set "subject" to null.
- Keep requirements as an array.
- Keep responsibilities as an array.
- Keep preferred_qualifications as an array.
- Keep other_information as an array.
- Preserve email addresses.
- Preserve phone numbers.
- Preserve salary information.
- Preserve application deadlines.
- Return JSON only.
"""

        last_error = None

        # ========================================================
        # TRY PROVIDERS
        # ========================================================

        for provider in self.providers:

            if not self._is_available(provider):
                continue

            try:
                print(
                    f"[AI ROUTER] Trying "
                    f"{provider['name']} "
                    f"({provider['model']})"
                )

                client = self._create_client(
                    provider
                )

                # =================================================
                # TEXT ONLY
                # =================================================

                if not image_bytes:

                    response = client.chat.completions.create(
                        model=provider["model"],
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You extract structured "
                                    "information from job "
                                    "vacancies."
                                ),
                            },
                            {
                                "role": "user",
                                "content": prompt,
                            },
                        ],
                        temperature=0.2,
                    )

                # =================================================
                # TEXT + IMAGE
                # =================================================

                else:

                    encoded_image = (
                        base64.b64encode(
                            image_bytes
                        ).decode("utf-8")
                    )

                    image_type = (
                        image_content_type
                        or "image/jpeg"
                    )

                    response = client.chat.completions.create(
                        model=provider["model"],
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You extract structured "
                                    "information from job "
                                    "vacancies and screenshots."
                                ),
                            },
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": prompt,
                                    },
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": (
                                                f"data:{image_type};"
                                                f"base64,"
                                                f"{encoded_image}"
                                            )
                                        },
                                    },
                                ],
                            },
                        ],
                        temperature=0.2,
                    )

                # =================================================
                # READ RESPONSE
                # =================================================

                content = (
                    response
                    .choices[0]
                    .message
                    .content
                )

                if not content:
                    raise RuntimeError(
                        "AI tidak mengembalikan response."
                    )

                content = content.strip()

                # Remove markdown JSON fences
                if content.startswith("```"):
                    content = content.replace(
                        "```json",
                        "",
                        1,
                    )

                    content = content.replace(
                        "```",
                        "",
                    ).strip()

                try:
                    result = json.loads(
                        content
                    )

                except json.JSONDecodeError as error:
                    raise RuntimeError(
                        "AI mengembalikan JSON "
                        f"tidak valid: {error}"
                    )

                print(
                    f"[AI ROUTER] SUCCESS: "
                    f"{provider['name']}"
                )

                result["_ai_provider"] = (
                    provider["name"]
                )

                result["_ai_model"] = (
                    provider["model"]
                )

                return result

            except Exception as error:

                last_error = error

                print(
                    f"[AI ROUTER] FAILED: "
                    f"{provider['name']}"
                )

                print(
                    f"[AI ROUTER] ERROR: {error}"
                )

                # Cooldown provider selama 5 menit
                self._set_cooldown(
                    provider,
                    seconds=300,
                )

                continue

        # ========================================================
        # ALL FAILED
        # ========================================================

        raise RuntimeError(
            "Semua AI provider gagal digunakan. "
            f"Error terakhir: {last_error}"
        )