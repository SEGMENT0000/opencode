// Uploads the heavy media in public/ (src/lib/media.ts `mediaFile`) to the media CDN bucket, at the
// same path under the version prefix, and writes media-manifest.txt. Not part of the build.
//
//   bun ./script/upload-media.ts --manifest         rewrite media-manifest.txt from public/
//   bun ./script/upload-media.ts                    print the uploads (dry run)
//   bun ./script/upload-media.ts --run              upload with `wrangler r2 object put --remote`
//
// MEDIA_BUCKET (default opencode-site-media) and MEDIA_PREFIX (default site/2026-11) must match
// mediaBase in src/lib/media.ts. Files that git tracks stay in the static assets and are skipped.
import { createHash } from "node:crypto"
import path from "node:path"
import { Glob } from "bun"
import { mediaFile } from "../src/lib/media"

const root = path.resolve(import.meta.dir, "..")
const publicDir = path.join(root, "public")
const bucket = process.env.MEDIA_BUCKET ?? "opencode-site-media"
const prefix = process.env.MEDIA_PREFIX ?? "site/2026-11"
const run = process.argv.includes("--run")
const writeManifest = process.argv.includes("--manifest")

const tracked = new Set(
  (await Bun.$`git ls-files public`.cwd(root).quiet().text()).split("\n").map((file) => file.replace(/^public\//, "")),
)
const files = (await Array.fromAsync(new Glob("**/*").scan({ cwd: publicDir })))
  .filter((file) => mediaFile.test(file) && !tracked.has(file))
  .sort()

const types: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  zip: "application/zip",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
}

if (writeManifest) {
  const lines = await Promise.all(
    files.map(async (file) => {
      const bytes = await Bun.file(path.join(publicDir, file)).arrayBuffer()
      return `${createHash("sha256").update(new Uint8Array(bytes)).digest("hex")}  ${bytes.byteLength}  /${file}`
    }),
  )
  await Bun.write(
    path.join(root, "media-manifest.txt"),
    `# sha256  bytes  path: the files script/upload-media.ts uploads to ${bucket}/${prefix}\n${lines.join("\n")}\n`,
  )
  console.log(`media-manifest.txt: ${files.length} files`)
  process.exit(0)
}

for (const file of files) {
  const key = `${bucket}/${prefix}/${file}`
  const type = types[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream"
  if (!run) {
    console.log(`would upload ${key} (${type})`)
    continue
  }
  await Bun.$`bunx wrangler r2 object put ${key} --file ${path.join(publicDir, file)} --content-type ${type} --cache-control ${"public, max-age=31536000, immutable"} --remote`.cwd(
    root,
  )
}
console.log(`${run ? "uploaded" : "dry run:"} ${files.length} files to ${bucket}/${prefix}`)
