import { useEffect, useState } from "react"

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

const STATUS_OPTIONS = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "interview", label: "Interview" },
  { key: "offered", label: "Offered" },
  { key: "rejected", label: "Rejected" },
]

const STATUS_COLORS = {
  saved: { background: "#eff6ff", color: "#1d4ed8" },
  applied: { background: "#fff7ed", color: "#c2410c" },
  interview: { background: "#fef3c7", color: "#b45309" },
  offered: { background: "#f0fdf4", color: "#15803d" },
  rejected: { background: "#fef2f2", color: "#b91c1c" },
}

function Tracker() {
  const [applications, setApplications] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [expandedId, setExpandedId] = useState(null)
  const [coverLetters, setCoverLetters] = useState({})
  const [coverLoading, setCoverLoading] = useState("")
  const [sendingEmail, setSendingEmail] = useState("")

  // ============================================================
  // LOAD
  // ============================================================

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [appsResponse, profileResponse] = await Promise.all([
          fetch(`${API_URL}/api/applications`),
          fetch(`${API_URL}/api/profile`),
        ])

        const appsResult = await appsResponse.json()
        const profileResult = await profileResponse.json()

        if (!appsResult.success) {
          setMessage(
            appsResult.message ||
            "Gagal memuat daftar lamaran."
          )

          return
        }

        if (!cancelled) {
          setApplications(appsResult.data)

          const persisted = {}
          for (const app of appsResult.data) {
            if (app.cover_letter) {
              persisted[app.id] = app.cover_letter
            }
          }
          setCoverLetters((current) => ({
            ...current,
            ...persisted,
          }))
        }

        if (profileResult.success && !cancelled) {
          setProfile(profileResult.data)
        }
      } catch (error) {
        console.error("Load error:", error)

        setMessage(
          "Gagal terhubung ke server. Pastikan backend sedang berjalan."
        )
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
  // CHANGE STATUS
  // ============================================================

  const handleStatusChange = async (
    application,
    newStatus
  ) => {
    if (newStatus === application.status) {
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/applications/${application.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      )

      const result = await response.json()

      if (!result.success) {
        setMessage(
          result.message ||
          "Gagal memperbarui status."
        )

        return
      }

      setApplications((current) =>
        current.map((app) =>
          app.id === application.id
            ? result.data
            : app
        )
      )

      setMessage(
        "✓ Status lamaran diperbarui."
      )
    } catch (error) {
      console.error("Status error:", error)

      setMessage(
        "Gagal terhubung ke server."
      )
    }
  }

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async (application) => {
    const confirmed = window.confirm(
      `Hapus lamaran "${application.job?.position || "tanpa judul"}"?`
    )

    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/applications/${application.id}`,
        {
          method: "DELETE",
        }
      )

      const result = await response.json()

      if (!result.success) {
        setMessage(
          result.message ||
          "Gagal menghapus lamaran."
        )

        return
      }

      setApplications((current) =>
        current.filter(
          (app) => app.id !== application.id
        )
      )

      setMessage(
        "✓ Lamaran dihapus."
      )
    } catch (error) {
      console.error("Delete error:", error)

      setMessage(
        "Gagal terhubung ke server."
      )
    }
  }

  // ============================================================
  // GENERATE COVER LETTER
  // ============================================================

  const handleGenerateCoverLetter = async (
    application
  ) => {
    setCoverLoading(application.id)

    try {
      const response = await fetch(
        `${API_URL}/api/applications/${application.id}/cover-letter`,
        {
          method: "POST",
        }
      )

      const result = await response.json()

      if (!result.success) {
        setMessage(
          result.message ||
          "Gagal membuat cover letter."
        )

        return
      }

      setCoverLetters((current) => ({
        ...current,
        [application.id]:
          result.data.cover_letter,
      }))

      setMessage(
        "✓ Cover letter berhasil dibuat."
      )
    } catch (error) {
      console.error("Cover letter error:", error)

      setMessage(
        "Gagal terhubung ke server. Pastikan backend sedang berjalan."
      )
    } finally {
      setCoverLoading("")
    }
  }

  // ============================================================
  // COPY COVER LETTER
  // ============================================================

  const handleCopyCoverLetter = (
    application
  ) => {
    const text = coverLetters[application.id]

    if (!text) {
      return
    }

    navigator.clipboard.writeText(text)
      .then(() => {
        setMessage(
          "✓ Cover letter disalin ke clipboard."
        )
      })
      .catch(() => {
        setMessage(
          "Gagal menyalin ke clipboard."
        )
      })
  }

  // ============================================================
  // SEND EMAIL
  // ============================================================

  const handleSendEmail = async (application) => {
    const job = application.job || {}
    const contactEmail = job.contact_email || ""

    const jobSubject = job.subject || ""
    const defaultSubject =
      jobSubject ||
      `Lamaran Kerja ${job.position || "posisi"} - ${profile?.name || "Saya"}`

    const confirmed = window.confirm(
      contactEmail
        ? `Kirim email lamaran ke ${contactEmail}?\n\nSubjek: ${defaultSubject}\n\nCV akan dilampirkan secara otomatis.`
        : `Lamaran ini tidak memiliki email kontak. Lanjutkan tetap dikirim?\n\nSubjek: ${defaultSubject}`
    )

    if (!confirmed) {
      return
    }

    setSendingEmail(application.id)

    const body = {
      subject: defaultSubject,
    }

    if (coverLetters[application.id]) {
      body.cover_letter =
        coverLetters[application.id]
    }

    try {
      const response = await fetch(
        `${API_URL}/api/applications/${application.id}/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      )

      const result = await response.json()

      setMessage(
        result.success
          ? `✓ ${result.message}`
          : result.message ||
            "Gagal mengirim email."
      )
    } catch (error) {
      console.error("Send email error:", error)

      setMessage(
        "Gagal terhubung ke server. Pastikan backend sedang berjalan."
      )
    } finally {
      setSendingEmail("")
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <div style={styles.header}>
          <h1 style={styles.title}>Job Tracker</h1>

          <p style={styles.subtitle}>
            Pantau status lamaran pekerjaanmu.
          </p>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        {loading ? (
          <div style={styles.emptyState}>
            Memuat daftar lamaran...
          </div>
        ) : applications.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📋</div>

            <strong>
              Belum ada lamaran tersimpan
            </strong>

            <span style={styles.emptySubtext}>
              Analisis lowongan di halaman
              "New Application", lalu simpan
              ke tracker.
            </span>
          </div>
        ) : (
          <div style={styles.grid}>

            {applications.map((application) => {
              const job = application.job || {}
              const status = STATUS_COLORS[
                application.status
              ] || STATUS_COLORS.rejected

              const statusLabel = (
                STATUS_OPTIONS.find(
                  (option) =>
                    option.key === application.status
                ) || STATUS_OPTIONS[0]
              ).label

              const expanded =
                expandedId === application.id

              return (
                <div
                  key={application.id}
                  style={styles.card}
                >

                  {/* ====================================== */}
                  {/* CARD HEADER */}
                  {/* ====================================== */}

                  <div style={styles.cardHeader}>

                    <div style={styles.cardTitleBlock}>

                      <span
                        style={{
                          ...styles.statusBadge,
                          background: status.background,
                          color: status.color,
                        }}
                      >
                        {statusLabel}
                      </span>

                      <h2 style={styles.cardTitle}>
                        {job.position ||
                          "Position not specified"}
                      </h2>

                      <p style={styles.companyName}>
                        {job.company ||
                          "Company not specified"}
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(application)
                      }
                      style={styles.deleteButton}
                      title="Hapus lamaran"
                    >
                      ✕
                    </button>

                  </div>

                  {/* ====================================== */}
                  {/* QUICK INFO */}
                  {/* ====================================== */}

                  <div style={styles.metaGrid}>

                    {job.location && (
                      <div style={styles.metaItem}>
                        <span style={styles.label}>
                          Location
                        </span>
                        <strong>
                          {job.location}
                        </strong>
                      </div>
                    )}

                    {job.salary && (
                      <div style={styles.metaItem}>
                        <span style={styles.label}>
                          Salary
                        </span>
                        <strong>
                          {job.salary}
                        </strong>
                      </div>
                    )}

                    {job.employment_type && (
                      <div style={styles.metaItem}>
                        <span style={styles.label}>
                          Type
                        </span>
                        <strong>
                          {job.employment_type}
                        </strong>
                      </div>
                    )}

                    {job.deadline && (
                      <div style={styles.metaItem}>
                        <span style={styles.label}>
                          Deadline
                        </span>
                        <strong>
                          {job.deadline}
                        </strong>
                      </div>
                    )}

                  </div>

                  {/* ====================================== */}
                  {/* STATUS + ACTIONS */}
                  {/* ====================================== */}

                  <div style={styles.actionsRow}>

                    <label style={styles.statusLabel}>
                      Status

                      <select
                        value={application.status}
                        onChange={(event) =>
                          handleStatusChange(
                            application,
                            event.target.value
                          )
                        }
                        style={styles.select}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option
                            key={option.key}
                            value={option.key}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(
                          expanded ? null : application.id
                        )
                      }
                      style={styles.detailButton}
                    >
                      {expanded
                        ? "Tutup Detail"
                        : "Lihat Detail"}
                    </button>

                  </div>

                  {/* ====================================== */}
                  {/* CREATED AT */}
                  {/* ====================================== */}

                  <div style={styles.createdAt}>
                    Disimpan:{" "}
                    {formatDate(
                      application.created_at
                    )}
                  </div>

                  {/* ====================================== */}
                  {/* DETAILS */}
                  {/* ====================================== */}

                  {expanded && (
                    <div style={styles.details}>

                      {job.requirements?.length > 0 && (
                        <div style={styles.detailSection}>
                          <h3 style={styles.detailTitle}>
                            Requirements
                          </h3>

                          <ul style={styles.list}>
                            {job.requirements.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                      {job.responsibilities?.length > 0 && (
                        <div style={styles.detailSection}>
                          <h3 style={styles.detailTitle}>
                            Responsibilities
                          </h3>

                          <ul style={styles.list}>
                            {job.responsibilities.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                      {job.preferred_qualifications?.length > 0 && (
                        <div style={styles.detailSection}>
                          <h3 style={styles.detailTitle}>
                            Preferred Qualifications
                          </h3>

                          <ul style={styles.list}>
                            {job.preferred_qualifications.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                      {job.other_information?.length > 0 && (
                        <div style={styles.detailSection}>
                          <h3 style={styles.detailTitle}>
                            Other Information
                          </h3>

                          <ul style={styles.list}>
                            {job.other_information.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                      {(job.contact_email ||
                        job.contact_phone) && (
                        <div style={styles.contactBox}>

                          {job.contact_email && (
                            <div>
                              <span style={styles.label}>
                                Application Email
                              </span>

                              <strong>
                                {job.contact_email}
                              </strong>
                            </div>
                          )}

                          {job.contact_phone && (
                            <div>
                              <span style={styles.label}>
                                Contact Phone
                              </span>

                              <strong>
                                {job.contact_phone}
                              </strong>
                            </div>
                          )}

                        </div>
                      )}

                      {job.source_url && (
                        <div style={styles.sourceBox}>
                          <a
                            href={job.source_url}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.sourceLink}
                          >
                            {job.source_url}
                          </a>
                        </div>
                      )}

                      {/* ================================ */}
                      {/* COVER LETTER */}
                      {/* ================================ */}

                      <div style={styles.coverSection}>

                        <h3 style={styles.detailTitle}>
                          AI Cover Letter
                        </h3>

                        {!coverLetters[application.id] ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleGenerateCoverLetter(
                                application
                              )
                            }
                            disabled={
                              coverLoading === application.id
                            }
                            style={{
                              ...styles.coverButton,
                              ...(coverLoading ===
                                application.id
                                ? styles.coverButtonDisabled
                                : {}),
                            }}
                          >
                            {coverLoading === application.id
                              ? "Membuat cover letter..."
                              : "✍️ Generate Cover Letter"}
                          </button>
                        ) : (
                          <div style={styles.coverBox}>

                            <pre style={styles.coverPre}>
                              {coverLetters[
                                application.id
                              ]}
                            </pre>

                            <div style={styles.coverActions}>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyCoverLetter(
                                    application
                                  )
                                }
                                style={styles.coverCopyButton}
                              >
                                📋 Salin
                              </button>
                            </div>

                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleSendEmail(application)
                          }
                          disabled={
                            sendingEmail === application.id
                          }
                          style={{
                            ...styles.emailButton,
                            ...(sendingEmail ===
                              application.id
                              ? styles.emailButtonDisabled
                              : {}),
                          }}
                        >
                          {sendingEmail === application.id
                            ? "Mengirim email..."
                            : job.contact_email
                              ? `📧 Kirim Email ke ${job.contact_email}`
                              : "📧 Kirim Email (tanpa tujuan)"}
                          {job.subject && sendingEmail !== application.id ? (
                            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: 2, textAlign: "left" }}>
                              Subjek: {job.subject}
                            </div>
                          ) : null}
                        </button>

                      </div>

                    </div>
                  )}

                </div>
              )
            })}

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
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    color: "#6b7280",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "42px",
  },

  emptySubtext: {
    fontSize: "13px",
    color: "#9ca3af",
  },

  grid: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  card: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "22px",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "18px",
  },

  cardTitleBlock: {
    minWidth: 0,
  },

  statusBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.3px",
    marginBottom: "10px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "19px",
    color: "#111827",
    wordBreak: "break-word",
  },

  companyName: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },

  deleteButton: {
    flexShrink: 0,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#dc2626",
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    paddingBottom: "16px",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: "14px",
  },

  metaItem: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    fontSize: "13px",
    color: "#374151",
    wordBreak: "break-word",
  },

  label: {
    fontSize: "11px",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },

  actionsRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },

  statusLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    fontSize: "11px",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },

  select: {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#ffffff",
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
  },

  detailButton: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    padding: "9px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },

  createdAt: {
    marginTop: "12px",
    fontSize: "12px",
    color: "#9ca3af",
  },

  details: {
    marginTop: "16px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
  },

  detailSection: {
    marginBottom: "16px",
  },

  detailTitle: {
    margin: "0 0 8px",
    fontSize: "14px",
    color: "#111827",
  },

  list: {
    margin: 0,
    paddingLeft: "18px",
    color: "#374151",
    fontSize: "13px",
    lineHeight: "1.6",
  },

  contactBox: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "9px",
    background: "#f3f4f6",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    fontSize: "13px",
    color: "#374151",
  },

  sourceBox: {
    marginTop: "14px",
  },

  sourceLink: {
    color: "#2563eb",
    fontSize: "13px",
    wordBreak: "break-all",
  },

  coverSection: {
    marginTop: "18px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  coverButton: {
    width: "100%",
    padding: "12px",
    border: "none",
    borderRadius: "8px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },

  coverButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  emailButton: {
    width: "100%",
    padding: "12px",
    border: "1px solid #1d4ed8",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },

  emailButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  coverBox: {
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    overflow: "hidden",
    background: "#fafafa",
  },

  coverPre: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: "16px",
    margin: 0,
    fontSize: "13px",
    lineHeight: "1.7",
    color: "#374151",
    fontFamily: "Inter, Arial, sans-serif",
    maxHeight: "320px",
    overflowY: "auto",
  },

  coverActions: {
    padding: "10px",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "flex-end",
  },

  coverCopyButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
}

export default Tracker