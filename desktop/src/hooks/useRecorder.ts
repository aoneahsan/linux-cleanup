/**
 * Speak: record up to 30 s with MediaRecorder and report a live input level. The
 * microphone opens only on the person's press and closes the moment recording
 * stops. Nothing is kept: the blob goes to the caller once and is dropped.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ASSISTANT_LIMITS } from '@/services/assistant';
import { logger } from '@/lib/logger';

export type RecorderState = 'idle' | 'starting' | 'listening' | 'denied' | 'unsupported' | 'failed';

/** Audio types the transcribe route accepts (CONTRACTS "Assistant"). */
const ACCEPTED = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/aac'];

const supported = (): boolean => typeof window !== 'undefined' && typeof window.MediaRecorder === 'function' && Boolean(navigator.mediaDevices?.getUserMedia);

export interface Recording {
  blob: Blob;
  durationMs: number;
}

/**
 * `start()` asks for the microphone and records; `stop()` resolves the recording.
 * `onLevel` receives 0–1 about 30 times a second while listening (for the meter).
 */
export function useRecorder({ onDone, onLevel }: { onDone: (r: Recording | null) => void; onLevel: (level: number) => void }) {
  const [state, setState] = useState<RecorderState>(() => (supported() ? 'idle' : 'unsupported'));
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const timer = useRef(0);
  const started = useRef(0);
  const done = useRef(onDone);
  const level = useRef(onLevel);
  useEffect(() => {
    done.current = onDone;
    level.current = onLevel;
  });

  const release = useCallback(() => {
    window.cancelAnimationFrame(frame.current);
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    void audio.current?.close().catch(() => undefined);
    audio.current = null;
  }, []);

  useEffect(() => () => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    release();
  }, [release]);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!supported()) { setState('unsupported'); return; }
    setState('starting');
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed');
      logger.warn('microphone unavailable', name || 'unknown');
      return;
    }
    stream.current = media;
    const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(media, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const durationMs = Math.min(ASSISTANT_LIMITS.recordingMs, Date.now() - started.current);
      const base = (recorder.mimeType || type || '').split(';')[0] ?? '';
      release();
      setState('idle');
      setElapsed(0);
      rec.current = null;
      const blob = new Blob(chunks, { type: base });
      done.current(ACCEPTED.includes(base) && blob.size > 0 && blob.size <= ASSISTANT_LIMITS.recordingBytes ? { blob, durationMs } : null);
    };
    rec.current = recorder;

    // The live level: RMS of the input, read once a frame.
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(media).connect(analyser);
      audio.current = ctx;
      const buf = new Uint8Array(analyser.fftSize);
      const read = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        level.current(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        frame.current = window.requestAnimationFrame(read);
      };
      read();
    } catch {
      /* no analyser: the meter rests; recording still works */
    }

    started.current = Date.now();
    recorder.start(250);
    setState('listening');
    setElapsed(0);
    timer.current = window.setInterval(() => {
      const ms = Date.now() - started.current;
      setElapsed(Math.floor(ms / 1000));
      if (ms >= ASSISTANT_LIMITS.recordingMs) recorder.stop();
    }, 250);
  }, [release]);

  const reset = useCallback(() => setState(supported() ? 'idle' : 'unsupported'), []);

  return { state, elapsed, start, stop, reset };
}
