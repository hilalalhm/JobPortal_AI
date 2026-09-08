import { useEffect, useRef, useState } from "react"

const API_URL = "http://127.0.0.1:8000"

function Profile() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
  })
  const [cv, setCv] = useState(null)
  const [cvText, setCvText] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")

  const cvInputRef = useRef(null)

  // ============================================================
  // LOAD PROFILE
  // ============================================================

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/profile`
        )

        const result = await response.json()

        if (!result.success) {
          setMessage(
            result.message ||
            "Gagal memuat profil."
          )

          return
        }

        if (cancelled) {
          return
        }

        const { cv, ...fields } = result.data

        setForm({
          name: fields.name || "",
          email: fields.email || "",
          phone: fields.phone || "",
          linkedin: fields.linkedin || "",
          github: fields.github || "",
        })

        setCv(cv || null)
      } catch (error) {
        console.error("Load profile error:", error)

        if (!cancelled) {
          setMessage(
            "Gagal terhubung ke server. Pastikan backend sedang berjalan."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  // ============================================================
  // INPUT HANDLER
  // ============================================================

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  // ============================================================
  // SAVE PROFILE
  // ============================================================

  const handleSave = async (event) => {
    event.preventDefault()

    setSaving(true)
    setMessage("")

    try {
      const response = await fetch(
        `${API_URL}/api/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      )

      const result = await response.json()

      if (!result.success) {
        setMessage(
          result.message ||
          "Gagal menyimpan profil."
        )

        return
      }

      setMessage(
        "✓ Profil berhasil disimpan."
      )
    } catch (error) {
      console.error("Save profile error:", error)

      setMessage(
        "Gagal terhubung ke server. Pastikan backend sedang berjalan."
      )
    } finally {
      setSaving(false)
    }
  }

  // ============================================================
  // UPLOAD CV
  // ============================================================

  const handleCvChange = async (event) => {
    const file = event.target.files?.[0]

    event.target.value = ""

    if (!file) {
      return
    }

    if (file.type !== "application/pdf") {
      setMessage(
        "CV harus berupa file PDF."
      )

      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage(
        "Ukuran CV maksimal 10 MB."
      )

      return
    }

    setUploading(true)
    setMessage("Mengunggah CV...")

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(
        `${API_URL}/api/profile/cv`,
        {
          method: "POST",
          body: formData,
        }
      )

      const result = await response.json()

      if (!result.success) {
        setMessage(
          result.message ||
          "Gagal mengunggah CV."
        )

        return
      }

      setCv({
        filename: file.name,
        path: result.path,
        uploaded_at: new Date().toISOString(),
      })

      setMessage(
        "✓ CV berhasil diunggah."
      )
    } catch (error) {
      console.error("Upload CV error:", error)

      setMessage(
        "Gagal terhubung ke server."
      )
    } finally {
      setUploading(false)
    }
  }

  // ============================================================
  // EXTRACT CV TEXT
  // ============================================================

  const handleExtractCvText = async () => {
    setMessage("Mengekstrak teks CV...")

    try {
      const response = await fetch(
        `${API_URL}/api/profile/cv/text`
      )

      const result = await response.json()

      if (!result.success) {
        setMessage(
          result.message ||
          "Gagal mengekstrak teks CV."
        )

        return
      }

      setCvText(result.text || "(Tidak ada teks ditemukan)")

      setMessage(
        "✓ Teks CV berhasil diekstrak."
      )
    } catch (error) {
      console.error("Extract CV error:", error)

      setMessage(
        "Gagal terhubung ke server."
      )
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.emptyState}>
            Memuat profil...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <div style={styles.header}>
          <h1 style={styles.title}>Profil</h1>

          <p style={styles.subtitle}>
            Kelola data personal dan CV-mu.
          </p>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        {/* ==================================================== */}
        {/* CV SECTION */}
        {/* ==================================================== */}

        <div style={styles.card}>

          <h2 style={styles.sectionTitle}>
            📄 Curriculum Vitae
          </h2>

          <p style={styles.description}>
            Unggah CV berformat PDF. Teksnya bisa
            diekstrak untuk dipakai di resume builder
            dan AI cover letter.
          </p>

          {!cv ? (
            <button
              type="button"
              onClick={() =>
                cvInputRef.current?.click()
              }
              disabled={uploading}
              style={{
                ...styles.uploadButton,
                ...(uploading
                  ? styles.disabled
                  : {}),
              }}
            >
              {uploading
                ? "Mengunggah..."
                : "⬆️ Upload CV (PDF)"}
            </button>
          ) : (
            <div style={styles.cvBox}>

              <div style={styles.cvInfo}>
                <span style={styles.cvIcon}>📄</span>

                <div>
                  <strong style={styles.cvName}>
                    {cv.filename}
                  </strong>

                  <div style={styles.cvMeta}>
                    Diunggah {formatDate(cv.uploaded_at)}
                  </div>
                </div>
              </div>

              <div style={styles.cvActions}>
                <button
                  type="button"
                  onClick={() =>
                    cvInputRef.current?.click()
                  }
                  style={styles.smallButton}
                >
                  Ganti
                </button>

                <button
                  type="button"
                  onClick={handleExtractCvText}
                  style={styles.smallButton}
                >
                  Ekstrak Teks
                </button>
              </div>

            </div>
          )}

          <input
            ref={cvInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleCvChange}
            style={styles.hiddenInput}
          />

        </div>

        {/* ==================================================== */}
        {/* PROFILE FORM */}
        {/* ==================================================== */}

        <form onSubmit={handleSave}>

          <div style={styles.card}>

            <h2 style={styles.sectionTitle}>
              👤 Data Personal
            </h2>

            <div style={styles.field}>
              <label style={styles.label}>
                Nama Lengkap
              </label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Nama lengkap"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Email
              </label>

              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="email@example.com"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Telepon
              </label>

              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="08xx-xxxx-xxxx"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                LinkedIn
              </label>

              <input
                name="linkedin"
                value={form.linkedin}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/..."
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                GitHub
              </label>

              <input
                name="github"
                value={form.github}
                onChange={handleChange}
                placeholder="https://github.com/..."
                style={styles.input}
              />
            </div>

          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              ...styles.saveButton,
              ...(saving ? styles.disabled : {}),
            }}
          >
            {saving
              ? "Menyimpan..."
              : "💾 Simpan Profil"}
          </button>

        </form>

        {/* ==================================================== */}
        {/* CV TEXT */}
        {/* ==================================================== */}

        {cvText && (
          <div style={styles.card}>

            <h2 style={styles.sectionTitle}>
              📝 Teks CV
            </h2>

            <pre style={styles.cvText}>
              {cvText}
            </pre>

          </div>
        )}

      </div>
    </div>
  )
}


