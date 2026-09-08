import { useEffect, useRef, useState } from "react"

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

function Apply() {
  const [text, setText] = useState("")
  const [url, setUrl] = useState("")
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [jobData, setJobData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAppId, setSavedAppId] = useState(null)

  const fileInputRef = useRef(null)

  // ============================================================
  // IMAGE HANDLER
  // ============================================================

  const setImageFile = (file) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setMessage("File harus berupa gambar.")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("Ukuran gambar maksimal 10 MB.")
      return
    }

    if (preview) {
      URL.revokeObjectURL(preview)
    }

    const previewUrl = URL.createObjectURL(file)

    setImage(file)
    setPreview(previewUrl)
    setJobData(null)
    setMessage("✓ Screenshot berhasil ditambahkan.")
  }

  // ============================================================
  // FILE INPUT
  // ============================================================

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]

    if (file) {
      setImageFile(file)
    }

    event.target.value = ""
  }

  // ============================================================
  // PASTE IMAGE
  // ============================================================

  const handlePaste = (event) => {
    const items = event.clipboardData?.items

    if (!items) {
      return
    }

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        event.preventDefault()

        const file = item.getAsFile()

        if (file) {
          setImageFile(file)
        }

        return
      }
    }
  }

  // ============================================================
  // DRAG & DROP
  // ============================================================

  const handleDragOver = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()

    const file = event.dataTransfer.files?.[0]

    if (file) {
      setImageFile(file)
    }
  }

  // ============================================================
  // REMOVE IMAGE
  // ============================================================

  const removeImage = () => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }

    setImage(null)
    setPreview(null)
    setJobData(null)
    setMessage("")
  }

  // ============================================================
  // CLEANUP PREVIEW
  // ============================================================

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  // ============================================================
  // ANALYZE JOB
  // ============================================================

  const handleAnalyze = async () => {
    if (!text.trim() && !url.trim() && !image) {
      setMessage(
        "Masukkan screenshot, deskripsi, atau link lowongan."
      )

      return
    }

    setLoading(true)
    setJobData(null)
    setSavedAppId(null)
    setMessage("Mengirim data lowongan...")

    try {
      const formData = new FormData()

      if (text.trim()) {
        formData.append("text", text.trim())
      }

      if (url.trim()) {
        formData.append("url", url.trim())
      }

      if (image) {
        formData.append("image", image, image.name)
      }

      const response = await fetch(
        `${API_URL}/api/jobs/analyze-input`,
        {
          method: "POST",
          body: formData,
        }
      )

      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status}`
        )
      }

      const result = await response.json()

      console.log("Job analysis:", result)

      if (!result.success) {
        setMessage(
          result.message ||
          "Gagal memproses lowongan."
        )

        return
      }

      setJobData(result.data)

      setMessage(
        "✓ Lowongan berhasil dianalisis."
      )
    } catch (error) {
      console.error("Analyze error:", error)

      setMessage(
        "Gagal terhubung ke server. Pastikan backend sedang berjalan."
      )
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // SAVE TO TRACKER
  // ============================================================

  const handleSaveToTracker = async () => {
    if (!jobData) {
      return
    }

    setSaving(true)

    try {
      const response = await fetch(
        `${API_URL}/api/applications`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job: jobData,
            status: "saved",
          }),
        }
      )

      const result = await response.json()

      if (!result.success) {
        setMessage(
          result.message ||
          "Gagal menyimpan lamaran."
        )

        return
      }

      setSavedAppId(result.data.id)

      setMessage(
        "✓ Lamaran disimpan ke Job Tracker."
      )
    } catch (error) {
      console.error("Save error:", error)

      setMessage(
        "Gagal terhubung ke server. Pastikan backend sedang berjalan."
      )
    } finally {
      setSaving(false)
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* ====================================================== */}
        {/* HEADER */}
        {/* ====================================================== */}

        <div style={styles.header}>

          <h1 style={styles.title}>
            New Application
          </h1>

          <p style={styles.subtitle}>
            Masukkan informasi lowongan yang ingin kamu lamar.
          </p>

        </div>


        {/* ====================================================== */}
        {/* MAIN CARD */}
        {/* ====================================================== */}

        <div style={styles.card}>

          {/* ==================================================== */}
          {/* SCREENSHOT */}
          {/* ==================================================== */}

          <div style={styles.section}>

            <h2 style={styles.sectionTitle}>
              📷 Screenshot
            </h2>

            <p style={styles.description}>
              Paste screenshot dengan{" "}
              <strong>Ctrl + V</strong>, drag & drop,
              atau pilih file gambar.
            </p>

            {!image ? (

              <div
                style={styles.dropZone}
                onPaste={handlePaste}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() =>
                  fileInputRef.current?.click()
                }
                tabIndex={0}
              >

                <div style={styles.dropIcon}>
                  📷
                </div>

                <strong style={styles.dropTitle}>
                  Paste screenshot here
                </strong>

                <span style={styles.dropHint}>
                  Ctrl + V
                </span>

                <span style={styles.dropSubtext}>
                  atau drag & drop / klik untuk memilih
                </span>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={styles.hiddenInput}
                />

              </div>

            ) : (

              <div style={styles.previewContainer}>

                <img
                  src={preview}
                  alt="Job vacancy screenshot"
                  style={styles.previewImage}
                />

                <div style={styles.previewFooter}>

                  <div style={styles.fileInfo}>

                    <div style={styles.fileName}>
                      ✓ {image.name}
                    </div>

                    <div style={styles.fileSize}>
                      {(image.size / 1024 / 1024).toFixed(2)} MB
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={removeImage}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>

                </div>

              </div>

            )}

          </div>


          {/* ==================================================== */}
          {/* JOB DESCRIPTION */}
          {/* ==================================================== */}

          <div style={styles.section}>

            <h2 style={styles.sectionTitle}>
              📝 Job Description
            </h2>

            <p style={styles.description}>
              Copy dan paste deskripsi lowongan di sini.
            </p>

            <textarea
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
              placeholder="Paste job description di sini..."
              rows={10}
              style={styles.textarea}
            />

            {text && (
              <div style={styles.characterCount}>
                {text.length} characters
              </div>
            )}

          </div>


          {/* ==================================================== */}
          {/* JOB URL */}
          {/* ==================================================== */}

          <div style={styles.section}>

            <h2 style={styles.sectionTitle}>
              🔗 Job URL
            </h2>

            <p style={styles.description}>
              Masukkan link lowongan, website perusahaan,
              atau link Instagram.
            </p>

            <input
              type="url"
              value={url}
              onChange={(event) =>
                setUrl(event.target.value)
              }
              placeholder="https://www.instagram.com/..."
              style={styles.input}
            />

          </div>


          {/* ==================================================== */}
          {/* ANALYZE BUTTON */}
          {/* ==================================================== */}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading
                ? styles.buttonDisabled
                : {}),
            }}
          >
            {loading
              ? "Analyzing..."
              : "Analyze Job"}
          </button>


          {/* ==================================================== */}
          {/* MESSAGE */}
          {/* ==================================================== */}

          {message && (
            <div style={styles.message}>
              {message}
            </div>
          )}


          {/* ==================================================== */}
          {/* JOB ANALYSIS RESULT */}
          {/* ==================================================== */}

          {jobData && (
            <div style={styles.resultCard}>

              <div style={styles.resultHeader}>

                <div>
                  <span style={styles.resultBadge}>
                    AI ANALYSIS
                  </span>

                  <h2 style={styles.resultTitle}>
                    {jobData.position ||
                      "Position not specified"}
                  </h2>

                  <p style={styles.companyName}>
                    {jobData.company ||
                      "Company not specified"}
                  </p>
                </div>

              </div>


              {/* SAVE TO TRACKER */}

              <button
                type="button"
                onClick={handleSaveToTracker}
                disabled={saving || savedAppId}
                style={{
                  ...styles.saveButton,
                  ...(saving || savedAppId
                    ? styles.saveButtonDisabled
                    : {}),
                }}
              >
                {savedAppId
                  ? "✓ Saved to Tracker"
                  : saving
                    ? "Menyimpan..."
                    : "💾 Save to Tracker"}
              </button>


              {/* BASIC INFORMATION */}

              <div style={styles.infoGrid}>

                <div style={styles.infoItem}>
                  <span style={styles.label}>
                    Location
                  </span>

                  <strong>
                    {jobData.location ||
                      "Not specified"}
                  </strong>
                </div>


                <div style={styles.infoItem}>
                  <span style={styles.label}>
                    Employment Type
                  </span>

                  <strong>
                    {jobData.employment_type ||
                      "Not specified"}
                  </strong>
                </div>


                <div style={styles.infoItem}>
                  <span style={styles.label}>
                    Salary
                  </span>

                  <strong>
                    {jobData.salary ||
                      "Not specified"}
                  </strong>
                </div>


                <div style={styles.infoItem}>
                  <span style={styles.label}>
                    Deadline
                  </span>

                  <strong>
                    {jobData.deadline ||
                      "Not specified"}
                  </strong>
                </div>

              </div>


              {/* REQUIREMENTS */}

              {jobData.requirements?.length > 0 && (
                <div style={styles.resultSection}>

                  <h3 style={styles.resultSectionTitle}>
                    Requirements
                  </h3>

                  <ul style={styles.list}>

                    {jobData.requirements.map(
                      (item, index) => (
                        <li
                          key={index}
                          style={styles.listItem}
                        >
                          {item}
                        </li>
                      )
                    )}

                  </ul>

                </div>
              )}


              {/* RESPONSIBILITIES */}

              {jobData.responsibilities?.length > 0 && (
                <div style={styles.resultSection}>

                  <h3 style={styles.resultSectionTitle}>
                    Responsibilities
                  </h3>

                  <ul style={styles.list}>

                    {jobData.responsibilities.map(
                      (item, index) => (
                        <li
                          key={index}
                          style={styles.listItem}
                        >
                          {item}
                        </li>
                      )
                    )}

                  </ul>

                </div>
              )}


              {/* PREFERRED QUALIFICATIONS */}

              {jobData.preferred_qualifications?.length > 0 && (
                <div style={styles.resultSection}>

                  <h3 style={styles.resultSectionTitle}>
                    Preferred Qualifications
                  </h3>

                  <ul style={styles.list}>

                    {jobData.preferred_qualifications.map(
                      (item, index) => (
                        <li
                          key={index}
                          style={styles.listItem}
                        >
                          {item}
                        </li>
                      )
                    )}

                  </ul>

                </div>
              )}


              {/* CONTACT */}

              {jobData.contact_email && (
                <div style={styles.contactBox}>

                  <span style={styles.label}>
                    Application Email
                  </span>

                  <strong>
                    {jobData.contact_email}
                  </strong>

                </div>
              )}


              {jobData.contact_phone && (
                <div style={styles.contactBox}>

                  <span style={styles.label}>
                    Contact Phone
                  </span>

                  <strong>
                    {jobData.contact_phone}
                  </strong>

                </div>
              )}


              {/* OTHER INFORMATION */}

              {jobData.other_information?.length > 0 && (
                <div style={styles.resultSection}>

                  <h3 style={styles.resultSectionTitle}>
                    Other Information
                  </h3>

                  <ul style={styles.list}>

                    {jobData.other_information.map(
                      (item, index) => (
                        <li
                          key={index}
                          style={styles.listItem}
                        >
                          {item}
                        </li>
                      )
                    )}

                  </ul>

                </div>
              )}


              {/* SOURCE */}

              {jobData.source_url && (
                <div style={styles.sourceBox}>

                  <span style={styles.label}>
                    Source
                  </span>

                  <a
                    href={jobData.source_url}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.sourceLink}
                  >
                    {jobData.source_url}
                  </a>

                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  )
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
    maxWidth: "800px",
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

  card: {
    background: "#ffffff",
    padding: "30px",
    borderRadius: "16px",
    boxShadow:
      "0 4px 20px rgba(0, 0, 0, 0.08)",
  },

  section: {
    marginBottom: "32px",
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
  },

  dropZone: {
    minHeight: "220px",
    border: "2px dashed #d1d5db",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    cursor: "pointer",
    background: "#fafafa",
    outline: "none",
    textAlign: "center",
    padding: "20px",
    boxSizing: "border-box",
  },

  dropIcon: {
    fontSize: "42px",
  },

  dropTitle: {
    fontSize: "15px",
    color: "#111827",
  },

  dropHint: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#111827",
  },

  dropSubtext: {
    fontSize: "13px",
    color: "#9ca3af",
  },

  hiddenInput: {
    display: "none",
  },

  previewContainer: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    overflow: "hidden",
    background: "#fafafa",
  },

  previewImage: {
    display: "block",
    width: "100%",
    maxHeight: "500px",
    objectFit: "contain",
    background: "#f3f4f6",
  },

  previewFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    gap: "15px",
  },

  fileInfo: {
    minWidth: 0,
  },

  fileName: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#16a34a",
    wordBreak: "break-word",
  },

  fileSize: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#9ca3af",
  },

  removeButton: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#dc2626",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    flexShrink: 0,
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    boxSizing: "border-box",
    fontSize: "14px",
    outline: "none",
  },

  textarea: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "14px",
    lineHeight: "1.6",
    outline: "none",
  },

  characterCount: {
    marginTop: "6px",
    textAlign: "right",
    fontSize: "12px",
    color: "#9ca3af",
  },

  button: {
    width: "100%",
    padding: "14px",
    border: "none",
    borderRadius: "8px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  },

  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  message: {
    marginTop: "15px",
    padding: "12px 14px",
    borderRadius: "8px",
    background: "#f3f4f6",
    color: "#374151",
    fontSize: "14px",
  },

  // ============================================================
  // RESULT
  // ============================================================

  resultCard: {
    marginTop: "30px",
    padding: "25px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "#ffffff",
  },

  resultHeader: {
    marginBottom: "25px",
  },

  resultBadge: {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "6px",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.5px",
  },

  resultTitle: {
    margin: "10px 0 4px",
    fontSize: "24px",
    color: "#111827",
  },

  companyName: {
    margin: 0,
    color: "#6b7280",
    fontSize: "15px",
  },

  saveButton: {
    width: "100%",
    padding: "12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginBottom: "22px",
  },

  saveButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    color: "#16a34a",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
    paddingBottom: "20px",
    borderBottom: "1px solid #e5e7eb",
  },

  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  label: {
    display: "block",
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "5px",
  },

  resultSection: {
    marginTop: "24px",
  },

  resultSectionTitle: {
    margin: "0 0 10px",
    fontSize: "16px",
    color: "#111827",
  },

  list: {
    margin: 0,
    paddingLeft: "20px",
    color: "#374151",
  },

  listItem: {
    marginBottom: "7px",
    lineHeight: "1.5",
    fontSize: "14px",
  },

  contactBox: {
    marginTop: "20px",
    padding: "15px",
    borderRadius: "9px",
    background: "#f3f4f6",
    display: "flex",
    flexDirection: "column",
  },

  sourceBox: {
    marginTop: "20px",
    paddingTop: "20px",
    borderTop: "1px solid #e5e7eb",
  },

  sourceLink: {
    display: "block",
    marginTop: "5px",
    color: "#2563eb",
    fontSize: "13px",
    wordBreak: "break-all",
  },
}

export default Apply
