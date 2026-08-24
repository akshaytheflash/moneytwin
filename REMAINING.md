# REMAINING

Prioritized by demo impact.

## High impact

1. **"Can I afford this?" simulator** — a dedicated input (amount + optional timing) that answers
   yes/no with the risk delta. The engine supports it today (one-time-expense scenario); only UI is
   missing. ~half a day.
2. **Scenario comparison view** — side-by-side runway charts for 2–3 saved scenarios. State model
   already keeps baseline vs one stressed run; needs a small scenario store.
3. **Reverse stress test** — "how large a shock can I survive?" Binary-search shock magnitude until
   p(failure) = 50%. Cheap to add on top of `runSimulation`; high wow factor for judges.
4. **Rao-profile optimizer dead-end** — for near-certain failure (income loss on the leveraged
   household) no single intervention clears the 0.002-gain bar, so the ladder returns empty. A
   "combined-only fallback" evaluation pass would show partial improvements honestly instead of an
   empty plan.

## Medium impact

5. **Household modeling** — multiple income earners as first-class entities (currently aggregated).
6. **Smarter categorization** — replace pure keyword rules with embeddings/LLM fallback for unknown
   merchants; keep rules as the explainable first pass.
7. **Anomaly detection** — flag unusual transactions (z-score per category) in the twin view.
8. **Calibration against a different generative model** — current eval scores estimator convergence
   (same model, different seeds); scoring against an independently-specified reality model would be
   stronger evidence.
9. **PDF report** — markdown download exists; styled PDF would land better in judging.
10. **CSV column-mapping UX** — auto-detection covers common shapes; a manual mapping fallback UI
    would make uploads bulletproof.

## Technical debt / polish

- ProfileStage skeleton cards use `animate-pulse` placeholder; could show shimmering real metadata.
- `evaluate.ts` runs synchronously in the request (~1–2 s at population 20); move to a background
  job if the population grows.
- No e2e browser tests (Playwright) — engine and API are covered, UI flows are not automated.
- Docker image not yet pushed/built on CI; verified locally via production build only.
- Mobile layout tested via responsive classes but not device-verified.
- Income noise ignores autocorrelation (real gig income is serially correlated); adding an AR(1)
  term would widen realistic tails for freelancers.
