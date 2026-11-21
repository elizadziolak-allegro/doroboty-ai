import JSZip from "jszip";
import { z } from "zod";
import type { State } from "../prototype/model";
import { parseState, serializeState } from "../prototype/storage";
import { getAudio, putAudio } from "./media";
import { MAX_AUDIO_BYTES } from "./schema";
import { validateStoredZip } from "./zip-boundary";

export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const manifestSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      mime: z.enum(["audio/webm", "audio/webm;codecs=opus", "audio/mp4"]),
    }),
  )
  .max(2000);
export function audioIds(state: State) {
  return [
    ...new Set(
      [...state.applications, ...state.drafts].flatMap(
        (item) => item.screening?.answers.flatMap((a) => (a.audioId ? [a.audioId] : [])) || [],
      ),
    ),
  ];
}
export async function exportArchive(state: State): Promise<Blob> {
  const zip = new JSZip();
  zip.file("scenario.json", serializeState(state));
  const manifest: z.infer<typeof manifestSchema> = [];
  let total = new TextEncoder().encode(serializeState(state)).length;
  for (const id of audioIds(state)) {
    const audio = await getAudio(id);
    if (!audio)
      throw new Error(
        "Brakuje nagrania. Eksport przerwany; dotychczasowe dane pozostają bez zmian.",
      );
    total += audio.size;
    if (total > MAX_ARCHIVE_BYTES - 100000)
      throw new Error("Scenariusz przekracza limit paczki 64 MB.");
    manifest.push(manifestSchema.element.parse({ id, mime: audio.type }));
    zip.file(`audio/${id}`, await audio.arrayBuffer());
  }
  zip.file("audio.json", JSON.stringify(manifest));
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
export type PreparedImport = { raw: string; media: { id: string; blob: Blob }[] };
export async function prepareArchive(bytes: ArrayBuffer): Promise<PreparedImport> {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("Paczka przekracza 64 MB.");
  const names = validateStoredZip(bytes);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false });
  const scenario = zip.file("scenario.json");
  const manifestFile = zip.file("audio.json");
  if (!scenario || !manifestFile) throw new Error("Nieprawidłowa paczka scenariusza.");
  // JSZip has no bounded inflater. Reject compressed/untrusted members before extraction.
  for (const file of Object.values(zip.files)) {
    const meta = file as unknown as {
      _data?: {
        uncompressedSize?: number;
        compressedSize?: number;
        compression?: { magic?: string };
      };
    };
    if (
      !file.dir &&
      (meta._data?.uncompressedSize === undefined ||
        meta._data.uncompressedSize !== meta._data.compressedSize ||
        meta._data.compression?.magic !== "\x00\x00" ||
        meta._data.uncompressedSize > MAX_ARCHIVE_BYTES)
    )
      throw new Error(
        "Obsługiwane są wyłącznie nieskompresowane paczki wyeksportowane przez prototyp.",
      );
  }
  const raw = await scenario.async("string");
  const state = parseState(raw);
  const manifest = manifestSchema.parse(JSON.parse(await manifestFile.async("string")));
  const ids = audioIds(state);
  const allowed = new Set([
    "scenario.json",
    "audio.json",
    "audio/",
    ...ids.map((id) => `audio/${id}`),
  ]);
  if ([...names].some((name) => !allowed.has(name)))
    throw new Error("Paczka zawiera nieoczekiwane pliki.");
  if (
    manifest.length !== ids.length ||
    new Set(manifest.map((m) => m.id)).size !== ids.length ||
    manifest.some((m) => !ids.includes(m.id))
  )
    throw new Error("Nagrania nie odpowiadają scenariuszowi.");
  const media = [];
  for (const item of manifest) {
    const file = zip.file(`audio/${item.id}`);
    if (!file) throw new Error("Brak nagrania w paczce.");
    const data = await file.async("uint8array");
    if (!data.length || data.length > MAX_AUDIO_BYTES)
      throw new Error("Nieprawidłowy rozmiar nagrania.");
    media.push({
      id: item.id,
      blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: item.mime }),
    });
  }
  return { raw, media };
}
export async function stageImportedMedia(prepared: PreparedImport): Promise<string> {
  const state = parseState(prepared.raw);
  const remap = new Map<string, string>();
  // New IDs keep the current scenario's recordings intact if any write fails.
  for (const item of prepared.media) {
    const id = crypto.randomUUID();
    await putAudio(id, item.blob);
    remap.set(item.id, id);
  }
  for (const item of [...state.applications, ...state.drafts]) {
    for (const answer of item.screening?.answers || []) {
      if (answer.audioId && remap.has(answer.audioId)) answer.audioId = remap.get(answer.audioId);
    }
  }
  return serializeState(state);
}
