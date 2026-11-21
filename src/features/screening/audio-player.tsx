import { useEffect, useState } from "react";
import { getAudio } from "./media";
export function AudioPlayer({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    getAudio(id)
      .then((blob) => {
        if (!alive) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setMissing(true);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return missing ? (
    <p role="alert">Brak nagrania w tej przeglądarce. Zaimportuj pełną paczkę ZIP z nagraniami.</p>
  ) : url ? (
    <audio controls src={url} aria-label="Nagranie odpowiedzi" preload="metadata" />
  ) : (
    <p>Wczytywanie nagrania…</p>
  );
}
