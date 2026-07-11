# Mission 02 — Docker Deep

**Track:** devops · **Difficulty:** 💀💀💀 · **Time:** 8-12h
**Prerequisites:** Mission 01

## Goal

Build **shiplog** — the FastAPI URL-shortener with hit-stats and a Postgres backend that every later devops mission depends on — and then containerize it properly. "Properly" means small, non-root, health-checked, cache-friendly to rebuild, scanned clean of known vulnerabilities, and pushed somewhere real. This is the mission where you stop treating `Dockerfile` as "whatever makes `docker build` stop complaining" and start treating it as a production artifact.

## Skills gained

- Writing a real FastAPI + Postgres service against an async driver, with tests that don't need a live database
- Multi-stage Docker builds: builder stage vs. slim runtime stage
- Running containers as a non-root user and wiring up `HEALTHCHECK`
- Docker Compose with a healthcheck-gated `depends_on` so the app never races the database
- Reading and exploiting the layer cache to make rebuilds fast
- Scanning images with `trivy` and fixing findings by pinning base images
- Inspecting layer waste with `dive`
- Tagging and pushing an image to `ghcr.io`

## Deliverables

- [ ] `devops/shiplog/` exists with `app/main.py`, `app/db.py`, `tests/`, `Dockerfile`, `compose.yaml`, `requirements.txt`, `.dockerignore`
- [ ] `pytest` passes locally with no database running
- [ ] `docker compose up` brings up shiplog + Postgres and all 5 endpoints work end to end
- [ ] Final image is under 80MB, runs as a non-root user, and `HEALTHCHECK` reports healthy
- [ ] `trivy image` reports zero HIGH/CRITICAL findings
- [ ] Image pushed to `ghcr.io` and visible in your GitHub packages
- [ ] All three break-fix drills solved and the Prove-It size writeup completed

## Start

Open a Claude Code session in this folder and say: `start devops/02`. Follow GUIDE.md.
