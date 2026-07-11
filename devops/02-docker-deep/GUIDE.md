# Guide — Mission 02: Docker Deep

Everything in this mission lives in `devops/shiplog/` in this repo. You'll write the app in Phase 1, then spend the rest of the mission containerizing it correctly. Every command block states where it runs — all of them run on your **Host** machine (wherever Docker and your Python toolchain are installed), there's no VM in this mission.

## Phase 1 — build shiplog with the AI pair

Ask your AI pair to scaffold the files below into `devops/shiplog/`. Read every line before accepting it — you own this code for the rest of the track.

Create `devops/shiplog/requirements.txt`:

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
asyncpg==0.30.0
prometheus-client==0.21.1
```

Create `devops/shiplog/app/__init__.py` (empty file — makes `app` a package):

```bash
mkdir -p devops/shiplog/app devops/shiplog/tests
touch devops/shiplog/app/__init__.py
```

Create `devops/shiplog/app/db.py`:

```python
import os

import asyncpg

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://shiplog:shiplog@localhost:5432/shiplog"
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS links (
    slug TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


async def get_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)


async def init_db(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA)


async def create_link(pool: asyncpg.Pool, slug: str, target: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO links (slug, target) VALUES ($1, $2)", slug, target
        )


async def get_link(pool: asyncpg.Pool, slug: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT slug, target, hits FROM links WHERE slug = $1", slug
        )
        return dict(row) if row else None


