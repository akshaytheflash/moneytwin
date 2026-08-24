# REMAINING

Prioritized by demo impact.

## High impact

1. **Scenario comparison upgrades** — comparison exists (save up to 3 runs); next step is letting
   users name saved scenarios and overlaying multiple medians on one chart instead of separate cards.
2. **AR(1) income autocorrelation** — real gig income is serially correlated; adding an AR(1) term
   would widen realistic tails for the freelancer profile and is easy to justify statistically.
3. **Calibration against an independent reality model** — current eval scores estimator convergence
   (same model, different seeds); scoring against an independently-specified generator would be
   stronger evidence.
4. **Household modeling** — multiple income earners as first-class entities (currently aggregated).

## Medium impact

5. **Smarter categorization** — replace pure keyword rules with embeddings/LLM fallback for unknown
   merchants; keep rules as the explainable first pass.
6. **LLM fallback for NL scenario input** — regex parser handles common phrasings; an LLM layer
   could catch fuzzier sentences. The typed-Shock API boundary already supports it.
7. **PDF report** — markdown download works; styled PDF would land better in judging.
8. **CSV column-mapping UX** — auto-detection covers common shapes; a manual mapping fallback UI
   would make uploads bulletproof.
9. **Anomaly detection depth** — current spike detection is per-category z-score on monthly totals;
   transaction-level outliers and subscription price-creep detection are natural extensions.

## Technical debt / polish

- What-if dials re-run simulations 500 ms after a slider stops — could stream cheaper low-path
  previews while dragging, then a high-path run on release.
- `evaluate.ts` runs synchronously in the request (~1–2 s at population 20); move to a background
  job if the population grows.
- No e2e browser tests (Playwright) — engine and API are covered, UI flows are not automated.
- Docker image not yet pushed/built on CI; verified locally via production build only.
- Mobile layout tested via responsive classes but not device-verified.
- Optimizer stacks "trim 20%" then "trim 40%" as two steps (60% total cut); collapsing into a
  single best-cut step would read cleaner.
