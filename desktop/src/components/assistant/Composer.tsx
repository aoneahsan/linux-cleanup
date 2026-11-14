import { useRef, useState } from 'react';
import { Form } from 'react-aria-components';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormTextField } from '@/components/form/FormTextField';
import { Btn } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { ASSISTANT_LIMITS, transcribeQuestion, type TranscribeResult } from '@/services/assistant';
import { useRecorder, type Recording } from '@/hooks/useRecorder';
import { openPrivacySettings } from '@/lib/open';
import { toast } from '@/lib/feedback';

const BARS = 7;
const SHAPE = [0.55, 0.85, 0.7, 1, 0.65, 0.9, 0.6];

interface Props {
  busy: boolean;
  onAsk: (question: string) => void;
  /** The month is used up, or the assistant is resting: the page swaps in its state card. */
  onRefused: (reason: 'limit_reached' | 'paused') => void;
}

const questionSchema = z.object({ question: z.string().max(ASSISTANT_LIMITS.questionChars) });
const heardSchema = z.object({ heard: z.string().max(ASSISTANT_LIMITS.questionChars) });

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Type a question, or Speak: listening → transcribing → confirm (send, edit or discard). */
export function Composer({ busy, onAsk, onRefused }: Props) {
  const t = useT();
  const ask = useForm<z.infer<typeof questionSchema>>({ resolver: zodResolver(questionSchema), defaultValues: { question: '' } });
  // The spoken question waits here for the person to check it; `confirming` shows the step.
  const confirm = useForm<z.infer<typeof heardSchema>>({ resolver: zodResolver(heardSchema), defaultValues: { heard: '' } });
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const bars = useRef<HTMLSpanElement>(null);
  const q = useWatch({ control: ask.control, name: 'question' });
  const heard = useWatch({ control: confirm.control, name: 'heard' });

  const transcribe = useMutation({
    mutationFn: (r: Recording) => transcribeQuestion(r.blob, r.durationMs),
    onSuccess: (res: TranscribeResult) => {
      if (!res.ok) { onRefused(res.reason); return; }
      const text = res.transcript.trim().slice(0, ASSISTANT_LIMITS.questionChars);
      if (!text) { setNote(translate('assistant.voice.noWords')); return; }
      confirm.reset({ heard: text });
      setConfirming(true);
    },
    onError: () => setNote(translate('assistant.voice.failed')),
  });

  const rec = useRecorder({
    onDone: (r) => {
      if (!r) { setNote(translate('assistant.voice.failed')); return; }
      transcribe.mutate(r);
    },
    onLevel: (level) => {
      const el = bars.current;
      // Reduced motion: the meter rests (the clock and "Listening…" still say it is on).
      if (!el || getComputedStyle(document.documentElement).getPropertyValue('--dur').trim() === '0ms') return;
      el.querySelectorAll('i').forEach((b, k) => { b.style.transform = `scaleY(${(0.2 + level * 0.8 * (SHAPE[k] ?? 1)).toFixed(2)})`; });
    },
  });

  const listening = rec.state === 'listening' || rec.state === 'starting';
  const voice = listening ? 'listening' : transcribe.isPending ? 'transcribing' : confirming ? 'confirm' : 'idle';
  const live = { idle: '', listening: t('assistant.voice.liveListening'), transcribing: t('assistant.voice.liveTranscribing'), confirm: t('assistant.voice.liveConfirm') }[voice];
  const text = q.trim();

  /** An empty question stays a silent no-op (Send is disabled then); the schema owns the length cap. */
  const send = (question: string) => {
    const v = question.trim();
    if (!v || busy) return;
    onAsk(v);
    ask.reset({ question: '' });
  };
  const closeConfirm = () => { setConfirming(false); confirm.reset({ heard: '' }); };

  return (
    <div data-tour={t('assistant.composeTour')}>
      {voice !== 'idle' ? (
        <div className="voice">
          {voice === 'listening' ? (
            <div className="voice-row">
              <span className="level-meter live" aria-hidden="true" ref={bars}>{Array.from({ length: BARS }, (_, k) => <i key={k} />)}</span>
              <span><b>{t('assistant.voice.listening')}</b>{t('assistant.voice.listeningRest')}</span>
              <span className="mono">{clock(rec.elapsed)}</span>
              <Btn variant="stop" icon="stop" autoFocus onPress={rec.stop}>{t('assistant.voice.stop')}</Btn>
            </div>
          ) : voice === 'transcribing' ? (
            <div className="voice-row">
              <span><b>{t('assistant.voice.transcribing')}</b></span>
              <div className="progress voice-progress" aria-hidden="true"><i className="indeterminate" /></div>
            </div>
          ) : (
            <Form className="voice-confirm" validationBehavior="aria" onSubmit={confirm.handleSubmit((v) => { closeConfirm(); send(v.heard); })}>
              <div>
                <b>{t('assistant.voice.confirm')}</b>
                <FormTextField control={confirm.control} name="heard" ariaLabel={t('assistant.voice.confirm')} className="react-aria-TextField" maxLength={ASSISTANT_LIMITS.questionChars} autoFocus />
              </div>
              <div className="row-actions">
                <Btn type="submit" variant="run" tag={t('assistant.sendTag')} isDisabled={busy || !heard.trim()}>{t('assistant.send')}</Btn>
                <Btn onPress={() => confirm.setFocus('heard', { shouldSelect: true })}>{t('assistant.voice.edit')}</Btn>
                <Btn onPress={() => { closeConfirm(); document.getElementById('as-speak')?.focus(); toast(translate('assistant.voice.discarded')); }}>{t('assistant.voice.discard')}</Btn>
              </div>
            </Form>
          )}
        </div>
      ) : null}
      <span className="sr-only" role="status">{live}</span>
      {rec.state === 'denied' ? (
        <div className="callout warn mb-4" role="alert">
          <b>{t('assistant.voice.deniedTitle')}</b> {t('assistant.voice.deniedBody')}{' '}
          <Btn onPress={() => void openPrivacySettings('microphone')}>{t('assistant.voice.openSettings')}</Btn>
        </div>
      ) : null}
      {rec.state === 'unsupported' ? <p className="callout mb-4">{t('assistant.voice.unsupported')}</p> : null}
      {note ? <p className="callout mb-4" role="status">{note}</p> : null}
      <Form className="composer" validationBehavior="aria" onSubmit={ask.handleSubmit((v) => send(v.question))}>
        <FormTextField control={ask.control} name="question" className="composer-field" ariaLabel={t('assistant.question')}
          placeholder={t('assistant.placeholder')} autoComplete="off" maxLength={ASSISTANT_LIMITS.questionChars} isDisabled={voice !== 'idle'} />
        <Btn id="as-speak" icon="mic" aria-pressed={listening}
          isDisabled={rec.state === 'unsupported' || voice === 'transcribing' || voice === 'confirm' || busy}
          onPress={() => { setNote(null); if (listening) rec.stop(); else { rec.reset(); void rec.start(); } }}>
          {t('assistant.speak')}
        </Btn>
        <Btn type="submit" variant="run" tag={t('assistant.sendTag')} isDisabled={!text || busy || voice !== 'idle'}>{t('assistant.send')}</Btn>
      </Form>
      <p className="lede mt-2"><kbd className="kbd">{t('assistant.hintKey')}</kbd>{t('assistant.hint')}</p>
    </div>
  );
}
