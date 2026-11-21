import { MAX_AUDIO_BYTES } from "./schema";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("doroboty.screening.audio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("audio");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Nie można otworzyć zapisu nagrań. Wybierz tekst."));
  });
}
async function operation<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("audio", mode);
      const request = fn(tx.objectStore("audio"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () =>
        reject(new Error("Nie udało się zapisać nagrania. Zachowaj odpowiedź jako tekst."));
    });
  } finally {
    db.close();
  }
}
export const getAudio = (id: string): Promise<Blob | undefined> =>
  operation("readonly", (s) => s.get(id));
export async function putAudio(id: string, blob: Blob) {
  if (!blob.size || blob.size > MAX_AUDIO_BYTES)
    throw new Error("Nagranie musi mieć od 1 bajta do 10 MB.");
  await operation("readwrite", (s) => s.put(blob, id));
}
export const clearAudio = () => operation("readwrite", (s) => s.clear());
export async function requireAudio(ids: string[]) {
  for (const id of ids)
    if (!(await getAudio(id)))
      throw new Error("Brakuje zapisanego nagrania. Nagraj odpowiedź ponownie lub wybierz tekst.");
}
export async function blobBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Nie udało się odczytać nagrania."));
    reader.readAsDataURL(blob);
  });
}
