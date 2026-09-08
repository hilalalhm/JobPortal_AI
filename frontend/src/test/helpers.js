import { vi } from "vitest"

export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }
}

// Set global.fetch = mockFn dan kembalikan mockFn agar mudah di-assert.
export function mockFetch(fn) {
  const mock = vi.fn(fn)
  globalThis.fetch = mock
  return mock
}

export function resetFetch() {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(jsonResponse({ success: false }))
  )
}

export const PROFILE_SAMPLE = {
  success: true,
  data: {
    name: "Andi Saputra",
    email: "andi@example.com",
    phone: "0812-3456-7890",
    linkedin: "https://linkedin.com/in/andi",
    github: "https://github.com/andi",
    cv: null,
  },
}

export const APPLICATION_SAMPLE = {
  id: "app-1",
  job: {
    position: "Backend Dev",
    company: "PT Contoh",
    location: "Jakarta",
    salary: "Rp 10-15 juta",
    employment_type: "Full-time",
    deadline: "2026-10-01",
    requirements: ["Python", "FastAPI"],
    responsibilities: ["Membangun API"],
    preferred_qualifications: ["Redis"],
    other_information: ["Remote 2 hari/minggu"],
    contact_email: "hrd@contoh.com",
    contact_phone: "021-1234",
    source_url: "https://contoh.com/jobs/1",
    subject: "",
  },
  status: "saved",
  created_at: "2026-09-01T08:00:00Z",
  cover_letter: "",
}