// ============================================================
// HELPERS
// ============================================================

function formatDate(value) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}


// ============================================================
// STYLES
// ============================================================

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "40px 20px",
    fontFamily: "Inter, Arial, sans-serif",
    boxSizing: "border-box",
  },

  container: {
    maxWidth: "680px",
    margin: "0 auto",
  },

  header: {
    marginBottom: "30px",
  },

  title: {
    margin: 0,
    fontSize: "32px",
    color: "#111827",
  },

  subtitle: {
    color: "#6b7280",
    marginTop: "8px",
    fontSize: "15px",
  },

  message: {
    marginBottom: "15px",
    padding: "12px 14px",
    borderRadius: "8px",
    background: "#f3f4f6",
    color: "#374151",
    fontSize: "14px",
  },

  emptyState: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "60px 20px",
    textAlign: "center",
    color: "#6b7280",
  },

  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "26px",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
    marginBottom: "18px",
  },

  sectionTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
    color: "#111827",
  },

  description: {
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: "1.6",
    marginTop: 0,
    marginBottom: "18px",
  },

  uploadButton: {
    width: "100%",
    padding: "14px",
    border: "2px dashed #d1d5db",
    borderRadius: "10px",
    background: "#fafafa",
    color: "#111827",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
  },

  disabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  cvBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    flexWrap: "wrap",
    padding: "16px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    background: "#fafafa",
  },

  cvInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },

  cvIcon: {
    fontSize: "28px",
  },

  cvName: {
    display: "block",
    color: "#111827",
    fontSize: "14px",
    wordBreak: "break-word",
  },

  cvMeta: {
    fontSize: "12px",
    color: "#9ca3af",
    marginTop: "3px",
  },

  cvActions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },

  smallButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },

  hiddenInput: {
    display: "none",
  },

  field: {
    marginBottom: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#111827",
  },

  input: {
    width: "100%",
    padding: "11px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    boxSizing: "border-box",
    fontSize: "14px",
    outline: "none",
  },

  saveButton: {
    width: "100%",
    padding: "14px",
    border: "none",
    borderRadius: "8px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    marginBottom: "30px",
  },

  cvText: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "#fafafa",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "16px",
    fontSize: "13px",
    lineHeight: "1.7",
    color: "#374151",
    fontFamily: "Inter, Arial, sans-serif",
    maxHeight: "300px",
    overflowY: "auto",
    margin: 0,
  },
}

export default Profile