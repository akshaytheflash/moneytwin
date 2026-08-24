'use client';

import { useMemo, useState } from 'react';
import type { MonthlyPoint } from '@/lib/engine/types';
import { inrCompact } from '@/lib/engine/format';

interface Props {
  points: MonthlyPoint[];
  height?: number;
  compareMedian?: number[];
  label?: string;
}

const W = 1000;

export default function RunwayChart({ points, height = 330, compareMedian, label }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const padL = 74;
  const padR = 18;
  const padT = 20;
  const padB = 36;
  const horizon = points.length - 1;

  const geo = useMemo(() => {
    const loVals = points.map((p) => Math.min(p.p05, 0));
    const hiVals = points.map((p) => p.p95);
    if (compareMedian) hiVals.push(...compareMedian);
    let vmin = Math.min(...loVals);
    let vmax = Math.max(...hiVals);
    if (vmax - vmin < 1000) vmax = vmin + 1000;
    const span = vmax - vmin;
    vmax += span * 0.06;
    vmin -= span * 0.04;

    const xs = (m: number) => padL + (m / Math.max(horizon, 1)) * (W - padL - padR);
    const ys = (v: number) =>
      padT + ((vmax - v) / (vmax - vmin)) * (H - padT - padB);

    const band = (lo: (p: MonthlyPoint) => number, hi: (p: MonthlyPoint) => number) => {
      const up = points.map((p, i) => `${xs(i)},${ys(hi(p))}`);
      const dn = points.map((p, i) => `${xs(i)},${ys(lo(p))}`).reverse();
      return `M${up.join(' L')} L${dn.join(' L')} Z`;
    };

    const line = (vals: number[]) =>
      vals.map((v, i) => `${xs(i)},${ys(v)}`).join(' ');

    return {
      xs,
      ys,
      outer: band((p) => p.p05, (p) => p.p95),
      inner: band((p) => p.p25, (p) => p.p75),
      median: line(points.map((p) => p.p50)),
      compare: compareMedian ? line(compareMedian) : null,
      zeroY: ys(0),
      ticks: (() => {
        const out: { v: number; y: number }[] = [];
        for (let i = 0; i <= 4; i++) {
          const v = vmin + ((vmax - vmin) * i) / 4;
          out.push({ v, y: ys(v) });
        }
        return out;
      })(),
    };
  }, [points, compareMedian, H, horizon]);

  const failMonth =
    points.findIndex((p, i) => i > 0 && p.failureProb >= 0.5) !== -1
      ? points.findIndex((p, i) => i > 0 && p.failureProb >= 0.5)
      : null;

  const hoverPoint = hover !== null ? points[hover] : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={label ?? 'Projected cash balance over time with uncertainty band'}
      >
        <defs>
          <pattern id="hazard" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="none" />
            <line x1="0" y1="0" x2="0" y2="12" stroke="#d94c25" strokeWidth="4" />
          </pattern>
        </defs>

        {geo.ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="#c3d0c8" strokeWidth="1" />
            <text
              x={padL - 10}
              y={t.y + 4}
              textAnchor="end"
              fontSize="13"
              fill="#4b5a53"
              fontFamily="var(--font-mono)"
            >
              {inrCompact(t.v)}
            </text>
          </g>
        ))}

        {failMonth !== null && (
          <rect
            x={geo.xs(failMonth)}
            y={padT}
            width={W - padR - geo.xs(failMonth)}
            height={H - padT - padB}
            fill="url(#hazard)"
            opacity="0.16"
          />
        )}

        <path d={geo.outer} fill="#0f5852" opacity="0.14" />
        <path d={geo.inner} fill="#0f5852" opacity="0.26" />

        <line
          x1={padL}
          x2={W - padR}
          y1={geo.zeroY}
          y2={geo.zeroY}
          stroke="#d94c25"
          strokeWidth="1.6"
          strokeDasharray="7 5"
        />

        {geo.compare && (
          <polyline
            points={geo.compare}
            fill="none"
            stroke="#b57a06"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}

        <polyline points={geo.median} fill="none" stroke="#101b17" strokeWidth="2.6" strokeLinejoin="round" />

        <line x1={geo.xs(0)} x2={geo.xs(0)} y1={padT} y2={H - padB} stroke="#101b17" strokeWidth="2" />
        <text x={geo.xs(0) + 6} y={padT + 12} fontSize="12" fontWeight="700" fill="#101b17" fontFamily="var(--font-mono)">
          TODAY
        </text>

        {failMonth !== null && (
          <>
            <circle cx={geo.xs(failMonth)} cy={geo.zeroY} r="7" fill="#d94c25" stroke="#101b17" strokeWidth="2" />
            <text
              x={Math.min(geo.xs(failMonth) + 10, W - padR - 120)}
              y={H - padB - 8}
              fontSize="12"
              fontWeight="700"
              fill="#d94c25"
              fontFamily="var(--font-mono)"
            >
              LIQUIDITY FAILURE RISK
            </text>
          </>
        )}

        {points.map((_, i) => (
          <g key={i}>
            {(horizon <= 12 || i % 2 === 0) && (
              <text
                x={geo.xs(i)}
                y={H - 14}
                textAnchor="middle"
                fontSize="12"
                fill={i === 0 ? '#101b17' : '#4b5a53'}
                fontWeight={i === 0 ? 700 : 400}
                fontFamily="var(--font-mono)"
              >
                {i === 0 ? 'M0' : `M${i}`}
              </text>
            )}
            <rect
              x={geo.xs(Math.max(i - 0.5, 0))}
              y={padT}
              width={i === 0 ? (geo.xs(1) - geo.xs(0)) / 2 : geo.xs(1) - geo.xs(0)}
              height={H - padT - padB}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={geo.xs(hover)} x2={geo.xs(hover)} y1={padT} y2={H - padB} stroke="#101b17" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={geo.xs(hover)} cy={geo.ys(points[hover].p50)} r="5" fill="#101b17" />
          </g>
        )}
      </svg>

      {hoverPoint && (
        <div className="panel-flat num pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 px-4 py-2 text-xs shadow-md">
          <span className="font-bold">{hoverPoint.month === 0 ? 'Today' : `Month ${hoverPoint.month}`}</span>
          {'   ·   '}
          median {inrCompact(hoverPoint.p50)}{'   ·   '}
          range {inrCompact(hoverPoint.p05)} – {inrCompact(hoverPoint.p95)}{'   ·   '}
          <span style={{ color: hoverPoint.failureProb >= 0.5 ? '#d94c25' : '#4b5a53' }}>
            fail risk {(hoverPoint.failureProb * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
