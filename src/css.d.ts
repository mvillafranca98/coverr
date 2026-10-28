/**
 * A stylesheet import is its text. Wrangler's Text module rule (wrangler.jsonc)
 * bundles each src/styles/*.css file as a string, which a layout inlines into
 * a <style> tag.
 */
declare module "*.css" {
  const css: string;
  export default css;
}
