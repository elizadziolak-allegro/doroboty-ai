export function safeWebsiteUrl(value: string): string | null {
  if (
    !/^https?:\/\//i.test(value) ||
    [...value].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127 || c === "\\")
  )
    return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      url.hostname &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
