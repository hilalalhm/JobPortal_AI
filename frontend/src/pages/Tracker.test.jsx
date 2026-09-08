import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import Tracker from "./Tracker"
import {
  APPLICATION_SAMPLE,
  jsonResponse,
  mockFetch,
  resetFetch,
} from "../test/helpers"

const appA = {
  ...APPLICATION_SAMPLE,
  id: "app-1",
  job: { ...APPLICATION_SAMPLE.job, position: "Backend Dev", subject: "" },
  status: "saved",
  cover_letter: "",
}

const appB = {
  ...APPLICATION_SAMPLE,
  id: "app-2",
  job: {
    ...APPLICATION_SAMPLE.job,
    position: "Frontend Dev",
    company: "PT Dua",
    subject: "Lamaran_[Posisi]_[Nama Lengkap]",
  },
  status: "interview",
  cover_letter: "",
}

const profile = {
  success: true,
  data: {
    name: "Andi Saputra",
    email: "andi@example.com",
    cv: null,
  },
}

const appsResponse = (apps) => {
  return { success: true, data: apps }
}

function mockRoutes({ apps = [appA, appB], profileData = profile.data } = {}) {
  return mockFetch((url, options = {}) => {
    const method = options.method || "GET"

    if (method === "GET" && url.endsWith("/api/applications")) {
      return jsonResponse(appsResponse(apps))
    }

    if (method === "GET" && url.endsWith("/api/profile")) {
      return jsonResponse({ success: true, data: profileData })
    }

    if (method === "PATCH" && url.includes("/api/applications/")) {
      const id = url.split("/").pop()
      const app = apps.find((a) => a.id === id)

      return jsonResponse({
        success: true,
        data: { ...app, status: options.body?.status },
      })
    }

    if (method === "DELETE" && url.includes("/api/applications/")) {
      return jsonResponse({ success: true })
    }

    if (
      method === "POST" &&
      url.includes("/cover-letter")
    ) {
      return jsonResponse({
        success: true,
        data: {
          cover_letter: "Kepada Yth. Tim Rekrutmen,\n\nSalam,\nAndi Saputra",
        },
      })
    }

    if (
      method === "POST" &&
      url.includes("/send-email")
    ) {
      return jsonResponse({
        success: true,
        message: "Email lamaran berhasil dikirim.",
      })
    }

    return jsonResponse({ success: false })
  })
}

