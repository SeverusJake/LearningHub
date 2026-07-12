# Guide — Mission 09: Chaos + SRE

## Phase 0 — Setup check

Confirm the prerequisites are actually live before starting:

```bash
kubectl get pods -n shiplog
kubectl get pods -n observability
```

Expected: shiplog pods `Running`, and the Mission 08 observability stack (Prometheus, Grafana, Tempo, Loki) all `Running`. If either namespace is missing, go finish Missions 04 and 08 first — this mission has nothing to test against without them.

Install k6 and chaos-mesh's CLI prerequisite (Helm) on your workstation:

```bash
choco install k6
```

Expected: `k6 version` prints a version string.

## Phase 1 — k6 load profiles

Four scripts, each with a distinct purpose. Create `k6/smoke.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${__ENV.TARGET}/healthz`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

`k6/load.js` — steady expected traffic:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({ url: 'https://example.com/' + __VU + '/' + __ITER });
  const res = http.post(`${__ENV.TARGET}/links`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'created': (r) => r.status === 201 });
  sleep(0.5);
}
```

`k6/stress.js` — push past capacity on purpose:

```javascript
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '2m', target: 150 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  http.get(`${__ENV.TARGET}/healthz`);
}
```

`k6/soak.js` — long-duration steady load, catches leaks:

```javascript
import http from 'k6/http';

export const options = {
  vus: 15,
  duration: '30m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  http.get(`${__ENV.TARGET}/healthz`);
}
```

Run smoke first:

```bash
kubectl port-forward -n shiplog svc/shiplog 8080:80 &
k6 run -e TARGET=http://localhost:8080 k6/smoke.js
```

**Checkpoint:** all thresholds pass (`✓` next to each threshold in the summary). If smoke fails, nothing else in this mission is meaningful — fix shiplog first.

## Phase 2 — Steady-state hypothesis worksheet

Before opening chaos-mesh, write down what you expect to stay true. Create `hypotheses.md` using this template, one block per experiment:

```markdown
## Hypothesis: pod-kill

**Given:** shiplog running 3 replicas, under `load.js` traffic (20 VUs)
**When:** one shiplog pod is killed
**Then:** http_req_failed rate stays <1% and p95 stays <500ms during the 60s it takes to reschedule

**Result:** [record after running — PASS / FAIL / PARTIAL, with the actual numbers]
```

Copy this block three more times for `network-delay`, `io-stress`, and `cpu-stress`, writing a real `Given/When/Then` for each before you run anything. A hypothesis you write after the experiment isn't a hypothesis — it's a rationalization.

## Phase 3 — chaos-mesh experiments

Install chaos-mesh:

```bash
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh -n chaos-mesh --create-namespace --set chaosDaemon.runtime=containerd --set chaosDaemon.socketPath=/run/containerd/containerd.sock
```

Expected: `kubectl get pods -n chaos-mesh` shows the controller-manager and daemon pods `Running`.

**pod-kill** — `chaos/pod-kill.yaml`:

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: shiplog-pod-kill
  namespace: shiplog
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces: [shiplog]
    labelSelectors:
      app: shiplog
  duration: "10s"
```

**network-delay** (100ms on db traffic) — `chaos/network-delay.yaml`:

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: shiplog-db-delay
  namespace: shiplog
spec:
  action: delay
  mode: all
  selector:
    namespaces: [shiplog]
    labelSelectors:
      app: postgres
  delay:
    latency: "100ms"
    jitter: "10ms"
  duration: "5m"
```

**io-stress** — `chaos/io-stress.yaml`:

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: IOChaos
metadata:
  name: shiplog-io-stress
  namespace: shiplog
spec:
  action: latency
  mode: one
  selector:
    namespaces: [shiplog]
    labelSelectors:
      app: postgres
  volumePath: /var/lib/postgresql/data
  path: "**/*"
  delay: "100ms"
  percent: 50
  duration: "3m"
```

**cpu-stress** — `chaos/cpu-stress.yaml`:

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: shiplog-cpu-stress
  namespace: shiplog
spec:
  mode: one
  selector:
    namespaces: [shiplog]
    labelSelectors:
      app: shiplog
  stressors:
    cpu:
      workers: 2
      load: 100
  duration: "3m"
```

Run each experiment the same way: start `k6 run -e TARGET=... k6/load.js` in one terminal, `kubectl apply -f chaos/<experiment>.yaml` in another, watch the Mission 08 RED dashboard during the run, then record the `Result` line in `hypotheses.md` with the actual numbers you saw.

**Checkpoint:** all four experiments have been run, and `hypotheses.md` has a real PASS/FAIL/PARTIAL verdict with numbers for every one — not a guess.

## Phase 4 — Fixes loop

Every hypothesis that came back FAIL or PARTIAL becomes a work item. Common outcomes and their fixes:

- **pod-kill fails the hypothesis** (error rate spikes) → shiplog has no `PodDisruptionBudget`. Add one:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: shiplog-pdb
  namespace: shiplog
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: shiplog
```

