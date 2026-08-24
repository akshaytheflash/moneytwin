# MONEYTWIN — End-to-End Hackathon Build Prompt

Build **MONEYTWIN**, a production-quality prototype for a Track 4 fintech hackathon.

## Core Idea

MONEYTWIN is a **personal financial digital twin** that stress-tests a user's future finances.

Instead of only telling users where their money went, it answers:

> **"What happens to my finances if something goes wrong?"**

The system should ingest financial data, construct a financial profile, forecast cash flow, simulate financial shocks, estimate the probability of liquidity failure, and recommend/optimize interventions that reduce that risk.

Example:

> "If your income falls 20% and you have a ₹40,000 emergency expense, there is a 31% probability of liquidity failure within 6 months. Reducing discretionary spending by ₹1,850/month + building a ₹12,000 emergency reserve reduces this to an estimated 8%."

This must be a **real working application**, not a mockup.

---

## FIRST: READ THE EXISTING FRONTEND SPEC

There is a `FRONTEND.md` file in the project folder.

**Read `FRONTEND.md` completely before designing or modifying the frontend.**

Treat it as the frontend design/specification source of truth. Preserve its intended design language, structure and requirements while implementing the product.

---

# Product Requirements

Build the complete system end-to-end:

### 1. Financial Data Engine

Support realistic input through things such as:

* CSV bank transaction upload
* manually entered financial information
* synthetic/demo financial profiles
* recurring income detection
* recurring expense detection
* spending categorization
* debt/EMI identification
* cash balance and savings
* income volatility estimation

Do not require real bank APIs for the demo.

Provide excellent sample/demo data so judges can immediately experience the product.

### 2. Financial Twin

Create a structured representation of the user's financial state:

* income
* expenses
* fixed obligations
* variable expenses
* debt
* savings
* liquidity
* income volatility
* recurring commitments
* emergency buffer

Make the underlying representation useful to the forecasting and simulation engines rather than just displaying dashboard statistics.

### 3. Cash-Flow Forecasting

Build a genuine forecasting system.

Prefer probabilistic forecasting where appropriate rather than pretending the future is deterministic.

Show:

* expected cash balance
* confidence/risk ranges
* expected income
* expected expenses
* upcoming obligations
* potential liquidity problems

Use appropriate statistical/ML techniques and justify the choice in documentation.

### 4. Stress Testing Engine

Allow users to simulate scenarios such as:

* income drops by X%
* salary/payment is delayed
* unexpected medical expense
* rent increase
* new EMI
* job/income loss
* family emergency
* large one-time purchase
* recurring expense increase
* multiple simultaneous shocks

Allow custom scenarios where practical.

Run simulations over a configurable horizon, e.g. 3/6/12 months.

Use Monte Carlo or another statistically defensible approach where appropriate.

Calculate metrics such as:

* probability of liquidity failure
* minimum projected cash balance
* time until cash exhaustion
* emergency liquidity requirement
* expected financial buffer
* scenario severity

### 5. Intervention Optimizer

This is a critical feature.

Don't stop at predicting the problem.

Given a risky scenario, find realistic interventions that improve resilience.

Examples:

* reduce discretionary spending
* increase emergency savings
* delay a purchase
* refinance/change debt structure
* cancel subscriptions
* adjust repayment strategy
* build a larger liquidity buffer

Show the effect of each intervention quantitatively.

Example:

> Current distress probability: 31%

> Reduce discretionary spending ₹1,850/month → 24%

> Add ₹12,000 emergency reserve → 17%

> Combined intervention → 8%

Where possible, optimize for the **lowest-cost intervention that achieves a target reduction in risk**.

---

# UX / Demo Experience

The application should feel like a serious fintech product, not a college CRUD dashboard.

The primary flow should be extremely clear:

**Upload / choose financial profile → Build Financial Twin → View baseline → Run Stress Test → See future simulation → Understand why → Optimize → Compare interventions**

The main experience should make the future feel tangible.

For example, visually show:

```text
TODAY
  ↓
Month 1
  ↓
Month 2
  ↓
Month 3
  ↓
Month 4
  ↓
Month 5
  ↓
LIQUIDITY FAILURE
```

Then let the user change assumptions and rerun the simulation.

Prioritize excellent visualization of:

* projected cash balance
* uncertainty bands
* risk probability
* scenario comparison
* intervention impact
* financial runway
* major obligations
* risk timeline

