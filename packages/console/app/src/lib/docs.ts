// Where the current docs live. The docs Intro is a page of this app; the other docs pages come from
// the separate docs app at the same paths. The old /v2/docs URLs redirect here (see middleware.ts).
export const docsBase = "/v2/docs"

/** The V1 docs, which the separate V1 docs app still serves. */
export const v1DocsUrl = "https://docs.opencode.ai/docs/"

/** A site-relative link into the docs, for example `docsUrl("/models/")`. */
export function docsUrl(path = "") {
  return `${docsBase}${path}`
}

/**
 * The site's Docs link (nav, menu and footer): the docs, or on the development server the docs
 * reference page (/dev/docs), which shows every chosen docs component for the docs rebuild.
 */
export function docsLinkUrl() {
  return import.meta.env.DEV ? "/dev/docs" : docsUrl()
}
