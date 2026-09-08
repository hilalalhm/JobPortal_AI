import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import Apply from "./Apply"
import { jsonResponse, mockFetch, resetFetch } from "../test/helpers"

const ANALYZE_RESULT = {
  success: true,
  data: {
    position: "Backend Dev",
    company: "PT Contoh",
    location: "Jakarta",
    employment_type: "Full-time",
    salary: "Rp 10-15 juta",
    deadline: "2026-10-01",
    requirements: ["Python", "FastAPI"],
    responsibilities: ["Membangun API"],
    preferred_qualifications: ["Redis"],
    contact_email: "hrd@contoh.com",
    source_url: "https://contoh.com/jobs/1",
    other_information: [],
  },
}

describe("Apply", () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
  })

  afterEach(() => {
    resetFetch()
  })

  it("menampilkan pesan validasi saat input kosong", async () => {
    render(<Apply />)

    await user.click(
      screen.getByRole("button", { name: "Analyze Job" })
    )

    expect(
      screen.getByText(
        "Masukkan screenshot, deskripsi, atau link lowongan."
      )
    ).toBeInTheDocument()
  })

  it("menganalisis teks dan menampilkan hasil AI", async () => {
    const fetchMock = mockFetch((url) => {
      if (url.endsWith("/api/jobs/analyze-input")) {
        return jsonResponse(ANALYZE_RESULT)
      }

      return jsonResponse({ success: false })
    })

    render(<Apply />)

    await user.type(
      screen.getByPlaceholderText("Paste job description di sini..."),
      "Backend Dev di Jakarta"
    )

    await user.click(
      screen.getByRole("button", { name: "Analyze Job" })
    )

    await screen.findByText("✓ Lowongan berhasil dianalisis.")

    expect(
      screen.getByRole("heading", { name: "Backend Dev" })
    ).toBeInTheDocument()
    expect(screen.getByText("PT Contoh")).toBeInTheDocument()
    expect(screen.getByText("Python")).toBeInTheDocument()

    const analyzeCall = fetchMock.mock.calls.find(([url]) =>
      url.endsWith("/api/jobs/analyze-input")
    )

    expect(analyzeCall).toBeTruthy()
    const formData = analyzeCall[1].body
    expect(formData.get("text")).toBe("Backend Dev di Jakarta")
  })

  it("menganalisis hanya dengan URL", async () => {
    mockFetch((url) =>
      url.endsWith("/api/jobs/analyze-input")
        ? jsonResponse({ ...ANALYZE_RESULT, data: { ...ANALYZE_RESULT.data, source_url: "https://contoh.com/jobs/1" } })
        : jsonResponse({ success: false })
    )

    render(<Apply />)

    await user.type(
      screen.getByPlaceholderText("https://www.instagram.com/..."),
      "https://contoh.com/jobs/1"
    )

    await user.click(
      screen.getByRole("button", { name: "Analyze Job" })
    )

    await screen.findByText("✓ Lowongan berhasil dianalisis.")
    expect(
      screen.getByText("https://contoh.com/jobs/1")
    ).toBeInTheDocument()
  })

  it("menolak file non-gambar saat upload screenshot", async () => {
    render(<Apply />)

    const file = new File(["x"], "cv.txt", { type: "text/plain" })

    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText("File harus berupa gambar.")
    ).toBeInTheDocument()
  })

  it("menolak gambar yang lebih dari 10 MB", async () => {
    render(<Apply />)

    const file = new File(
      [new ArrayBuffer(11 * 1024 * 1024)],
      "shot.png",
      { type: "image/png" }
    )

    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText("Ukuran gambar maksimal 10 MB.")
    ).toBeInTheDocument()
  })

  it("menyimpan hasil analisis ke tracker", async () => {
    mockFetch((url, options = {}) => {
      if (url.endsWith("/api/jobs/analyze-input")) {
        return jsonResponse(ANALYZE_RESULT)
      }

      if (url.endsWith("/api/applications") && options.method === "POST") {
        return jsonResponse({
          success: true,
          data: { id: "app-9" },
        })
      }

      return jsonResponse({ success: false })
    })

    render(<Apply />)

    await user.type(
      screen.getByPlaceholderText("Paste job description di sini..."),
      "Lowongan"
    )

    await user.click(
      screen.getByRole("button", { name: "Analyze Job" })
    )

    await screen.findByText("✓ Lowongan berhasil dianalisis.")

    await user.click(
      screen.getByRole("button", { name: "💾 Save to Tracker" })
    )

    await screen.findByText("✓ Lamaran disimpan ke Job Tracker.")

    expect(
      screen.getByRole("button", { name: "✓ Saved to Tracker" })
    ).toBeInTheDocument()
  })

  it("menangani kegagalan analisis dari server", async () => {
    mockFetch(() =>
      jsonResponse({
        success: false,
        message: "Analisis gagal: coba lagi.",
      })
    )

    render(<Apply />)

    await user.type(
      screen.getByPlaceholderText("Paste job description di sini..."),
      "Lowongan"
    )

    await user.click(
      screen.getByRole("button", { name: "Analyze Job" })
    )

    expect(
      await screen.findByText("Analisis gagal: coba lagi.")
    ).toBeInTheDocument()
  })
})