describe("Tracker", () => {
  let user
  let getCard

  beforeAll(() => {
    // Ambil elemen kartu (root card) dari heading posisi
    getCard = async (position) =>
      (
        await screen.findByRole("heading", { name: position })
      ).closest('[style*="border-radius: 14px"]')
  })

  beforeEach(() => {
    user = userEvent.setup()
  })

  afterEach(() => {
    resetFetch()
  })

  it("memuat dan menampilkan daftar lamaran beserta perusahaan", async () => {
    mockRoutes()

    render(<Tracker />)

    expect(
      screen.getByText("Memuat daftar lamaran...")
    ).toBeInTheDocument()

    expect(
      await screen.findByText("Backend Dev")
    ).toBeInTheDocument()
    expect(screen.getByText("PT Contoh")).toBeInTheDocument()
    expect(screen.getByText("Frontend Dev")).toBeInTheDocument()
    expect(screen.getByText("PT Dua")).toBeInTheDocument()
  })

  it("menampilkan empty state saat tidak ada lamaran", async () => {
    mockRoutes({ apps: [] })

    render(<Tracker />)

    expect(
      await screen.findByText("Belum ada lamaran tersimpan")
    ).toBeInTheDocument()
  })

  it("mengubah status lewat dropdown PATCH", async () => {
    const fetchMock = mockRoutes()

    render(<Tracker />)

    const card = await getCard("Backend Dev")
    const select = within(card).getByRole("combobox")

    await user.selectOptions(select, "interview")

    await screen.findByText("✓ Status lamaran diperbarui.")

    const patchCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        options?.method === "PATCH" && url.includes("/api/applications/")
    )

    expect(patchCall).toBeTruthy()
    expect(JSON.parse(patchCall[1].body).status).toBe("interview")
  })

  it("menghapus lamaran setelah konfirmasi", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true)

    const fetchMock = mockRoutes({ apps: [appA] })

    render(<Tracker />)

    const card = await getCard("Backend Dev")
    const deleteButton = within(card).getByTitle("Hapus lamaran")

    await user.click(deleteButton)

    await screen.findByText("✓ Lamaran dihapus.")
    expect(
      screen.queryByText("Backend Dev")
    ).not.toBeInTheDocument()

    expect(fetchMock.mock.calls.some(
      ([url, options]) =>
        options?.method === "DELETE" && url.endsWith("/api/applications/app-1")
    )).toBe(true)

    confirmSpy.mockRestore()
  })

  it("tidak menghapus saat konfirmasi dibatalkan", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(false)

    const fetchMock = mockRoutes({ apps: [appA] })

    render(<Tracker />)

    const card = await getCard("Backend Dev")
    await user.click(within(card).getByTitle("Hapus lamaran"))

    expect(
      screen.getByText("Backend Dev")
    ).toBeInTheDocument()

    const anyDelete = fetchMock.mock.calls.some(
      ([, options]) => options?.method === "DELETE"
    )

    expect(anyDelete).toBe(false)

    confirmSpy.mockRestore()
  })

  it("membuat cover letter dan menampilkannya", async () => {
    mockRoutes()

    render(<Tracker />)

    const card = await getCard("Backend Dev")

    await user.click(
      within(card).getByRole("button", { name: "Lihat Detail" })
    )

    await user.click(
      within(card).getByRole("button", {
        name: "✍️ Generate Cover Letter",
      })
    )

    await screen.findByText("✓ Cover letter berhasil dibuat.")
    expect(
      screen.getByText(/Kepada Yth\. Tim Rekrutmen/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "📋 Salin" })
    ).toBeInTheDocument()
  })

  it("menampilkan cover letter yang sudah tersimpan tanpa generate", async () => {
    mockRoutes({
      apps: [
        {
          ...appA,
          cover_letter:
            "Kepada Yth. HRD PT Contoh, surat ini dibuat sebelumnya.",
        },
      ],
    })

    render(<Tracker />)

    const card = await getCard("Backend Dev")

    await user.click(
      within(card).getByRole("button", { name: "Lihat Detail" })
    )

    expect(
      screen.getByText("Kepada Yth. HRD PT Contoh, surat ini dibuat sebelumnya.")
    ).toBeInTheDocument()

    expect(
      within(card).queryByRole("button", {
        name: "✍️ Generate Cover Letter",
      })
    ).not.toBeInTheDocument()
  })

  it("mengirim email dengan subjek hasil placeholder + nama profil", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true)

    const fetchMock = mockRoutes({ apps: [appB] })

    render(<Tracker />)

    const card = await getCard("Frontend Dev")

    await user.click(
      within(card).getByRole("button", { name: "Lihat Detail" })
    )

    await user.click(
      within(card).getByRole("button", {
        name: /📧 Kirim Email ke hrd@contoh\.com/,
      })
    )

    await screen.findByText("✓ Email lamaran berhasil dikirim.")

    const postCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        options?.method === "POST" && url.includes("/send-email")
    )

    expect(postCall).toBeTruthy()
    // Frontend mengirim subjek apa adanya (placeholder di-resolve backend)
    expect(JSON.parse(postCall[1].body).subject).toBe(
      "Lamaran_[Posisi]_[Nama Lengkap]"
    )

    confirmSpy.mockRestore()
  })

  it("mengirim email tanpa email kontak tetap berjalan", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true)

    const noContact = {
      ...appA,
      job: { ...appA.job, contact_email: "", subject: "" },
    }

    const fetchMock = mockRoutes({ apps: [noContact] })

    render(<Tracker />)

    const card = await getCard("Backend Dev")

    await user.click(
      within(card).getByRole("button", { name: "Lihat Detail" })
    )

    await user.click(
      within(card).getByRole("button", {
        name: "📧 Kirim Email (tanpa tujuan)",
      })
    )

    await screen.findByText("✓ Email lamaran berhasil dikirim.")

    expect(
      fetchMock.mock.calls.some(([url, options]) =>
        options?.method === "POST" && url.includes("/send-email")
      )
    ).toBe(true)

    confirmSpy.mockRestore()
  })
})