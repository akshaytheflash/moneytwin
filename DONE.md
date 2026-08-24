# DONE

- [x] Frontend implementation — Next.js 16 App Router + Tailwind v4, three-stage flow (Profile → Twin → Stress Lab), custom SVG Runway chart with hazard-hatched failure zone, risk dial, evaluation dashboard page
- [x] Financial data ingestion — CSV bank statement parser (flexible headers, dd/mm & ISO dates, withdrawal/deposit columns), manual entry, 3 seeded synthetic personas (8 months of realistic Indian-context transactions)
- [x] Transaction categorization — ordered keyword/regex rules over 15 categories, Indian merchant vocabulary
- [x] Financial twin — income, volatility, fixed vs variable vs EMI split, discretionary burn, runway, volatility-adjusted emergency-fund target, risk flags incl. spending-anomaly detection (latest month > mean + 2σ per category)
- [x] Resilience score — 0–100 composite of runway, commitment load, income stability and reserve adequacy with per-factor breakdown
- [x] Recurring detection — digit-normalized grouping, amount CV ≤ 0.25, monthly-gap/day-of-month regularity, confidence scores; "heavy" marker for EMIs above 15% of income
- [x] Forecasting — seeded Monte Carlo (lognormal income noise from observed σ, lognormal variable spend, ±3% fixed jitter), p05–p95 bands, cumulative failure probability per month
- [x] Stress testing — 6 shock types (income drop, income loss, salary delay, one-time expense, recurring increase, new EMI), composable multi-shock scenarios, 3/6/12-month horizons
- [x] Monte Carlo/scenario engine — deterministic given seed; natural-language shock input parsed client-side
- [x] What-if dials — live income/spending/EMI sliders with debounced re-simulation of every chart
- [x] "Can I afford it?" simulator — yes/tight/no verdict with quantified risk delta
- [x] Reverse stress testing — binary-search breaking point for any scalable shock ("how bad can it get?")
- [x] Risk metrics — failure probability, median/worst-case min balance, median exhaustion month, buffer-at-horizon, severity bands
- [x] Explainability — structural drivers + per-shock ablation (Δ failure probability when each shock is removed)
- [x] Intervention optimizer — dynamic catalog (tiered discretionary cuts, subscriptions, scaled reserves up to ₹1L, EMI refinance), greedy cost-effectiveness ladder plus combined fallback pass when no single move helps; verified on the near-certain-failure Rao household (100% → 4.8%)
- [x] Scenario comparison — save up to three runs side by side with mini runway charts
- [x] Visualizations — uncertainty band chart with baseline overlay, category bars, intervention impact bars, dial gauge, hover tooltips
- [x] Guided demo tour � 7-step auto-driving spotlight walkthrough (pick profile ? twin flags ? job loss ? Monte Carlo results ? optimizer ? finale) with click-jail overlay, moving highlight ring, emphasized graph-change pulses, persistent end/skip controls
- [x] Plain-language annotations — all technical metrics on the evaluation page (and UI copy) explained for non-fintech readers, technical terms kept in parentheses
- [x] Demo profiles/data — Meera (stable), Arjun (volatile freelance), Rao household (leveraged)
- [x] Evaluation — /api/evaluate: Brier score, MAE vs 4k-path reference, IQR coverage of true median, optimizer effectiveness + monotonicity violations, ms/sim throughput
- [x] Tests — 28 vitest tests over RNG, categorizer, recurring detection, forecast determinism/ordering, severity bands, reverse stress test, optimizer (incl. near-certain-failure fallback), twin building, CSV parsing
- [x] Docker deployment — multi-stage Dockerfile (standalone output, non-root user, HEALTHCHECK)
- [x] Render configuration — render.yaml blueprint + README instructions; health endpoint /api/health
- [x] Documentation — README with architecture, modeling rationale, assumptions/limitations
- [x] Validation & error handling on all API routes; no hardcoded secrets; lint + typecheck clean