- **network-delay fails** (requests time out instead of degrading) → the app has no retry/timeout policy on its DB calls. Add a bounded retry with backoff in `app/db.py` (2 retries, exponential backoff starting at 100ms).
- **io-stress or cpu-stress fails** → if Postgres is a single replica (as built in Mission 04/05), this is often an **acknowledged, not fixed** risk — write that down explicitly in `hypotheses.md` rather than pretending a real fix exists. Honesty here is the graded behavior, not a workaround.

Re-run the failed experiment after each fix and update the hypothesis result to reflect the retest.

## Phase 5 — Gameday

Format, in `gameday.md`:

```markdown
# Gameday — [date]

**Duration:** 60 minutes
**Incident commander:** you
**Chaos agent:** Claude (in this session)
**Scenario:** [chosen in advance by the IC, not disclosed to be "fair" — pick one of the four experiments, or a combination, at a randomized time in the window]

## Comms log
| Time | Who | Message |
|------|-----|---------|
| 00:00 | IC | Gameday starts, load running, dashboards up |
| ... | ... | ... |

## SLO tracking
[snapshot the Mission 08 SLO burn-rate panel at the start, and again at the end]
```

Run it for real: start `load.js` running for the full 60 minutes, ask Claude (as chaos agent) to inject one or more of the four experiments at a time of Claude's choosing within the window, and keep the comms log live as things happen. Don't pre-script the outcome.

**Checkpoint:** `gameday.md` has a complete comms log covering the full 60 minutes and a before/after SLO snapshot.

## Phase 6 — Postmortems

Template, `postmortems/template.md`:

```markdown
# Postmortem: [title]

**Date:** 
**Duration of impact:** 
**Severity:** 

## Timeline
(UTC timestamps, factual, no blame)

## Impact
(what broke, who/what was affected, SLO burn consumed)

## Root cause
(the actual technical cause — not "human error", the system condition that allowed it)

## Contributing factors
(things that made it worse or made detection slower)

## Action items
1. 
2. 
3. 
```

Write two real postmortems from the actual chaos/gameday runs you did in Phases 3 and 5 — not hypothetical ones. Each needs at least 3 concrete action items (e.g. "add PDB to shiplog", "add retry/backoff to db.py", "add alert for DB connection pool exhaustion").

## Phase 7 — Error budget policy

Using the Mission 08 SLO (99% availability), compute the budget:

```
Error budget = (1 - 0.99) × total requests in window
             = 1% of monthly request volume allowed to fail
```

Write `error-budget-policy.md`:

```markdown
# Error Budget Policy — shiplog

**SLO:** 99% availability (30-day rolling window)
**Budget:** 1% of requests may fail per 30-day window

## Burn-rate response policy

- **Budget consumed >50%:** Slack/notify the on-call channel; new risky deploys require the IC to sign off before merging
- **Budget consumed 100%:** feature freeze — no new feature work ships until the error budget resets or is intentionally reset by an incident review; only reliability fixes may merge
```

## Break-fix drills

1. **k6 thresholds pass locally but fail in CI.** The CI runner shares resources with other jobs — the same load profile against the same target produces different p95 numbers under contention. Diagnose by comparing CPU/memory limits on the CI runner vs. your workstation before concluding the app regressed.
2. **A chaos-mesh experiment won't inject** (`kubectl get podchaos` shows the object but nothing happens). The `selector.namespaces` or `labelSelectors` in the YAML doesn't match any real pod — verify with `kubectl get pods -n shiplog --show-labels` and compare to the selector field by field.

## Prove-it challenges

1. Survive the full 60-minute gameday from Phase 5 with the SLO burn-rate alert never reaching `firing`, **or** if it does fire, produce a postmortem with 3+ real action items from that exact incident.
2. Show, with before/after numbers from `hypotheses.md`, at least one experiment that FAILED on the first run and PASSED after your Phase 4 fix.

## Hints

<details>
<summary>Hints for drills and challenges (open only when stuck)</summary>

- Drill 1: run `kubectl top pods` on the CI runner mid-job if you have access — CPU throttling shows up as p95 inflation with no code change.
- Drill 2: `labelSelectors` is case-sensitive and must match exactly — a selector of `app: shiplog-app` against pods labeled `app: shiplog` matches nothing, silently.
- Challenge 1: don't pick the scenario yourself if you're also the IC — have Claude choose and time the injection so the gameday is a genuine test, not a rehearsal.
- Challenge 2: pod-kill without a PDB is usually the fastest FAIL→PASS story — Kubernetes evicts your last replica before a new one is Ready, and PDB is a one-resource fix.

</details>

## Done when

- [ ] All four k6 scripts (smoke, load, stress, soak) exist and smoke passes clean
- [ ] `hypotheses.md` has four real Given/When/Then hypotheses, each with an actual PASS/FAIL/PARTIAL result and real numbers
- [ ] At least one fix from Phase 4 was applied and its hypothesis re-tested to a better outcome
- [ ] `gameday.md` documents one full 60-minute run with a complete comms log and before/after SLO snapshot
- [ ] Two postmortems exist in `postmortems/`, each with 3+ action items, written from the real drills
- [ ] `error-budget-policy.md` exists with the computed budget and an explicit 50%/100% burn response policy
- [ ] Both break-fix drills solved by diagnosis, hints unopened until stuck
- [ ] Both prove-it challenges completed with evidence (numbers, screenshots, or the postmortem itself)
