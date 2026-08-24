export type TourStage = 'profile' | 'twin' | 'lab';

export interface TourAppState {
  stage: TourStage;
  hasTwin: boolean;
  shockCount: number;
  hasSim: boolean;
  busy: boolean;
  optBusy: boolean;
  hasOpt: boolean;
}

export interface TourStepDef {
  id: string;
  screen: string;
  caption: string;
  target: string;
  stage: TourStage;
  emphasize?: boolean;
  pendingNote?: string;
  ready: (s: TourAppState) => boolean;
}

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'intro',
    screen: 'DEMO PROFILES',
    stage: 'profile',
    target: 'profile-cards',
    caption:
      'Three synthetic households, built from eight months of seeded bank transactions. We will stress-test the most fragile one.',
    ready: () => true,
  },
  {
    id: 'pick-rao',
    screen: 'DEMO PROFILES',
    stage: 'profile',
    target: 'profile-card-rao',
    caption: 'Your turn: click the Rao household card to build its financial twin.',
    ready: (s) => s.hasTwin,
    pendingNote: 'building financial twin…',
  },
  {
    id: 'twin-risk',
    screen: 'FINANCIAL TWIN',
    stage: 'twin',
    target: 'twin-risk',
    caption:
      'Before any shock: EMIs alone consume ~46% of income and the buffer covers about one month. The resilience score already says "fragile".',
    ready: (s) => s.stage === 'twin' && s.hasTwin,
  },
  {
    id: 'twin-continue',
    screen: 'FINANCIAL TWIN',
    stage: 'twin',
    target: 'twin-continue',
    caption: 'Now open the stress lab.',
    ready: (s) => s.stage === 'lab',
  },
  {
    id: 'shock',
    screen: 'STRESS LAB',
    stage: 'lab',
    target: 'preset-job-loss',
    caption: "Apply a two-month total income loss: click the 'Job loss · 2 months' preset.",
    ready: (s) => s.shockCount > 0 && s.hasSim && !s.busy,
    pendingNote: 'simulating…',
  },
  {
    id: 'results',
    screen: 'MONTE CARLO RUNWAY',
    stage: 'lab',
    target: 'lab-results',
    emphasize: true,
    caption:
      '2,000 simulated futures. The hatched zone marks where the typical household runs out of money; the dial aggregates all paths.',
    ready: (s) => s.hasSim && !s.busy,
  },
  {
    id: 'optimize',
    screen: 'INTERVENTION OPTIMIZER',
    stage: 'lab',
    target: 'optimizer-run',
    caption:
      'Ask the engine for the cheapest combination of realistic moves that brings risk under the 15% target.',
    ready: (s) => s.hasOpt && !s.optBusy,
    pendingNote: 'simulating intervention combinations…',
  },
  {
    id: 'finale',
    screen: 'RESULT',
    stage: 'lab',
    target: 'lab-results',
    emphasize: true,
    caption:
      'No single move worked alone. The combined plan cuts liquidity-failure risk from ~100% to single digits. Every number is reproducible — see the evaluation page for calibration evidence.',
    ready: () => true,
  },
];
