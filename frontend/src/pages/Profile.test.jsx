import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import Profile from "./Profile"
import {
  PROFILE_SAMPLE,
  jsonResponse,
  mockFetch,
  resetFetch,
} from "../test/helpers"

function makePdfFile(name = "CV.pdf", size = 1024) {
  const bytes = new Uint8Array(size)
  bytes[0] = 0x25
  bytes[1] = 0x50
  bytes[2] = 0x44
  bytes[3] = 0x46

  return new File([bytes], name, { type: "application/pdf" })
}

describe("Profile", () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
  })

  afterEach(() => {
    resetFetch()
  })

  it("menampilkan indikator loading lalu mengisi form dari profil", async () => {
    mockFetch(() =>
      jsonResponse({
        success: true,
        data: { ...PROFILE_SAMPLE.data, cv: null },
      })
    )

    render(<Profile />)

    expect(screen.getByText("Memuat profil...")).toBeInTheDocument()

    const nameInput = await screen.findByPlaceholderText("Nama lengkap")
    expect(nameInput).toHaveValue("Andi Saputra")
    expect(
      screen.getByPlaceholderText("email@example.com")
    ).toHaveValue("andi@example.com")
    expect(
      screen.getByPlaceholderText("08xx-xxxx-xxxx")
    ).toHaveValue("0812-3456-7890")
  })

  it("menyimpan profil lewat PUT /api/profile", async () => {
    const fetchMock = mockFetch((url, options = {}) => {
      if (url.endsWith("/api/profile")) {
        if (options.method === "PUT") {
          return jsonResponse({
            success: true,
            data: { ...PROFILE_SAMPLE.data, cv: null },
          })
        }

        return jsonResponse({
          success: true,
          data: { ...PROFILE_SAMPLE.data, cv: null },
        })
      }

      return jsonResponse({ success: false })
    })

    render(<Profile />)

    await screen.findByPlaceholderText("Nama lengkap")

    const githubInput = screen.getByPlaceholderText(
      "https://github.com/..."
    )
    fireEvent.change(githubInput, {
      target: { value: "https://github.com/andisaputra" },
    })

    await user.click(
      screen.getByRole("button", { name: "💾 Simpan Profil" })
    )

    await screen.findByText("✓ Profil berhasil disimpan.")

    const putCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url.endsWith("/api/profile") && options?.method === "PUT"
    )

    expect(putCall).toBeTruthy()
    const body = JSON.parse(putCall[1].body)
    expect(body.github).toBe("https://github.com/andisaputra")
    expect(body.name).toBe("Andi Saputra")
  })

  it("menolak file non-PDF", async () => {
    mockFetch(() => jsonResponse({ success: false }))

    render(<Profile />)

    await screen.findByText("⬆️ Upload CV (PDF)")

    const file = new File(["hello"], "cv.txt", {
      type: "text/plain",
    })

    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()

    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText("CV harus berupa file PDF.")
    ).toBeInTheDocument()
  })

  it("menolak PDF yang lebih dari 10 MB", async () => {
    mockFetch(() => jsonResponse({ success: false }))

    render(<Profile />)

    await screen.findByText("⬆️ Upload CV (PDF)")

    const big = makePdfFile("big.pdf", 11 * 1024 * 1024)

    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [big] } })

    expect(
      await screen.findByText("Ukuran CV maksimal 10 MB.")
    ).toBeInTheDocument()
  })

  it("mengunggah PDF valid dan menampilkan nama file", async () => {
    mockFetch((url, options = {}) => {
      if (url.endsWith("/api/profile/cv") && options.method === "POST") {
        return jsonResponse({
          success: true,
          path: "cv/CV.pdf",
        })
      }

      return jsonResponse({
        success: true,
        data: { ...PROFILE_SAMPLE.data, cv: null },
      })
    })

    render(<Profile />)

    await screen.findByText("⬆️ Upload CV (PDF)")

    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, {
      target: { files: [makePdfFile("CV.pdf")] },
    })

    await screen.findByText("✓ CV berhasil diunggah.")

    expect(screen.getByText("CV.pdf")).toBeInTheDocument()
  })

  it("mengekstrak teks CV saat tombol Ekstrak Teks diklik", async () => {
    const cvData = {
      filename: "CV.pdf",
      path: "cv/CV.pdf",
      uploaded_at: "2026-09-01T07:00:00Z",
    }

    mockFetch((url) => {
      if (url.endsWith("/api/profile/cv/text")) {
        return jsonResponse({
          success: true,
          text: "Pengalaman: Backend Developer",
        })
      }

      return jsonResponse({
        success: true,
        data: { name: "Andi Saputra", cv: cvData },
      })
    })

    render(<Profile />)

    await screen.findByText("CV.pdf")

    await user.click(
      screen.getByRole("button", { name: "Ekstrak Teks" })
    )

    await screen.findByText("✓ Teks CV berhasil diekstrak.")
    expect(
      screen.getByText("Pengalaman: Backend Developer")
    ).toBeInTheDocument()
  })
})