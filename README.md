<div align="center">

# 🚀 JobPilot AI

**AI-powered job application assistant.**

_Analyze job postings — from text, URL, or screenshot — and let AI structure the data, draft your cover letter, and send the application email. Fast, organized, done._

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

</div>

---

## ✨ Features

### ✔️ Working

- 🤖 **AI Job Analysis** — paste a job description, a URL, and/or a screenshot (`Ctrl+V`, drag & drop, or file picker)
- 🔄 **Multi-provider AI with Fallback** — up to 10 providers configured via env; on failure, automatically switches to the next with a **5-minute cooldown**
- 📋 **Standardized Data Structure** — analysis returns structured JSON: `company`, `position`, `location`, `employment_type`, `salary`, `requirements[]`, `responsibilities[]`, `preferred_qualifications[]`, `contact_email`, `contact_phone`, `deadline`, `source_url`, `other_information[]`
- 📄 **CV Upload / Parse (PDF)** — store your CV and extract its text (PyMuPDF)
- 🖥️ **"New Application" UI** — input form + analysis result view + save-application button
- 🗂️ **Job Tracker** — save analyses to `storage/applications/` (one JSON per application), manage status (`saved`, `applied`, `interview`, `offered`, `rejected`), view details, and delete
- 👤 **User Profile** — manage name, email, phone, LinkedIn, GitHub (stored in `backend/storage/profile.json`) and upload your CV (PDF) + extract its text
- ✍️ **AI Cover Letter** — auto-generate application emails per application using profile + CV text + job analysis (from the Job Tracker page, with copy button)
- 📧 **Send Application Email** — send the cover letter (auto-generated if missing) + CV (PDF) attachment to the job's contact email via SMTP

### 🚧 Planned / Stub

- 📝 Notes per application (backend already supports the `notes` field)
- 📄 Resume builder
- 🗃️ Application document generation (cover letter, resume builder)

---

## 🧱 Tech Stack

| Layer     | Technology                                                                          |
|-----------|-------------------------------------------------------------------------------------|
| Backend   | Python 3.14, FastAPI 0.141, Uvicorn, OpenAI SDK 3.6, PyMuPDF, Pydantic              |
| Frontend  | React 19, Vite 8, Oxlint                                                            |
| Storage   | `storage/cv/` (CV), `storage/applications/` (application documents — forthcoming)   |

---

## 📁 Project Structure

```
JobPilot/
├── backend/
│   ├── .env                      # AI provider configuration (fill in API keys)
│   ├── .env.example              # Template — copy to .env and fill in values
│   ├── requirements.txt          # Python dependencies
│   ├── main.py                   # FastAPI app & API endpoints
│   ├── storage/cv/               # Backend CV folder (created automatically)
│   ├── services/
│   │   ├── ai_router.py          # AI provider routing + fallback + cooldown (+ cover letter)
│   │   ├── ai_service.py         # Thin wrapper over AIRouter
│   │   ├── application_storage.py# Application CRUD (one JSON per app)
│   │   ├── profile_storage.py    # Load/save profile (JSON) + CV metadata
│   │   └── __init__.py
│   └── venv/                     # Python virtual environment
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx              # React entry point
│       ├── App.jsx               # Page navigation (Apply / Tracker / Profile)
│       └── pages/
│           ├── Apply.jsx         # "New Application" page
│           ├── Tracker.jsx       # "Job Tracker" page
│           └── Profile.jsx       # "Profile" page
└── storage/
    ├── cv/CV.pdf                 # User CV
    └── applications/             # (empty — for application documents)
```

---

## 🚀 Getting Started

### 1️⃣ Backend

```bash
cd backend

# Create & activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux / macOS

# Install dependencies
pip install -r requirements.txt

# Copy config & fill in API keys (see Configuration section)
copy .env.example .env       # Windows
# cp .env.example .env       # Linux / macOS

# Start the server
uvicorn main:app --reload
```

Server runs at `http://127.0.0.1:8000` — interactive docs at `/docs`.

### 2️⃣ Frontend

```bash
cd frontend

npm install
npm run dev
```

The UI opens at `http://localhost:5173`.

> Backend CORS is already open for `http://localhost:5173` and `http://127.0.0.1:5173`.

---

## ⚙️ AI Provider Configuration (`backend/.env`)

Providers are read from environment variables matching the `AI_PROVIDER_{N}_*` pattern (`N = 1..10`):

```
AI_PROVIDER_1_NAME=OpenRouter
AI_PROVIDER_1_KEY=sk-xxxx
AI_PROVIDER_1_URL=https://openrouter.ai/api/v1
AI_PROVIDER_1_MODEL=openrouter/free

AI_PROVIDER_2_NAME=Gemini
AI_PROVIDER_2_KEY=xxxx
AI_PROVIDER_2_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_PROVIDER_2_MODEL=MODEL_GRATIS
```

Notes:

