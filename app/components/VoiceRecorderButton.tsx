"use client";
import { useRef, useState } from "react";

// Max recording length -- long enough for a real explanation, short enough
// to stay well under the 10MB upload cap and not turn into a rambling essay.
const MAX_SECONDS = 120;

export default function VoiceRecorderButton({
  onRecorded,
  disabled,
  recordingAria,
  stopAria,
}: {
  onRecorded: (blob: Blob, mimeType: string) => void;
  disabled?: boolean;
  recordingAria: string;
  stopAria: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setUnsupported(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length > 0) {
          onRecorded(new Blob(chunksRef.current, { type: mimeType }), mimeType);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stop();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setUnsupported(true);
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  if (unsupported) return null; // silently degrade -- typing still works

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={disabled}
      aria-label={recording ? stopAria : recordingAria}
      style={{
        padding: "10px 14px",
        background: recording ? "var(--gold)" : undefined,
        color: recording ? "#1a1400" : undefined,
        minWidth: recording ? 56 : undefined,
      }}
    >
      {recording ? `⏹ ${seconds}s` : "🎤"}
    </button>
  );
}
