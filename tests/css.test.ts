import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "../src/lib/css";

/**
 * Stylesheets ship inlined in every page without their comments, which were
 * written for whoever edits them (security review S10).
 */

const STYLES = "src/styles";
const sheets = readdirSync(STYLES)
  .filter((name) => name.endsWith(".css"))
  .map((name) => ({ name, css: readFileSync(join(STYLES, name), "utf8") }));

describe("withoutComments", () => {
  it("drops one-line and multi-line comments and the blank lines they leave", () => {
    const css =
      "/* tokens */\n:root {\n  --ink: #111; /* measured 15.9:1 */\n}\n\n/*\n  why\n*/\nh1 {\n  margin: 0;\n}\n";
    expect(withoutComments(css)).toBe(":root {\n  --ink: #111; \n}\nh1 {\n  margin: 0;\n}");
  });

  it("keeps every rule of every stylesheet", () => {
    for (const { name, css } of sheets) {
      const stripped = withoutComments(css);
      expect(stripped, name).not.toContain("/*");
      expect(stripped, name).not.toContain("*/");
      const opens = (text: string) => text.split("{").length - 1;
      const comments = css.match(/\/\*[\s\S]*?\*\//g) ?? [];
      const bracesInComments = comments.reduce((sum, comment) => sum + opens(comment), 0);
      expect(opens(stripped), name).toBe(opens(css) - bracesInComments);
    }
  });

  // The pattern is only safe while no sheet opens a comment inside a string or
  // a url(). If one ever does, this fails rather than the page shipping broken.
  it("is safe on every stylesheet: no comment opens inside a string or a url()", () => {
    for (const { name, css } of sheets) {
      for (const line of css.split("\n")) {
        const at = line.indexOf("/*");
        if (at < 0) continue;
        const before = line.slice(0, at);
        expect((before.match(/"/g) ?? []).length % 2, `${name}: ${line.trim()}`).toBe(0);
        expect((before.match(/'/g) ?? []).length % 2, `${name}: ${line.trim()}`).toBe(0);
        expect(before, `${name}: ${line.trim()}`).not.toMatch(/url\([^)]*$/);
      }
    }
  });
});
