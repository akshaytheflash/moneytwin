'use client';

import type { Severity } from '@/lib/engine/types';

const SEVERITY_COLOR: Record<Severity, string> = {
  low: '#0f5852',
  moderate: '#b57a06',
  high: '#d94c25',
  critical: '#8f1d06',
};

export default function RiskDial({
  probability,
  severity,
  size = 190,
}: {
  probability: number;
  severity: Severity;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2 + 6;
  const r = size / 2 - 22;
  const color = SEVERITY_COLOR[severity];

  const polar = (angleDeg: number): [number, number] => {
    const rad = (Math.PI * angleDeg) / 180;
    return [cx - r * Math.cos(rad), cy - r * Math.sin(rad)];
  };

  const arc = (fromDeg: number, toDeg: number): string => {
    const [x1, y1] = polar(fromDeg);
    const [x2, y2] = polar(toDeg);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  const needleAngle = 180 * Math.min(Math.max(probability, 0), 1);
  const [nx, ny] = polar(needleAngle);

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`} role="img" aria-label={`Failure probability ${(probability * 100).toFixed(0)} percent, ${severity}`}>
      <path d={arc(180, 126)} fill="none" stroke="#0f5852" strokeWidth="13" strokeLinecap="butt" opacity="0.9" />
      <path d={arc(125, 90)} fill="none" stroke="#b57a06" strokeWidth="13" strokeLinecap="butt" opacity="0.9" />
      <path d={arc(89, 45)} fill="none" stroke="#d94c25" strokeWidth="13" strokeLinecap="butt" opacity="0.9" />
      <path d={arc(44, 0)} fill="none" stroke="#8f1d06" strokeWidth="13" strokeLinecap="butt" opacity="0.9" />

      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="7" fill="#101b17" />

      <text
        x={cx}
        y={cy - 26}
        textAnchor="middle"
        fontSize="34"
        fontWeight="700"
        fontFamily="var(--font-mono)"
        fill={color}
      >
        {(probability * 100).toFixed(0)}%
      </text>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="10"
        letterSpacing="2"
        fontFamily="var(--font-mono)"
        fill="#4b5a53"
      >
        {severity.toUpperCase()}
      </text>
      <text x={size - 8} y={cy + 14} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="#4b5a53">
        FAIL IN HORIZON
      </text>
    </svg>
  );
}
