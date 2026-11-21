import { expect, it } from "vitest";
import { safeWebsiteUrl } from "./safe-url";
it("allows ordinary company sites but blocks executable, relative, credential and obfuscated URLs", () => {
  expect(safeWebsiteUrl("https://example.test/about?a=1")).toBe("https://example.test/about?a=1");
  expect(safeWebsiteUrl("http://example.test")).toBe("http://example.test/");
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "//example.test",
    "/local",
    "https://user:secret@example.test",
    "https://",
    "https://exam\nple.test",
    "https:\\evil.test",
  ]) {
    expect(safeWebsiteUrl(value)).toBeNull();
  }
});
