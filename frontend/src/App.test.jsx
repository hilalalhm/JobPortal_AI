import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import App from "./App"
import { jsonResponse, mockFetch, resetFetch } from "./test/helpers"

describe("App", () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()

    mockFetch((url) => {
      if (url === "/api/applications") {
        return jsonResponse({ success: true, data: [] })
      }

      if (url === "/api/profile") {
        return jsonResponse({
          success: true,
          data: { name: "", cv: null },
        })
      }

      return jsonResponse({ success: false })
    })
  })

  afterEach(() => {
    resetFetch()
  })

  it("menampilkan brand dan navigasi tiga tab", () => {
    render(<App />)

    expect(screen.getByText("JobPilot AI")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New Application" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Job Tracker" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Profil" })
    ).toBeInTheDocument()
  })

  it("beralih ke Job Tracker saat tab diklik", async () => {
    render(<App />)

    await user.click(
      screen.getByRole("button", { name: "Job Tracker" })
    )

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Job Tracker",
      })
    ).toBeInTheDocument()
  })

  it("beralih ke Profil saat tab diklik", async () => {
    render(<App />)

    await user.click(
      screen.getByRole("button", { name: "Profil" })
    )

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Profil",
      })
    ).toBeInTheDocument()
  })

  it("kembali ke New Application saat tab apply diklik", async () => {
    render(<App />)

    await user.click(
      screen.getByRole("button", { name: "Profil" })
    )

    await screen.findByRole("heading", {
      level: 1,
      name: "Profil",
    })

    await user.click(
      screen.getByRole("button", { name: "New Application" })
    )

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "New Application",
      })
    ).toBeInTheDocument()
  })
})