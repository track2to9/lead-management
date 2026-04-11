import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractText } from "./text-extractor";

const FIXTURE_DIR = path.resolve(__dirname, "__fixtures__");

describe("extractText", () => {
  it("extracts text from a simple single-page PDF", async () => {
    const buf = await readFile(path.join(FIXTURE_DIR, "simple-quotation.pdf"));
    const snapshot = await extractText(new Uint8Array(buf));

    expect(snapshot.pages).toHaveLength(1);
    expect(snapshot.pages[0].page_number).toBe(1);
    expect(snapshot.pages[0].text).toContain("SPS-2024-0312");
    expect(snapshot.pages[0].text).toContain("ACME GmbH");
    expect(snapshot.pages[0].text).toContain("2024-03-12");
    expect(typeof snapshot.extracted_at).toBe("string");
    expect(snapshot.pages[0].tables).toEqual([]);
  });

  it("throws when PDF bytes are empty", async () => {
    await expect(extractText(new Uint8Array(0))).rejects.toThrow();
  });
});
