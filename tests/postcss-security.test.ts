import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const rootRequire = createRequire(import.meta.url);
const nextRequire = createRequire(rootRequire.resolve("next/package.json"));

test("Next resolves a PostCSS version outside the published sourceMappingURL vulnerable range", () => {
  const version: string = nextRequire("postcss/package.json").version;
  const [major, minor, patch] = version.split(".").map(Number);
  assert.ok(major > 8 || (major === 8 && (minor > 5 || (minor === 5 && patch >= 23))), `Next resolves vulnerable PostCSS ${version}`);
});

test("an untrusted CSS map annotation without from cannot disclose an absolute local map", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oakhaven-css-map-"));
  const mapFile = path.join(directory, "private.map");
  const marker = "SYNTHETIC_MAP_CONTENT_MUST_NOT_LEAK";
  fs.writeFileSync(mapFile, JSON.stringify({ version: 3, sources: ["fixture.ts"], sourcesContent: [marker], names: [], mappings: "AAAA" }));
  try {
    const postcss = nextRequire("postcss") as typeof import("postcss").default;
    let output = "";
    try {
      const result = await postcss([]).process(`a { color: red }\n/*# sourceMappingURL=${mapFile.replaceAll("\\", "/")} */`, { map: { inline: false, annotation: false } });
      output = result.css + (result.map?.toString() ?? "");
    } catch (error) {
      assert.match(String(error), /map|source|file|path/i);
    }
    assert.equal(output.includes(marker), false);
  } finally {
    assert.equal(path.dirname(path.resolve(mapFile)), path.resolve(directory));
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    fs.unlinkSync(mapFile);
    fs.rmdirSync(directory);
  }
});
