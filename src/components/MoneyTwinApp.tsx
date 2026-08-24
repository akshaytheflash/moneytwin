'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import ProfileStage from './ProfileStage';
import TwinStage from './TwinStage';
import LabStage from './LabStage';
import Tour from './Tour';
import type { LabStatus } from './LabStage';
import { TOUR_STEPS } from '@/lib/tourSteps';
import type { FinancialTwin } from '@/lib/engine/types';

type Stage = 'profile' | 'twin' | 'lab';

const STEPS: { id: Stage; label: string }[] = [
  { id: 'profile', label: '1 · Profile' },
  { id: 'twin', label: '2 · Financial twin' },
  { id: 'lab', label: '3 · Stress lab' },
];

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect x="1.5" y="6" width="15" height="15" rx="3" fill="none" stroke="#101b17" strokeWidth="2.4" />
        <rect x="9.5" y="4" width="15" height="15" rx="3" fill="#0f5852" stroke="#101b17" strokeWidth="2.4" />
        <line x1="13" y1="8" x2="13" y2="15" stroke="#f2faf7" strokeWidth="1.8" />
        <line x1="16.5" y1="8" x2="21" y2="8" stroke="#f2faf7" strokeWidth="1.8" />
      </svg>
      <span className="display text-xl tracking-wide">Moneytwin</span>
    </span>
  );
}

export default function MoneyTwinApp() {
  const [stage, setStage] = useState<Stage>('profile');
  const [twin, setTwin] = useState<FinancialTwin | null>(null);
  const [tourIdx, setTourIdx] = useState<number | null>(null);
  const [labStatus, setLabStatus] = useState<LabStatus>({
    shockCount: 0,
    hasSim: false,
    busy: false,
    optBusy: false,
    hasOpt: false,
  });

  const tourActive = tourIdx !== null;
  const step = tourIdx !== null ? TOUR_STEPS[tourIdx] : null;

  const handleLabStatus = useCallback((s: LabStatus) => {
    setLabStatus((prev) =>
      prev.shockCount === s.shockCount &&
      prev.hasSim === s.hasSim &&
      prev.busy === s.busy &&
      prev.optBusy === s.optBusy &&
      prev.hasOpt === s.hasOpt
        ? prev
        : s,
    );
  }, []);

  function startTour() {
    setTourIdx(0);
  }

  function endTour() {
    setTourIdx(null);
  }

  function goTo(idx: number) {
    setTourIdx(idx);
    const st = TOUR_STEPS[idx];
    setStage(twin ? st.stage : 'profile');
  }

  const stageIndex = STEPS.findIndex((s) => s.id === stage);
  const appState = {
    stage,
    hasTwin: !!twin,
    shockCount: labStatus.shockCount,
    hasSim: labStatus.hasSim,
    busy: labStatus.busy,
    optBusy: labStatus.optBusy,
    hasOpt: labStatus.hasOpt,
  };

  function handleTwin(t: FinancialTwin) {
    setTwin(t);
    setStage('twin');
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setStage('profile')}
            className="rounded focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-amber"
          >
            <Wordmark />
          </button>
          <nav className="num flex items-center gap-1 text-xs uppercase tracking-wider" aria-label="Progress">
            {STEPS.map((s, i) => {
              const locked = i > (twin ? 2 : 0);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setStage(s.id)}
                  className={`rounded-full px-3 py-1.5 transition-colors disabled:cursor-not-allowed ${
                    i === stageIndex
                      ? 'bg-petrol text-[#f2faf7]'
                      : locked
                        ? 'text-inksoft/60 line-through decoration-line'
                        : 'hover:bg-mint'
                  }`}
                  aria-current={i === stageIndex ? 'step' : undefined}
                  title={
                    locked
                      ? 'Pick a profile or enter your numbers first'
                      : `Go to ${s.label.split('·')[1]?.trim()}`
                  }
                >
                  {s.label}
                </button>
              );
            })}
            {stage === 'profile' && !twin && !tourActive && (
              <button type="button" className="chip ml-2" onClick={startTour}>
                ▸ Take the tour
              </button>
            )}
          </nav>
        </div>
      </header>

      <main>
        {stage === 'profile' && <ProfileStage onReady={handleTwin} />}
        {stage === 'twin' && twin && (
          <TwinStage twin={twin} onContinue={() => setStage('lab')} />
        )}
        {stage === 'lab' && twin && (
          <LabStage key={twin.label} twin={twin} onStatus={handleLabStatus} />
        )}
      </main>

      <footer className="mt-16 border-t-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-inksoft">
          <p className="num">
            MONEYTWIN — Monte Carlo cash-flow stress testing. Prototype; not financial advice.
          </p>
          <Link href="/evaluation" className="num underline decoration-line underline-offset-4 hover:text-petrol">
            System evaluation →
          </Link>
        </div>
      </footer>

      {step && (
        <Tour
          step={step}
          index={tourIdx ?? 0}
          total={TOUR_STEPS.length}
          ready={step.ready(appState)}
          onNext={() => {
            if (tourIdx === null) return;
            if (tourIdx >= TOUR_STEPS.length - 1) endTour();
            else goTo(tourIdx + 1);
          }}
          onBack={() => {
            if (tourIdx !== null) goTo(Math.max(tourIdx - 1, 0));
          }}
          onEnd={endTour}
        />
      )}
    </div>
  );
}