- All providers are called over the **OpenAI-compatible** protocol (`base_url` + `api_key` + `model`), so OpenRouter, Google Gemini, and other compatible services work out of the box.
- Providers are tried **in order**; each failure goes into a **5-minute cooldown**.
- `.env` is automatically loaded by the backend (via `python-dotenv`) — just fill in your keys to use the AI.
- `.env.example` ships with placeholders (`your_api_key_here`, `MODEL_GRATIS`) — replace them with real credentials before use. The AI features (job analysis & cover letter) **won't work** without valid keys.
- The same applies to the `PROVIDER_3` example, which is just a pattern for extension.

---

## 📧 SMTP Configuration (send application emails)

Add the following variables to `backend/.env` to enable email sending:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=emailpengirim@gmail.com
SMTP_PASS=app_password
SMTP_FROM=            # leave empty → uses SMTP_USER
SMTP_FROM_NAME=JobPilot AI
SMTP_TLS=true
```

Notes:

- **Gmail**: use an **App Password** (not your account password) — enable 2FA first, then create one at https://myaccount.google.com/apppasswords
- Other providers (Zoho, Hostinger, etc.): adjust `SMTP_HOST`/`SMTP_PORT`; for port 465 (SSL) set `SMTP_TLS=false`
- Test sending anytime from the Job Tracker page: `📧 Send Email` → cover letter body (auto-created if missing) + `CV.pdf` attachment

---

## 🔌 API Endpoints

| Method | Endpoint                             | Description                                                       |
|--------|--------------------------------------|-------------------------------------------------------------------|
| GET    | `/`                                  | Application status                                                |
| GET    | `/health`                            | Health check                                                      |
| GET    | `/api/profile`                       | Get user profile                                                  |
| PUT    | `/api/profile`                       | Update profile (`name`, `email`, `phone`, `linkedin`, `github`)   |
| POST   | `/api/profile/cv`                    | Upload CV (PDF required) → `backend/storage/cv/CV.pdf`            |
| GET    | `/api/profile/cv/text`               | Extract text from CV PDF                                          |
| POST   | `/api/jobs/analyze-input`            | Analyze job from `text` / `url` / `image` (max 10 MB)             |
| GET    | `/api/applications`                  | List all applications (newest first)                              |
| POST   | `/api/applications`                  | Save new application `{ "job": {...}, "status": "saved" }`        |
| GET    | `/api/applications/{id}`             | Get a single application                                          |
| PATCH  | `/api/applications/{id}`             | Update application `status` / `notes`                             |
| DELETE | `/api/applications/{id}`             | Delete an application                                             |
| POST   | `/api/applications/{id}/cover-letter`| Generate an AI cover letter for an application                    |
| POST   | `/api/applications/{id}/send-email`  | Send application email (+ CV PDF attachment)                      |

Valid statuses: `saved`, `applied`, `interview`, `offered`, `rejected`.

### 📥 Example `POST /api/jobs/analyze-input`

Form-data (multipart):

- `text` *(optional)* — job description text
- `url` *(optional)* — posting source link
- `image` *(optional)* — screenshot image file (`type image/*`, max 10 MB)

Successful response:

```json
{
  "success": true,
  "message": "Job berhasil dianalisis.",
  "data": {
    "company": "PT Contoh",
    "position": "Backend Developer",
    "location": "Remote",
    "employment_type": "Full-time",
    "salary": "Rp 8-12 juta",
    "requirements": ["..."],
    "responsibilities": ["..."],
    "preferred_qualifications": [],
    "contact_email": "hr@contoh.com",
    "contact_phone": "0812-xxx",
    "deadline": null,
    "source_url": "https://...",
    "other_information": [],
    "_ai_provider": "OpenRouter",
    "_ai_model": "openrouter/free"
  }
}
```

---

## 🗺️ Roadmap

- [x] 🗂️ **Job Tracker** — save & manage application statuses (`saved`, `applied`, `interview`, `offered`, `rejected`), CRUD via API + UI
- [x] 👤 **User Profile** — manage name, email, phone, LinkedIn, GitHub + CV upload (replaces the `GET /api/profile` stub)
- [x] ✍️ **AI Cover Letter** — generate application emails based on the job + CV
- [ ] 📝 **Notes per Application** — UI editing for application notes (backend already supports the `notes` field)
- [ ] 📄 **Resume Builder** — generate a structured CV from profile data + CV PDF
- [ ] 🗃️ **Application Document Generation** — output to `storage/applications/`
- [ ] 🎨 **Polish & complete the UI** (page routing, theming)

---

## 📝 Notes

- The UI currently shows three pages with Indonesian labels: "New Application", "Job Tracker", and "Profile".
- Application data is stored as one JSON file per application in `backend/storage/applications/` (folder created automatically).
- Profile data is stored in `backend/storage/profile.json` (created on first save).
- The backend stores/rebases the CV in `backend/storage/cv/`, while the CV shipped in this repo lives in `storage/cv/` (top level). Consolidate to a single source if profile & CV upload are used in production.
- Run `npm run lint` in `frontend/` (oxlint) before committing frontend changes.

---

<div align="center">

**Made with ❤️ + 🤖** — Happy job hunting!

</div>
