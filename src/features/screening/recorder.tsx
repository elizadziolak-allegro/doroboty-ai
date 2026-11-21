import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from "./schema";
import { blobBase64, putAudio } from "./media";
import { screeningRequest } from "./api";

export function Recorder({
  onSaved,
  onBusy,
  disabled,
}: {
  disabled?: boolean;
  onSaved: (audioId: string, transcript: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Blob | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const waiting = useRef(false);
  function release() {
    stream.current?.getTracks().forEach((track) => track.stop());
    if (timer.current) clearInterval(timer.current);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    };
  }, []);
  async function transcribe(blob: Blob) {
    setProcessing(true);
    onBusy(true);
    setError("");
    try {
      const id = crypto.randomUUID();
      await putAudio(id, blob);
      const { text } = await screeningRequest(
        "transcribe",
        { mime: blob.type.split(";")[0], base64: await blobBase64(blob) },
        z.object({ text: z.string().trim().min(1).max(12000) }),
      );
      if (mounted.current) {
        onSaved(id, text);
        setPending(null);
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) {
        setProcessing(false);
        onBusy(false);
      }
    }
  }
  async function start() {
    if (waiting.current) return;
    waiting.current = true;
    onBusy(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("Ta przeglądarka nie obsługuje nagrywania. Wybierz tekst.");
      const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime) throw new Error("Brak obsługi formatu nagrania. Wybierz tekst.");
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        input.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = input;
      const media = new MediaRecorder(input, { mimeType: mime, audioBitsPerSecond: 64000 });
      recorder.current = media;
      const chunks: Blob[] = [];
      let size = 0;
      let tooLarge = false;
      media.ondataavailable = (event) => {
        chunks.push(event.data);
        size += event.data.size;
        if (size > MAX_AUDIO_BYTES && media.state === "recording") {
          tooLarge = true;
          media.stop();
        }
      };
      media.onerror = () => {
        release();
        setRecording(false);
        onBusy(false);
        setError("Nagrywanie przerwane. Wybierz tekst lub spróbuj ponownie.");
      };
      media.onstop = () => {
        release();
        if (!mounted.current) return;
        setRecording(false);
        onBusy(false);
        const blob = new Blob(chunks, { type: mime });
        if (tooLarge || blob.size > MAX_AUDIO_BYTES || blob.size === 0) {
          setError("Puste lub za duże nagranie. Limit: 10 MB.");
          return;
        }
        setPending(blob);
        void transcribe(blob);
      };
      setSeconds(0);
      setPending(null);
      media.start(500);
      setRecording(true);
      const began = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - began) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_AUDIO_SECONDS && media.state === "recording") media.stop();
      }, 250);
    } catch (e) {
      release();
      onBusy(false);
      if (mounted.current)
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Brak zgody na mikrofon. Zezwól na nagrywanie lub wybierz tekst."
            : (e as Error).message,
        );
    } finally {
      waiting.current = false;
    }
  }
  return (
    <div className="screening-recorder">
      <div className="screening-actions">
        {recording ? (
          <Button type="button" variant="outline" onClick={() => recorder.current?.stop()}>
            Zatrzymaj nagranie
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={processing || disabled}
            onClick={() => void start()}
          >
            Nagraj odpowiedź
          </Button>
        )}
        {pending && !processing && (
          <Button type="button" variant="outline" onClick={() => void transcribe(pending)}>
            Ponów transkrypcję
          </Button>
        )}
      </div>
      <p role="status">
        {recording
          ? `Nagrywanie: ${seconds} / 180 s`
          : processing
            ? "Zapisywanie i transkrypcja…"
            : "Maksymalnie 3 minuty i 10 MB. Możesz nagrać odpowiedź ponownie."}
      </p>
      {pending && <PendingAudio blob={pending} />}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </div>
  );
}
function PendingAudio({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return <audio controls src={url} aria-label="Odsłuchaj nowe nagranie" />;
}