---

# Make It Technically Impressive

Do not build an LLM wrapper and call it AI.

The core financial/risk engine must produce the important outputs algorithmically.

Use AI/ML only where it genuinely adds value, such as:

* transaction categorization
* anomaly detection
* forecasting
* intelligent scenario generation
* natural-language explanation of quantitative results

The numerical outputs must remain reproducible and explainable.

Every important risk result should have a clear explanation of **what caused it**.

---

# Best Features

Think beyond the minimum requirements.

After implementing the core system, independently identify and implement the **highest-value features you can imagine** that would make MONEYTWIN significantly better in a hackathon demo.

Potential ideas include:

* "Can I afford this?" simulator
* What-if sliders
* financial runway score
* personalized emergency-fund target
* scenario comparison
* reverse stress testing: "How bad can things get before I fail?"
* automatic detection of dangerous recurring commitments
* financial resilience score
* intervention optimizer
* explainable risk decomposition
* uncertainty visualization
* household/family scenario modeling
* natural-language scenario input
* downloadable financial stress report
* demo mode with compelling prebuilt scenarios

Do not blindly implement every idea. **Choose the features that maximize technical depth, usefulness, demo impact and differentiation.**

---

# Engineering Requirements

Build this as a clean, maintainable full-stack application.

Requirements:

* proper frontend/backend separation where appropriate
* modular financial engine
* clean API boundaries
* validation and error handling
* realistic seeded/demo data
* configuration through environment variables
* no hardcoded secrets
* reproducible local setup
* production build
* useful logging
* sensible tests for important financial calculations
* clear README with setup and architecture
* document assumptions and limitations

Do not fake functionality with static numbers where an actual implementation is reasonably possible.

---

# Deployment

The entire application must be **deployable on Render using Docker**.

Provide:

* production Dockerfile(s)
* appropriate startup configuration
* environment-variable configuration
* health endpoint
* production frontend build
* backend production server
* persistent storage strategy if required
* Render deployment instructions

The final repository should be capable of being deployed with minimal manual intervention.

Prefer a simple deployment architecture that is reliable for a hackathon demo.

---

# Evaluation / Research

Build an evaluation layer so we can demonstrate that the system actually works.

Where practical, create synthetic financial populations and known ground-truth scenarios.

Evaluate relevant components using appropriate metrics, for example:

* forecasting error
* calibration
* classification metrics where applicable
* scenario detection accuracy
* intervention effectiveness
* computational performance

The final demo should be able to communicate quantitative evidence rather than just screenshots.

---

# Hackathon Polish

Optimize specifically for a live judge demo.

The first few minutes should immediately communicate:

1. What problem are we solving?
2. Why is it different?
3. What does MONEYTWIN actually do?
4. Why is the underlying technology difficult?
5. Does it actually work?

Make the product visually impressive, fast and intuitive.

Avoid unnecessary features that dilute the core experience.

---

# Required Checklist

Maintain `DONE.md` and `REMAINING.md` in the repository.

Actively update them throughout development.

### DONE.md

Track completed:

* [ ] frontend implementation
* [ ] financial data ingestion
* [ ] transaction categorization
* [ ] financial twin
* [ ] forecasting
* [ ] stress testing
* [ ] Monte Carlo/scenario engine
* [ ] risk metrics
* [ ] intervention optimizer
* [ ] visualizations
* [ ] demo profiles/data
* [ ] evaluation
* [ ] tests
* [ ] Docker deployment
* [ ] Render configuration
* [ ] documentation
* [ ] final polish

### REMAINING.md

Continuously record:

* unfinished functionality
* bugs
* technical debt
* missing tests
* deployment issues
* UX improvements
* high-value features still worth implementing

Prioritize remaining work by **impact**, not merely convenience.

---

# Final Instruction

Take ownership of the engineering decisions.

You have freedom to choose the best technologies, algorithms, data structures, models and implementation details.

Use the internet/research as needed to investigate current best practices, relevant financial modeling techniques, datasets, libraries and deployment approaches.

If something is genuinely ambiguous or a decision materially affects the architecture, **ask me rather than making a major arbitrary assumption**.

Otherwise, keep moving and build the strongest version possible.

The goal is not merely to satisfy the problem statement.

The goal is to produce a **technically credible, visually exceptional, measurable and genuinely differentiated fintech prototype that could win the hackathon.**
