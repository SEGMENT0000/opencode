// Heavy media (video, audio, download zips and 3D models) is not in git and not in the Worker's
// static assets: it lives on the media CDN at the same path it has under public/. See MEDIA.md.
//
// Pages keep linking the site path (for example /product-videos/heroes/sdk-landscape-dark.mp4).
// In development the file is in public/ and the dev server serves it. In production the request
// misses the static assets, reaches the Worker, and middleware.ts redirects it here.

/** The one base URL of the media CDN. VITE_MEDIA_URL overrides it (for example for a staging bucket). */
export const mediaBase = import.meta.env.VITE_MEDIA_URL || "https://media.opencode.ai/site/2026-11"

/** File types that live on the media CDN. script/upload-media.ts uploads the same set. */
export const mediaFile = /\.(mp4|webm|mov|mp3|wav|ogg|m4a|zip|glb|gltf)$/i

/** The CDN URL for a site path, for example `mediaUrl("/voice/hello.mp3")`. */
export function mediaUrl(path: string) {
  return `${mediaBase}${path}`
}

/** A redirect to the CDN for a media path that the static assets did not serve, or undefined. */
export function mediaRedirect(pathname: string, search: string) {
  if (!mediaFile.test(pathname) || pathname.startsWith("/_build/")) return
  return new Response(null, {
    status: 302,
    headers: { Location: `${mediaUrl(pathname)}${search}`, "Cache-Control": "public, max-age=3600" },
  })
}
