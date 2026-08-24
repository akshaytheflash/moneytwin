'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TourStepDef } from '@/lib/tourSteps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Placement {
  left: number;
  top: number;
  fullWidth: boolean;
}

const CARD_W = 340;
const CARD_H_ESTIMATE = 210;
const GAP = 14;

export default function Tour({
  step,
  index,
  total,
  ready,
  onNext,
  onBack,
  onEnd,
}: {
  step: TourStepDef;
  index: number;
  total: number;
  ready: boolean;
  onNext: () => void;
  onBack: () => void;
  onEnd: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el instanceof HTMLElement) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect((prev) =>
            prev &&
            Math.abs(prev.top - r.top) < 0.5 &&
            Math.abs(prev.left - r.left) < 0.5 &&
            Math.abs(prev.width - r.width) < 0.5 &&
            Math.abs(prev.height - r.height) < 0.5
              ? prev
              : { top: r.top, left: r.left, width: r.width, height: r.height },
          );
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const cardW = Math.min(CARD_W, vw - 24);
          const bottomSheet = vw < 640;
          let left = Math.min(Math.max(r.left + r.width - cardW, 12), vw - cardW - 12);
          let top: number;
          let fullWidth = false;
          if (bottomSheet) {
            top = vh - CARD_H_ESTIMATE - 12;
            left = 12;
            fullWidth = true;
          } else if (r.bottom + GAP + CARD_H_ESTIMATE < vh) {
            top = r.bottom + GAP;
          } else if (r.top - GAP - CARD_H_ESTIMATE > 60) {
            top = r.top - GAP - CARD_H_ESTIMATE;
          } else {
            top = vh - CARD_H_ESTIMATE - 12;
            fullWidth = true;
          }
          setPlacement((prev) =>
            prev && prev.top === top && prev.left === left && prev.fullWidth === fullWidth
              ? prev
              : { left, top, fullWidth },
          );
        }
      }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  useEffect(() => {
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!(el instanceof HTMLElement)) return;
    const prevPosition = el.style.position;
    const prevZIndex = el.style.zIndex;
    el.style.position = 'relative';
    el.style.zIndex = '50';
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    return () => {
      el.style.position = prevPosition;
      el.style.zIndex = prevZIndex;
    };
  }, [step.target]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd();
      if (e.key === 'Tab' && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<HTMLElement>('button, a[href]');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    },
    [onEnd],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    firstFocus();
    function firstFocus() {
      requestAnimationFrame(() => {
        cardRef.current?.querySelector<HTMLElement>('.btn-primary')?.focus();
      });
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const ringStyle = rect
    ? {
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        opacity: 1,
      }
    : { opacity: 0, top: '40%', left: '40%', width: 120, height: 80 };

  const isLast = index === total - 1;

  return (
    <>
      <div className="tour-scrim" aria-hidden />
      <div className="tour-blocker" aria-hidden />
      <div
        className={`tour-ring ${step.emphasize ? 'tour-ring-emphasized' : ''}`}
        style={ringStyle}
        data-testid="tour-ring"
        aria-hidden
      >
        {step.emphasize && <div key={`pulse-${index}`} className="tour-ring-pulse" />}
      </div>

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${index + 1} of ${total}`}
        className="tour-card"
        style={
          placement
            ? {
                top: placement.top,
                left: placement.left,
                width: placement.fullWidth ? 'calc(100vw - 24px)' : undefined,
              }
            : { visibility: 'hidden' }
        }
      >
        <button type="button" className="tour-end-link absolute right-3 top-2" onClick={onEnd} aria-label="End tour">
          ✕ end tour
        </button>
        <div key={step.id} className="tour-card-content">
          <p className="eyebrow">
            Step {index + 1} / {total} · {step.screen}
          </p>
          <p className="mt-2 text-sm leading-relaxed">{step.caption}</p>

          {!ready && step.pendingNote && (
            <p className="num mt-2 animate-pulse text-xs font-semibold text-petrol" aria-live="polite">
              {step.pendingNote}
            </p>
          )}

          <div className="mt-4 flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`tour-dot ${i <= index ? 'tour-dot-on' : ''}`} />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button type="button" className="btn !px-3 !py-1.5 !text-xs" disabled={index === 0} onClick={onBack}>
              ← Back
            </button>
            <button type="button" className="btn btn-primary !px-4 !py-1.5 !text-xs" disabled={!ready} onClick={onNext}>
              {isLast ? 'Finish' : 'Next →'}
            </button>
            <button type="button" className="tour-end-link ml-auto" onClick={onEnd}>
              skip tour
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
