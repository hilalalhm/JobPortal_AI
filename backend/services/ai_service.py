from services.ai_router import AIRouter


class AIService:

    def __init__(self):
        self.router = AIRouter()

    def analyze_job(
        self,
        job_text="",
        image_bytes=None,
        image_content_type=None,
    ):
        return self.router.analyze_job(
            job_text=job_text,
            image_bytes=image_bytes,
            image_content_type=image_content_type,
        )

    def generate_cover_letter(
        self,
        profile=None,
        cv_text="",
        job=None,
    ):
        return self.router.generate_cover_letter(
            profile=profile,
            cv_text=cv_text,
            job=job,
        )
