import type { FC } from "hono/jsx";

/**
 * The mark: a ticket stub, notched on both sides like one torn at a door,
 * with the right-hand notch opening a C.
 *
 * Drawn as a sticker: yellow stub, heavy black outline, black C. Inline SVG so
 * it costs no request on any surface, and its colours are fixed rather than
 * themed because the mark is the one thing that should look the same
 * everywhere. The same paths are in scripts/brand.mjs, which generates the
 * favicon and icons from them — change both together.
 */
export const Monogram: FC<{ size?: number }> = ({ size = 28 }) => (
  <svg
    class="monogram"
    width={size}
    height={size}
    viewBox="0 0 64 64"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="#FFD43B"
      stroke="#111111"
      stroke-width="4"
      stroke-linejoin="round"
      d="M16 4h32a12 12 0 0 1 12 12v10a6 6 0 0 0 0 12v10a12 12 0 0 1-12 12H16A12 12 0 0 1 4 48V38a6 6 0 0 0 0-12V16A12 12 0 0 1 16 4z"
    />
    <path
      fill="none"
      stroke="#111111"
      stroke-width="8"
      stroke-linecap="round"
      d="M40.7 22.3A13 13 0 1 0 40.7 41.7"
    />
  </svg>
);

/**
 * Browser and home-screen icons, for every document's <head>. The files are
 * generated from the mark by scripts/brand.mjs.
 */
export const BrandIcons: FC = () => (
  <>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  </>
);

/** Mark plus name. The name is real text, so it reads aloud as "coverr". */
export const Wordmark: FC<{ size?: number }> = ({ size }) => (
  <span class="wordmark">
    <Monogram size={size} />
    <span>coverr</span>
  </span>
);