async def increment_hits(pool: asyncpg.Pool, slug: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute("UPDATE links SET hits = hits + 1 WHERE slug = $1", slug)


async def get_stats(pool: asyncpg.Pool, slug: str):
    return await get_link(pool, slug)
```

Create `devops/shiplog/app/main.py`:

```python
import random
import string
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

from app import db

app = FastAPI(title="shiplog")

REQUEST_COUNT = Counter(
    "shiplog_requests_total", "Total requests", ["method", "path", "status"]
)
REQUEST_LATENCY = Histogram(
    "shiplog_request_latency_seconds", "Request latency", ["path"]
)

SLUG_ALPHABET = string.ascii_lowercase + string.digits


def make_slug(length: int = 6) -> str:
    return "".join(random.choices(SLUG_ALPHABET, k=length))


@app.on_event("startup")
async def startup() -> None:
    app.state.pool = await db.get_pool()
    await db.init_db(app.state.pool)


@app.on_event("shutdown")
async def shutdown() -> None:
    await app.state.pool.close()


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    REQUEST_LATENCY.labels(path=request.url.path).observe(time.perf_counter() - start)
    REQUEST_COUNT.labels(
        method=request.method, path=request.url.path, status=response.status_code
    ).inc()
    return response


@app.post("/links", status_code=201)
async def create_link(body: dict):
    target = body.get("target")
    if not target:
        raise HTTPException(400, "target is required")
    slug = body.get("slug") or make_slug()
    if await db.get_link(app.state.pool, slug):
        raise HTTPException(409, f"slug '{slug}' already taken")
    await db.create_link(app.state.pool, slug, target)
    return {"slug": slug, "target": target, "short_url": f"/{slug}"}


@app.get("/stats/{slug}")
async def stats(slug: str):
    row = await db.get_stats(app.state.pool, slug)
    if not row:
        raise HTTPException(404, "slug not found")
    return {"slug": row["slug"], "target": row["target"], "hits": row["hits"]}


@app.get("/healthz")
async def healthz():
    try:
        async with app.state.pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception as exc:
        raise HTTPException(503, f"db unreachable: {exc}")
    return {"status": "ok"}


@app.get("/metrics")
async def metrics():
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/{slug}")
async def redirect(slug: str):
    link = await db.get_link(app.state.pool, slug)
    if not link:
        raise HTTPException(404, "slug not found")
    await db.increment_hits(app.state.pool, slug)
    return RedirectResponse(url=link["target"], status_code=307)
```

Note the route order: `/stats/{slug}`, `/healthz`, and `/metrics` are all declared **before** the catch-all `GET /{slug}`. FastAPI matches routes in declaration order — if the catch-all came first it would swallow `/healthz` and `/metrics` as if they were slugs.

Create `devops/shiplog/tests/test_main.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app import db, main


class FakeConn:
    async def fetchval(self, query):
        return 1


class FakeConnCtx:
    async def __aenter__(self):
        return FakeConn()

    async def __aexit__(self, *exc):
        return False


class FakePool:
    def acquire(self):
        return FakeConnCtx()

    async def close(self):
        pass


@pytest.fixture
def client(monkeypatch):
    store = {}

    async def fake_get_pool():
        return FakePool()

    async def fake_init_db(pool):
        pass

    async def fake_create_link(pool, slug, target):
        store[slug] = {"slug": slug, "target": target, "hits": 0}

    async def fake_get_link(pool, slug):
        return store.get(slug)

    async def fake_increment_hits(pool, slug):
        if slug in store:
            store[slug]["hits"] += 1

    async def fake_get_stats(pool, slug):
        return store.get(slug)

    monkeypatch.setattr(db, "get_pool", fake_get_pool)
    monkeypatch.setattr(db, "init_db", fake_init_db)
    monkeypatch.setattr(db, "create_link", fake_create_link)
    monkeypatch.setattr(db, "get_link", fake_get_link)
    monkeypatch.setattr(db, "increment_hits", fake_increment_hits)
    monkeypatch.setattr(db, "get_stats", fake_get_stats)

    with TestClient(main.app) as c:
        yield c


def test_create_and_redirect(client):
    resp = client.post(
        "/links", json={"target": "https://example.com", "slug": "ex1"}
    )
    assert resp.status_code == 201
    assert resp.json() == {
        "slug": "ex1",
        "target": "https://example.com",
        "short_url": "/ex1",
    }

    resp = client.get("/ex1", follow_redirects=False)
    assert resp.status_code == 307
    assert resp.headers["location"] == "https://example.com"


def test_stats_and_404(client):
    client.post("/links", json={"target": "https://example.com", "slug": "ex2"})
    client.get("/ex2", follow_redirects=False)

    resp = client.get("/stats/ex2")
    assert resp.status_code == 200
    assert resp.json() == {"slug": "ex2", "target": "https://example.com", "hits": 1}

    resp = client.get("/stats/nope")
    assert resp.status_code == 404


def test_healthz(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

Install and run:

```bash
cd devops/shiplog
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt pytest
pytest -v
```

Expected output:

```
tests/test_main.py::test_create_and_redirect PASSED
tests/test_main.py::test_stats_and_404 PASSED
tests/test_main.py::test_healthz PASSED

3 passed in 0.4s
```

**Checkpoint:** `pytest` is green — all 3 tests pass, and none of them needed a running Postgres.

## Phase 2 — the naive Dockerfile, then the real one

First, the Dockerfile everyone writes on day one. Create `devops/shiplog/Dockerfile`:

```dockerfile
FROM python:3.12
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build it and measure:

```bash
docker build -t shiplog:naive .
docker images shiplog:naive
```

Expected output (size will vary slightly by patch version, but it's big):

```
REPOSITORY   TAG      IMAGE ID       CREATED          SIZE
shiplog      naive    a1b2c3d4e5f6   10 seconds ago   1.03GB
```

Over a gigabyte for a URL shortener. `python:3.12` is the full Debian image with build toolchains and docs baked in — none of which your running container needs. Now the real one. Overwrite `devops/shiplog/Dockerfile`:

```dockerfile
# ---- builder ----
FROM python:3.12-slim AS builder
WORKDIR /app
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- runtime ----
FROM python:3.12-slim
RUN groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app
WORKDIR /app
COPY --from=builder /venv /venv
COPY app app
ENV PATH="/venv/bin:$PATH"
USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

The builder stage installs packages into a venv with full build tooling available; the runtime stage copies only the finished venv and your app code onto a fresh slim base — none of pip's build artifacts, caches, or compilers make it into the final image. `USER app` means the process never runs as root inside the container, and `HEALTHCHECK` gives Docker (and Compose, later) a real way to know if the app is actually serving traffic, not just that the process is alive.

Build and compare:

```bash
docker build -t shiplog:latest .
docker images shiplog
```

Expected output:

```
REPOSITORY   TAG      IMAGE ID       CREATED          SIZE
shiplog      latest   f6e5d4c3b2a1   5 seconds ago    178MB
shiplog      naive    a1b2c3d4e5f6   3 minutes ago    1.03GB
```

Run it standalone to confirm it starts (it'll complain about the database — that's expected, there isn't one yet):

```bash
docker run --rm -p 8000:8000 --name shiplog-solo shiplog:latest
```

Expected output: uvicorn starts, then a connection error trying to reach Postgres at `localhost:5432` — that's correct, you haven't wired up a database container yet. Stop it with `Ctrl+C`.

**Checkpoint:** `shiplog:latest` builds successfully and is roughly 5-6x smaller than `shiplog:naive`.

## Phase 3 — `.dockerignore` and the layer cache

Create `devops/shiplog/.dockerignore`:

```
__pycache__/
*.pyc
.pytest_cache/
.venv/
venv/
.git/
tests/
*.md
Dockerfile*
compose.yaml
.dockerignore
```

Without it, Docker sends your `.venv/` and `.git/` history into the build context on every build — slow, and it can leak things you didn't mean to ship.

Now the layer-cache experiment. Docker caches each instruction's result and reuses it if nothing above it in the file (and nothing in the files it reads) changed. Because `COPY requirements.txt .` + `RUN pip install` happen **before** `COPY app app`, editing your Python code should never bust the dependency-install cache.

Time a rebuild after touching only application code:

```bash
touch app/main.py
time docker build -t shiplog:latest .
```

Expected output: the `pip install` layer shows `CACHED`, only the final `COPY app app` layer and everything after it re-runs — total time under 2 seconds:

```
 => CACHED [builder 4/4] RUN pip install --no-cache-dir -r requirements.txt
 => [stage-1 4/6] COPY app app
 ...
real    0m1.8s
```

Now time a rebuild after touching `requirements.txt`:

```bash
echo "" >> requirements.txt
time docker build -t shiplog:latest .
```

Expected output: the cache breaks at the `COPY requirements.txt .` layer and everything below it — including the full `pip install` — re-runs, taking noticeably longer:

```
 => [builder 3/4] COPY requirements.txt .
 => [builder 4/4] RUN pip install --no-cache-dir -r requirements.txt
 ...
real    0m8.4s
```

This is why dependency files are copied and installed *before* application code in a well-ordered Dockerfile — code changes constantly, dependencies change rarely, and the cache should reflect that.

**Checkpoint:** you can point to the exact log line where a code-only change hits `CACHED` on the pip-install layer, and the exact line where a `requirements.txt` change busts it.

## Phase 4 — Compose: app + Postgres

Create `devops/shiplog/compose.yaml`:

```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://shiplog:shiplog@db:5432/shiplog
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: shiplog
      POSTGRES_PASSWORD: shiplog
      POSTGRES_DB: shiplog
    volumes:
      - shiplog-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shiplog -d shiplog"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  shiplog-data:
```

`depends_on.condition: service_healthy` is the important part — without it, Compose only waits for the `db` container to *start*, not for Postgres inside it to actually be ready to accept connections. `app` would race Postgres's startup and crash on the first connection attempt.

Bring it up:

```bash
docker compose up -d --build
docker compose ps
```

Expected output:

```
NAME              IMAGE            STATUS
shiplog-app-1     shiplog-app      Up 5 seconds (healthy)
shiplog-db-1      postgres:16      Up 10 seconds (healthy)
```

Exercise every endpoint:

```bash
curl -s -X POST localhost:8000/links -H "Content-Type: application/json" -d '{"target":"https://anthropic.com","slug":"claude"}'
```

Expected output:

```json
{"slug":"claude","target":"https://anthropic.com","short_url":"/claude"}
```

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" localhost:8000/claude
```

Expected output:

```
307 -> https://anthropic.com
```

```bash
curl -s localhost:8000/stats/claude
```

Expected output:

```json
{"slug":"claude","target":"https://anthropic.com","hits":1}
```

```bash
curl -s localhost:8000/healthz
```

Expected output:

```json
{"status":"ok"}
```

```bash
curl -s localhost:8000/metrics | grep shiplog_requests_total
```

Expected output (counts will differ based on how many requests you've made):

```
shiplog_requests_total{method="POST",path="/links",status="201"} 1.0
shiplog_requests_total{method="GET",path="/{slug}",status="307"} 1.0
```

**Checkpoint:** creating a link via `POST /links` and then `GET /<slug>` actually redirects to the target — the full app + Postgres round trip works.

## Phase 5 — trivy scan

Scan the image you built in Phase 2:

```bash
trivy image --severity HIGH,CRITICAL shiplog:latest
```

Expected output: some number of HIGH/CRITICAL findings in OS packages pulled in by the current `python:3.12-slim` tag (exact CVE IDs and counts drift over time as the base image updates):

```
shiplog:latest (debian 12.7)
==============================
Total: 3 (HIGH: 2, CRITICAL: 1)

┌──────────┬────────────────┬──────────┬──────────────────┐
│ Library  │ Vulnerability  │ Severity │ Fixed Version    │
├──────────┼────────────────┼──────────┼──────────────────┤
│ libssl3  │ CVE-2024-XXXXX │ CRITICAL │ 3.0.13-1~deb12u1  │
└──────────┴────────────────┴──────────┴──────────────────┘
```

The floating `python:3.12-slim` tag you pulled weeks ago can lag behind the patched packages available today. Pin to a specific, current patch release instead of the rolling tag. Check the current recommended tag on Docker Hub, then update both `FROM` lines in `devops/shiplog/Dockerfile`:

```dockerfile
FROM python:3.12.8-slim-bookworm AS builder
...
FROM python:3.12.8-slim-bookworm
```

Rebuild and rescan:

```bash
docker build -t shiplog:latest .
trivy image --severity HIGH,CRITICAL shiplog:latest
```

Expected output:

```
shiplog:latest (debian 12.8)
==============================
Total: 0 (HIGH: 0, CRITICAL: 0)
```

If you still see findings after pinning, re-run `trivy image --severity HIGH,CRITICAL --list-all-pkgs shiplog:latest` to see exactly which package is unpatched, and check whether a newer `-slim-bookworm` tag has already fixed it — base image patch levels move fast.

**Checkpoint:** `trivy image --severity HIGH,CRITICAL shiplog:latest` reports `Total: 0`.

## Phase 6 — dive: find the waste

Install `dive` if you haven't, then inspect the image layer by layer:

```bash
dive shiplog:latest
```

Expected output: an interactive TUI split into a layer list (left) and a filesystem tree (right), with a "Wasted space" figure at the bottom.

Walk each layer with the arrow keys. Look specifically at:

- The `pip install` layer — is there a `pip` cache directory that survived despite `--no-cache-dir`? (There shouldn't be, but verify it.)
- The final `COPY app app` layer — confirm it contains only your `app/` directory, nothing from `.dockerignore`.
- The base `python:3.12.8-slim-bookworm` layers — these are shared with every other image using the same base, so don't worry about their absolute size, focus on layers *you* added.

Press `Ctrl+C` to exit. Note the "efficiency score" percentage `dive` reports — this is your baseline before the Prove-It squeeze in this mission's closing task.

**Checkpoint:** you can name, from the `dive` output, which single layer you added is the largest, and whether it contains anything that shouldn't be there.

## Phase 7 — push to ghcr.io

Create a GitHub Personal Access Token (classic) with the `write:packages` scope from your GitHub account settings, and export it — never paste it directly into a command that gets logged:

```bash
export CR_PAT=<paste your token>
echo $CR_PAT | docker login ghcr.io -u <your-github-username> --password-stdin
```

Expected output:

```
Login Succeeded
```

Tag and push:

```bash
docker tag shiplog:latest ghcr.io/<your-github-username>/shiplog:0.1.0
docker push ghcr.io/<your-github-username>/shiplog:0.1.0
```

Expected output:

```
The push refers to repository [ghcr.io/<your-github-username>/shiplog]
5f70bf18a086: Pushed
a3f8c9d2e1b4: Pushed
0.1.0: digest: sha256:1a2b3c... size: 1789
```

**Checkpoint:** the package is visible at `https://github.com/<your-github-username>?tab=packages`, listed as `shiplog`, tag `0.1.0`.

## Break-fix drills (no inline solutions)

**Drill 1 — works alone, dies in Compose.** `docker run` against your local Postgres works fine. Under `docker compose up`, the `app` container crashes on startup with a connection error. Something about how the app finds the database differs between the two environments — find it and fix it in the right file (not by hardcoding an IP).

**Drill 2 — permission denied on the volume.** Add a step to the app container that writes a small file to a mounted path at startup (ask your AI pair to add one line for this drill only). It fails with a permission error even though the exact same code worked when the container ran as root. Diagnose why a non-root `USER` changes this and fix ownership correctly — without switching back to root.

**Drill 3 — the healthcheck flaps.** Generate load against the app (a quick loop of concurrent `curl` requests works) and watch `docker compose ps` while it runs. The `app` container's status flips between `healthy` and `unhealthy` under load even though every request is still succeeding. Figure out which `HEALTHCHECK` parameter is too tight for the load and correct it.

## Prove-it: shrink it, don't break it

Get the runtime image under 80MB **without** breaking `pytest` or any endpoint. Starting from the Phase 5 image, try things like: trimming unnecessary `apt`/pip metadata, checking whether `uvicorn[standard]`'s extra dependencies (`uvloop`, `httptools`, `websockets`) are worth their size for this workload versus plain `uvicorn`, and confirming the builder stage truly isn't leaking build tools into the runtime stage.

For every change, write down: the MB saved, and what it cost you (slower builds, a lost dependency, more manual pinning, etc. — or nothing, if it was free). Acceptance: `docker images shiplog:latest` reports a size under 80MB, `pytest` is still fully green, and all 5 endpoints still work through `docker compose up`.

## Hints

<details>
<summary>Hints for drills and the Prove-It (open only when stuck)</summary>

- **Drill 1:** `localhost` inside a container refers to that container's own network namespace, not the host or a sibling container. Compose gives every service a DNS name equal to its service name on the shared network — check what `DATABASE_URL` is set to in each environment.
- **Drill 2:** the mounted path's ownership was set by whichever user first wrote to it. If that was `root` (the image's original default user, or a prior run), a later non-root `USER` can't write there anymore. Look at fixing ownership either in the Dockerfile before switching `USER`, or via the volume's mount options — not by making the app run as root again.
- **Drill 3:** `interval` and `timeout` interact with how long a slow-but-alive request takes under load. If `timeout` is shorter than the app's worst-case response time when busy, Docker marks a live app "unhealthy." Compare your healthcheck's `timeout` against how long `/healthz` actually takes when the app is under concurrent load.
- **Prove-It:** `uvicorn[standard]`'s extras pull in compiled dependencies you may not need for a learning-stage service — plain `uvicorn` with the default asyncio loop is smaller and still correct. Also double check with `dive` that nothing from the builder stage (a C compiler, `pip`'s own cache, `.dist-info` docs) is riding along in the final `COPY --from=builder` layer.

</details>

## Done when

- [ ] `devops/shiplog/` contains `app/main.py`, `app/db.py`, `tests/test_main.py`, `Dockerfile`, `compose.yaml`, `requirements.txt`, `.dockerignore`
- [ ] `pytest` passes with 3/3 green and no database running
- [ ] The naive Dockerfile and the multi-stage Dockerfile were both built, and their sizes were compared directly
- [ ] A code-only rebuild hit the pip-install cache; a `requirements.txt` rebuild busted it — both observed in the build log
- [ ] `docker compose up` runs app + Postgres with a healthcheck-gated `depends_on`, and all 5 endpoints were exercised with curl and returned the expected JSON
- [ ] `trivy image --severity HIGH,CRITICAL` reports zero findings after pinning the base image
- [ ] `dive` was used to inspect the image and identify the largest layer you added
- [ ] The image was pushed to `ghcr.io` and is visible in your GitHub packages
- [ ] All three break-fix drills solved
- [ ] Prove-It complete: final image under 80MB, `pytest` still green, every MB saved documented with its cost
