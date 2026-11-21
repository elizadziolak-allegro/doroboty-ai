// Validate the raw ZIP directory and local headers before JSZip reads any members.
// Only the bounded, uncompressed format emitted by exportArchive is accepted.
export function validateStoredZip(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  const data = new Uint8Array(bytes);
  const fail = () => {
    throw new Error("Nieprawidłowa lub nieobsługiwana paczka ZIP.");
  };
  const u16 = (at: number) => (at + 2 <= bytes.byteLength ? view.getUint16(at, true) : fail());
  const u32 = (at: number) => (at + 4 <= bytes.byteLength ? view.getUint32(at, true) : fail());
  let end = -1;
  for (let at = bytes.byteLength - 22; at >= Math.max(0, bytes.byteLength - 65557); at--) {
    if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.byteLength) {
      end = at;
      break;
    }
  }
  if (end < 0 || u16(end + 4) || u16(end + 6)) fail();
  const count = u16(end + 10);
  const start = u32(end + 16);
  if (count < 2 || count > 2003 || count !== u16(end + 8) || start + u32(end + 12) !== end) fail();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const names = new Set<string>();
  const intervals: [number, number][] = [];
  let at = start;
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || u32(at) !== 0x02014b50) fail();
    const flags = u16(at + 8),
      method = u16(at + 10),
      size = u32(at + 24);
    const nameLength = u16(at + 28),
      extra = u16(at + 30),
      comment = u16(at + 32);
    const next = at + 46 + nameLength + extra + comment;
    if (next > end || flags & ~0x800 || method !== 0 || size !== u32(at + 20) || u16(at + 34))
      fail();
    const name = decoder.decode(data.subarray(at + 46, at + 46 + nameLength));
    if (names.has(name)) fail();
    names.add(name);
    const limit =
      name === "scenario.json"
        ? 2_000_000
        : name === "audio.json"
          ? 200_000
          : name === "audio/"
            ? 0
            : /^audio\/[a-f0-9-]{36}$/i.test(name)
              ? 10 * 1024 * 1024
              : -1;
    if (size > limit || (name === "audio/" && size !== 0)) fail();
    total += size;
    if (total > 64 * 1024 * 1024) fail();
    const local = u32(at + 42);
    if (
      local + 30 > start ||
      u32(local) !== 0x04034b50 ||
      u16(local + 6) !== flags ||
      u16(local + 8) !== method ||
      u32(local + 14) !== u32(at + 16) ||
      u32(local + 18) !== size ||
      u32(local + 22) !== size
    )
      fail();
    const localNameLength = u16(local + 26),
      localExtra = u16(local + 28);
    const bodyStart = local + 30 + localNameLength + localExtra;
    const bodyEnd = bodyStart + size;
    if (
      bodyEnd > start ||
      decoder.decode(data.subarray(local + 30, local + 30 + localNameLength)) !== name
    )
      fail();
    intervals.push([local, bodyEnd]);
    at = next;
  }
  if (at !== end) fail();
  intervals.sort((a, b) => a[0] - b[0]);
  if (intervals[0][0] !== 0 || intervals.at(-1)![1] !== start) fail();
  for (let i = 1; i < intervals.length; i++) if (intervals[i - 1][1] !== intervals[i][0]) fail();
  return names;
}
