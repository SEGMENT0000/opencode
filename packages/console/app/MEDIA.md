# Media CDN

The site's heavy media (product videos, voice clips, arcade sounds, 3D models and download zips, about 148 MB; `media-manifest.txt` lists every file) is not in git and not in the Worker's static assets. It lives on a media CDN at the same path it has under `public/`.

## How it works

- `src/lib/media.ts` holds the one base URL, `mediaBase` (default `https://media.opencode.ai/site/2026-11`, override with `VITE_MEDIA_URL`), and the file types that live on the CDN (`mediaFile`: `mp4`, `webm`, `mov`, `mp3`, `wav`, `ogg`, `m4a`, `zip`, `glb`, `gltf`).
- Pages keep linking the site path, for example `/product-videos/heroes/sdk-landscape-dark.mp4`.
- In development the file is in `public/` (git-ignored, see `.gitignore`), and the dev server serves it.
- In production the request misses the static assets and reaches the Worker. `middleware.ts` sends a 302 to `mediaBase` plus the path.
- Files that dev already tracked in git (for example `public/opencode-brand-assets.zip`) stay in git and in the static assets.
- Images (`png`, `jpg`, `webp`, `avif`, `svg`), posters, fonts and the 3D decoders (`arcade3d/draco`, `arcade3d/basis`) stay in git.

## Files

`media-manifest.txt` lists every file to upload, with its SHA-256 and size. Regenerate it with `bun ./script/upload-media.ts --manifest`.

| Folder | Files |
|---|---|
| `product-videos/` | hero, card, feature and locked videos |
| `voice/` | voice mode clips |
| `arcade404/audio/` | 404 arcade sounds |
| `arcade3d/` | cabinet models (`*.glb`) |
| `font/film/` | font film videos |
| `press-media/zips/`, `opencode-press-media.zip`, `press/anomaly/*.zip` | press kit downloads |
| `brand/badges/*.zip` | badge downloads |

## Set up the bucket (once)

1. Create an R2 bucket `opencode-site-media` (or add `sst.cloudflare.Bucket("SiteMedia")` in `infra/console.ts`) with a public custom domain `media.opencode.ai`.
2. Add a CORS rule for `GET` and `HEAD` from `https://opencode.ai` and `https://*.opencode.ai`. The arcade loads its models (`GLTFLoader`) and sounds (`fetch`) with JavaScript, which needs CORS after the redirect. `<video>` and download links do not.
3. Objects are uploaded with `Cache-Control: public, max-age=31536000, immutable`. A changed file gets a new version prefix (for example `site/2026-12`) and a new `mediaBase`.

## Upload (before the deploy that removes the files)

```sh
cd packages/console/app
bun ./script/upload-media.ts             # dry run: lists every upload
MEDIA_BUCKET=opencode-site-media MEDIA_PREFIX=site/2026-11 bun ./script/upload-media.ts --run
curl -sI https://media.opencode.ai/site/2026-11/voice/hello.mp3   # expect 200 and audio/mpeg
```

The upload needs the media files in `public/`. They are in the `new-website` worktree and in the merge worktree; they are not in git.
