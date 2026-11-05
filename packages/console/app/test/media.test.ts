import { describe, expect, test } from "bun:test"
import { mediaBase, mediaRedirect } from "../src/lib/media"

describe("media CDN redirect", () => {
  test("sends heavy media to the CDN at the same path", () => {
    const response = mediaRedirect("/product-videos/heroes/sdk-landscape-dark.mp4", "?v=2")
    expect(response?.status).toBe(302)
    expect(response?.headers.get("Location")).toBe(`${mediaBase}/product-videos/heroes/sdk-landscape-dark.mp4?v=2`)
  })

  test("leaves pages, images, build files and download routes alone", () => {
    for (const path of [
      "/",
      "/product",
      "/brand/files/opencode-logo-dark.png",
      "/_build/assets/hero.mp4",
      "/download/stable/darwin-aarch64-dmg",
    ])
      expect(mediaRedirect(path, "")).toBeUndefined()
  })
})
