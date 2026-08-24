# MONEYTWIN

**A personal financial digital twin that stress-tests your future.**
Not "where did my money go" — but *"what happens to my finances if something goes wrong?"*

> If your income falls 25% and a ₹40,000 emergency hits, there is a **31% probability of liquidity
> failure within 6 months**. Trimming ₹1,850/month of discretionary spend and holding a ₹15,000
> reserve brings that to an estimated **9%**.

MONEYTWIN ingests real or synthetic bank transactions, builds a structured financial twin,
runs Monte Carlo cash-flow forecasts, simulates shocks, explains the risk drivers, and optimizes
the cheapest set of interventions that reaches a target risk level.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm run test       # engine unit tests (vitest)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## The demo flow (for judges)

1. **Profile** — pick one of three seeded demo personas (stable salaried, volatile freelancer,
   over-leveraged household), upload your own CSV, or enter numbers manually.
2. **Financial twin** — income, volatility, fixed obligations, discretionary burn, detected
   recurring commitments with confidence scores, and personalized risk flags.
3. **Stress lab** — pick preset shocks or type `"lose my job for 3 months"`; the Monte Carlo
   engine replays thousands of futures and renders the runway chart: uncertainty band, median
   path, and hazard-hatched failure zone.
4. **Why this number** — quantitative risk decomposition, including per-shock sensitivity
   (removing each shock and re-simulating).
5. **What-if dials** — drag income/spending/EMI sliders and every chart re-simulates live.
6. **Can I afford it?** — type an amount; get a yes / tight / no verdict with the risk delta.
7. **How bad can it get?** — reverse stress testing: binary search finds the largest version of any
   shock you could absorb before 50% odds of running out.
8. **Intervention optimizer** — greedy cost-effectiveness search over catalog moves
   (cut discretionary %, cancel subscriptions, build reserve, refinance EMIs) that reaches your
   target failure probability for minimum lifestyle cost — including combined plans when no single
   move is enough.
9. **Scenario comparison** — save up to three runs side by side with mini runway charts.
10. **Evaluation page** (`/evaluation`) — the engine is scored against a synthetic population:
    agreement between fast and deep estimates, reliability of the shaded range, intervention
    effectiveness, monotonicity checks, and throughput. All metrics are annotated in plain language.

## Architecture

```
src/
├── app/
│   ├── api/health/route.ts       GET  liveness probe
│   ├── api/profiles/route.ts     GET  demo profile catalogue
│   ├── api/twin/route.ts         POST build twin (demo | csv | manual)
│   ├── api/simulate/route.ts     POST Monte Carlo baseline + stressed runs
│   ├── api/optimize/route.ts     POST intervention optimizer
│   ├── api/reverse-stress/route.ts POST reverse stress test (breaking point)
│   ├── api/evaluate/route.ts     GET  evaluation suite on synthetic population
│   ├── evaluation/page.tsx       evaluation dashboard
│   └── page.tsx                  single-page product flow
├── components/                   UI stages + RunwayChart / RiskDial (custom SVG)
└── lib/
    ├── api/http.ts               validation & error handling helpers
    ├── scenarioText.ts           natural-language shock parser (client-side)
    └── engine/                   pure, dependency-free financial engine
        ├── rng.ts                seeded mulberry32 + gaussian + percentiles
        ├── categories.ts         category taxonomy + merchant keyword rules
        ├── categorize.ts         transaction classification
        ├── recurring.ts          recurring-payment detection (CV + calendar regularity)
        ├── twin.ts               twin construction from transactions or manual input
        ├── forecast.ts           Monte Carlo engine + explainability (shock ablation)
        ├── reverse.ts            reverse stress testing (breaking-point search)
        ├── score.ts              resilience score (runway / commitments / stability / reserve)
        ├── interventions.ts      intervention catalog + greedy optimizer
        ├── evaluate.ts           synthetic population evaluation
        ├── parse.ts              flexible CSV statement parser
        ├── demo.ts               seeded synthetic persona generator
        └── format.ts             INR formatting
```

All engine code is deterministic given a seed — identical inputs reproduce identical risk numbers.

### Modeling choices

- **Income noise:** AR(1) lognormal shocks — `σ·z_m` where `z_m = ρ·z_{m−1} + √(1−ρ²)·ε` with
  ρ = 0.3 — so bad months cluster the way real (especially freelance) income does, while overall
  variance still matches the observed month-to-month volatility. Income never goes negative.
- **Variable spend noise:** lognormal with σ = 0.35; fixed costs get ±3% Gaussian jitter.
- **Failure definition:** projected balance < ₹0 at any month in the horizon. `failureProb(m)` is
  cumulative across paths; exhaustion month distribution gives *when*, not just *whether*.
- **Explainability:** structural drivers (runway, commitment load, volatility) plus **shock
  ablation** — each shock is removed, the simulation re-run, and the Δ in failure probability
  reported as its causal contribution.
- **Optimizer:** each candidate move is scored alone (risk reduction per unit monthly sacrifice),
  then a greedy ladder applies up to 4 moves, re-evaluating combined risk at full path count until
  target is met. Every step reports before → after risk, so results are auditable.
- **Recurring detection:** transactions grouped by digit-normalized description; ≥3 occurrences,
  amount CV ≤ 0.25, and ~monthly spacing (median gap 24–38 days or day-of-month regularity);
  confidence blends coverage and regularity.

### Assumptions & limitations

- Balances are modeled as a single liquid pool; no credit lines, interest accrual, or inflation.
- Income shocks are multiplicative on expected income; salary delay shifts part of the month's
  income into the next month.
- Refinancing is approximated as an 18% EMI relief (more total interest — surfaced in UI copy).
- CSV parsing supports common statement shapes (date/description/amount or withdrawal/deposit),
  but unusual bank exports may need header tweaks.
- The evaluation layer scores estimator quality against a higher-precision run of the same model;
  it validates convergence and optimizer behavior, not real-world predictive accuracy.

## Tests

`npm run test` covers RNG determinism, gaussian moments, percentile interpolation, category
rules, recurring detection (positive + negative cases), forecast determinism, percentile ordering,
risk monotonicity under shocks, severity bands, optimizer effectiveness, twin construction from
generated demo data, and CSV parsing including malformed rows.

## Deployment (Render, Docker)

The repo ships a multi-stage `Dockerfile` (deps → build → standalone runtime, non-root user,
health check) and `render.yaml`.

**Option A — Blueprint:** push to GitHub → Render → New → Blueprint → select repo. Done.

**Option B — Manual:** Render → New Web Service → Docker → point at the repo. Health check path
`/api/health`. No environment variables required (NODE_ENV set in image). Free plan works; first
cold start takes ~30 s.

Local container check:

```bash
docker build -t moneytwin .
docker run -p 3000:3000 moneytwin
curl http://localhost:3000/api/health
```

No secrets are needed at runtime; there are no third-party API keys. All state lives client-side
between requests, so the service scales horizontally out of the box.
