import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { screeningFixture } from "../../../tests/screening-fixture";
import { initialState, transition } from "../prototype/model";
import { parseState, serializeState } from "../prototype/storage";
import { validateApproved, validateComplete, validateSummary } from "./schema";
import { clearAudio, putAudio, getAudio, requireAudio } from "./media";
import { exportArchive, prepareArchive, stageImportedMedia } from "./archive";
import JSZip from "jszip";

beforeEach(async () => {
  await clearAudio();
});
it("accepts old state and keeps optional screening absent", () => {
  expect(parseState(serializeState(initialState())).applications[0].screening).toBeUndefined();
});
it("requires complete, approved, evidence-linked responses", () => {
  const value = screeningFixture();
  expect(() => validateApproved(value)).not.toThrow();
  expect(() => validateApproved({ ...value, approved: false })).toThrow();
  value.answers[0].text = "";
  expect(() => validateComplete(value)).toThrow();
  value.answers[0].text = "Inna odpowiedź";
  expect(() => validateSummary(value, value.summary!)).toThrow();
});
it("preserves immutable screening snapshot and stage across persona/profile changes", () => {
  let state = initialState();
  state = transition(state, { type: "select_person", id: "candidate-anna" });
  const value = screeningFixture();
  state = transition(
    state,
    {
      type: "submit",
      jobId: state.jobs[0].id,
      notes: "",
      generated: "",
      answer: "Przykładowa odpowiedź do aplikacji.",
      consent: true,
      screening: value,
    },
    undefined,
    "new-application",
  );
  value.answers[0].text = "Mutated";
  expect(state.applications.at(-1)?.screening?.answers[0].text).toContain("Prowadziłam");
  expect(state.applications.at(-1)?.stage).toBe("submitted");
  state = transition(state, {
    type: "profile",
    value: { name: "Nowe imię", headline: "Nowa rola", bio: "", location: "Polska" },
  });
  expect(state.applications.at(-1)?.screening?.context.cv).toContain("Przykładowe CV");
  expect(() =>
    transition(initialState(), {
      type: "stage",
      applicationId: "application-example",
      stage: "reviewed",
      note: "",
    }),
  ).toThrow();
});
it("blocks submitting unapproved screening and malformed imports", () => {
  const state = transition(initialState(), { type: "select_person", id: "candidate-anna" });
  expect(() =>
    transition(state, {
      type: "submit",
      jobId: state.jobs[0].id,
      notes: "",
      generated: "",
      answer: "Przykładowa odpowiedź do aplikacji.",
      consent: true,
      screening: { ...screeningFixture(), approved: false },
    }),
  ).toThrow();
  state.applications[0].screening = { ...screeningFixture(), approved: false };
  expect(() => parseState(serializeState(state))).toThrow();
});
it("roundtrips binary recordings in an archive and remaps IDs without overwriting existing media", async () => {
  const id = crypto.randomUUID();
  const blob = new Blob(["test recording"], { type: "audio/webm" });
  await putAudio(id, blob);
  const state = initialState();
  const screening = screeningFixture();
  screening.answers[0] = {
    ...screening.answers[0],
    mode: "voice",
    audioId: id,
    originalTranscript: "Prowadziłam badania użytkowników.",
  };
  state.applications[0].screening = screening;
  const zip = await exportArchive(state);
  const prepared = await prepareArchive(await zip.arrayBuffer());
  const imported = parseState(await stageImportedMedia(prepared));
  const newId = imported.applications[0].screening!.answers[0].audioId!;
  expect(newId).not.toBe(id);
  expect(await (await getAudio(newId))?.text()).toBe("test recording");
  expect(await (await getAudio(id))?.text()).toBe("test recording");
  await clearAudio();
  await expect(requireAudio([newId])).rejects.toThrow();
  await expect(exportArchive(state)).rejects.toThrow();
});
it("rejects incomplete archives and oversized recordings", async () => {
  const zip = new JSZip();
  zip.file("scenario.json", serializeState(initialState()));
  await expect(prepareArchive(await zip.generateAsync({ type: "arraybuffer" }))).rejects.toThrow();
  await expect(
    putAudio(crypto.randomUUID(), new Blob([new Uint8Array(10 * 1024 * 1024 + 1)])),
  ).rejects.toThrow();
});

it("rejects compressed, extra, path-traversal and forged-size archive members", async () => {
  const make = () => {
    const zip = new JSZip();
    zip.file("scenario.json", serializeState(initialState()));
    zip.file("audio.json", "[]");
    return zip;
  };
  await expect(
    prepareArchive(await make().generateAsync({ type: "arraybuffer", compression: "DEFLATE" })),
  ).rejects.toThrow();
  for (const name of [
    "../scenario.json",
    "extra.html",
    "audio/11111111-1111-4111-8111-111111111111",
  ]) {
    const zip = make();
    zip.file(name, "unexpected");
    await expect(
      prepareArchive(await zip.generateAsync({ type: "arraybuffer", compression: "STORE" })),
    ).rejects.toThrow();
  }
  const raw = await make().generateAsync({ type: "arraybuffer", compression: "STORE" });
  const view = new DataView(raw);
  for (let at = 0; at < raw.byteLength - 46; at++) {
    if (view.getUint32(at, true) === 0x02014b50) {
      view.setUint32(at + 24, 0xffffffff, true);
      break;
    }
  }
  await expect(prepareArchive(raw)).rejects.toThrow();
});

it("rejects corrupt stored bytes instead of restoring them", async () => {
  const zip = new JSZip();
  zip.file("scenario.json", serializeState(initialState()));
  zip.file("audio.json", "[]");
  const raw = await zip.generateAsync({ type: "arraybuffer", compression: "STORE" });
  const view = new DataView(raw);
  const firstByte = 30 + view.getUint16(26, true) + view.getUint16(28, true);
  new Uint8Array(raw)[firstByte] ^= 1;
  await expect(prepareArchive(raw)).rejects.toThrow();
});
