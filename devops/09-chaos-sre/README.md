# Mission 09 — Chaos + SRE

**Track:** devops · **Difficulty:** 💀💀💀💀 · **Time:** 8-12h
**Prerequisites:** Missions 04, 08

## Goal

shiplog has been running on k8s since Mission 04, and since Mission 08 you've had real telemetry — traces, logs, dashboards, and a set of SLOs sitting in Grafana. None of that has been tested against failure yet. This mission puts it under load with `k6` and then breaks it on purpose with `chaos-mesh`, one steady-state hypothesis at a time: state what you expect to stay true under a specific kind of failure, run the experiment, and check the SLO dashboard for the verdict instead of guessing. Whatever fails the hypothesis becomes a real fix — a `PodDisruptionBudget`, a retry policy, an acknowledged single point of failure. Then you run the whole thing for real: a 60-minute gameday, incident-commander role and all, with an error budget policy that decides in advance what happens if things go wrong. This is the mission where "the dashboards look fine" stops being good enough and "I broke it on purpose and watched the SLO hold" becomes the bar.

## Skills gained

- Writing k6 load profiles — smoke, load, stress, soak — with thresholds derived from real SLOs, not arbitrary numbers
- Designing steady-state hypotheses before touching chaos-mesh, so an experiment has a falsifiable outcome instead of just "let's see what breaks"
- Running chaos-mesh experiments (pod-kill, network-delay, io-stress, cpu-stress) against a k8s workload under concurrent load
- Turning a failed hypothesis into a concrete fix: PodDisruptionBudgets, retry/backoff logic, honest acknowledgment of unfixable risk
- Running a gameday: incident commander role, live comms log, SLO tracking under real time pressure
- Writing blameless postmortems that produce action items instead of blame
- Computing an error budget from an SLO and writing a policy that governs what happens when you burn it

## Deliverables

- [ ] Four k6 load profile scripts (smoke, load, stress, soak) with thresholds set from Mission 08's SLOs
- [ ] Four chaos-mesh experiments (pod-kill, network-delay, io-stress, cpu-stress) each run against a written hypothesis, with a verdict
- [ ] One full 60-minute gameday executed end to end, with a live comms log
- [ ] Two postmortems written from the actual drills you ran, each with at least 3 action items
- [ ] An error-budget policy doc: budget computed from the SLO, and a 50%/100% burn-rate response policy

## Start

Open a Claude Code session in this folder and say: `start devops/09`. Follow GUIDE.md.
