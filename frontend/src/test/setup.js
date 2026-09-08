import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
})

// jsdom tidak punya createObjectURL (dipakai Apply.jsx untuk preview)
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-preview")
  globalThis.URL.revokeObjectURL = vi.fn()
}

// navigator.clipboard tidak tersedia di jsdom
if (!globalThis.navigator.clipboard) {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    },
    configurable: true,
  })
}