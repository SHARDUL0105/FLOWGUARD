# FLOWGUARD — Intelligence & Resilience Scoring

## Contributor

Sneha

## Scope

This package contains my completed contribution to the FLOWGUARD hackathon project, focused on the Intelligence and Resilience Scoring layer.

## Implemented Components

### 1. Anomaly Detection
- Detects healthy, degraded, and critical service states.
- Uses response latency and success-rate thresholds.
- Tracks the first anomaly tick.
- Tracks recovery after 5 consecutive healthy ticks.

### 2. Propagation / Cascade Analysis
- Traces anomaly propagation through the service topology.
- Handles caller → callee relationships.
- Identifies affected anomalous nodes and propagation chains.

### 3. Root-Cause Ranking
- Ranks possible root causes using:
  - Earliness
  - Impact
  - Severity
- Produces normalized confidence estimates.
- Provides evidence explaining the ranking.
- Confidence is presented as an estimate, not certainty.

### 4. Blast Radius
- Identifies direct callers of an affected service.
- Identifies further downstream/transitive callers.
- Calculates total affected nodes.
- Determines whether the checkout path is at risk.

### 5. Resilience Scoring
- Validates resilience scoring against the project specification.
- Covers:
  - Database latency fault
  - Inventory service-down fault
  - Traffic-spike fault
- Uses simulator-derived results rather than hardcoded scores.
- Validates deterministic scoring behavior.

### 6. Analytic Predictor
- Uses a steady-state analytic model.
- Provides:
  - Forecast p95 latency
  - Forecast error rate
  - Utilization
  - Saturated services
  - Risk level
- Supports LOW / MEDIUM / HIGH risk classification.
- `whatif()` compares the analytic forecast with a seeded simulator result.
- Calculates forecast accuracy.
- Includes the required low-accuracy warning near saturation.

## Tests

Focused tests were added for:

- Anomaly detection and recovery
- Propagation
- Root-cause ranking
- Blast radius
- Predictor
- Resilience scoring

Final backend test result:

**62 passed**

## Files Included

### Intelligence implementation

- `backend/app/intel/anomaly.py`
- `backend/app/intel/blast_radius.py`
- `backend/app/intel/predictor.py`
- `backend/app/intel/propagation.py`
- `backend/app/intel/root_cause.py`

### Tests

- `backend/app/tests/test_anomaly.py`
- `backend/app/tests/test_blast_radius.py`
- `backend/app/tests/test_predictor.py`
- `backend/app/tests/test_propagation.py`
- `backend/app/tests/test_root_cause.py`
- `backend/app/tests/test_scoring.py`

## Git

Branch:

`feat/intelligence-sneha`

Commit:

`5b99561`

Commit message:

`feat: implement intelligence and resilience scoring`

The work has been pushed to my personal FLOWGUARD fork and has not been merged into the team's main repository.

## Validation

- Full backend suite: **62 passed**
- `git diff --check`: clean
- Working tree clean after commit