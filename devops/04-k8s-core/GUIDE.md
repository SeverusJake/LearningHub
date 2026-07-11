# Mission 04 Guide — K8s Core

This guide is not a script to paste blindly. Read each phase, run the commands, and actually look at the output before moving on — every phase ends in a checkpoint that proves you understand what happened, not just that a command exited zero.

## What you're starting from

You need the shiplog image built and pushed in Mission 02, sitting on `ghcr.io`. Everywhere below, replace `ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.0` with your actual image reference and tag. Confirm it pulls before you start:

```bash
docker pull ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.0
```
Expected output: `Status: Downloaded newer image` (or `Image is up to date`).

**If your GHCR repo is private** (the default for personal repos), `kind`'s nodes won't be able to pull it without credentials. Create a pull secret now — you'll wire it into the Deployment in Phase 2:

```bash
kubectl create secret docker-registry regcred \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GH_USERNAME \
  --docker-password=YOUR_GITHUB_PAT_WITH_read:packages_SCOPE \
  --namespace=shiplog \
  --dry-run=client -o yaml > regcred-secret.yaml
```
Keep `regcred-secret.yaml` next to your other manifests — you'll `kubectl apply` it once the `shiplog` namespace exists in Phase 2. (If your image is public, skip this — you can delete the file later.)

Make a working directory for every manifest you write in this mission:
```bash
mkdir -p manifests
```

---

## Phase 1 — 3-node kind cluster with ingress port mappings

A single-node cluster hides real scheduling and networking behavior. Three nodes — one control-plane, two workers — forces the scheduler to make actual placement decisions and lets you see `NetworkPolicy` and `Service` routing work across node boundaries, not just inside one.

Write the cluster config:

```bash
cat <<'EOF' > kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: shiplog
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
EOF
```

The `ingress-ready=true` label and the two `extraPortMappings` exist for one reason: `ingress-nginx`'s kind-specific manifest (Phase 3) targets a node carrying that label with `hostNetwork: true`, and kind only forwards host ports 80/443 into the cluster if you declare the mapping here at create time — you cannot bolt it on afterward without recreating the cluster.

Create the cluster:

```bash
kind create cluster --config kind-config.yaml
```
Expected output (last lines):
```
Set kubectl context to "kind-shiplog"
You can now use your cluster with:

kubectl cluster-info --context kind-shiplog
```

Inspect the nodes:

```bash
kubectl get nodes -o wide
```
Expected output: three lines, all `STATUS Ready` after a minute or so (the control-plane may show `NotReady` for the first ~30-60s while its own networking add-ons finish starting):
```
NAME                    STATUS   ROLES           AGE   VERSION
shiplog-control-plane   Ready    control-plane   90s   v1.3x.x
shiplog-worker          Ready    <none>          75s   v1.3x.x
shiplog-worker2         Ready    <none>          75s   v1.3x.x
```

Confirm it's really three separate containers, not one node pretending:

```bash
docker ps --filter "label=io.x-k8s.kind.cluster=shiplog" --format "table {{.Names}}\t{{.Status}}"
```
Expected output: three running containers, `shiplog-control-plane`, `shiplog-worker`, `shiplog-worker2`.

Confirm the ingress label landed where you expect:

```bash
kubectl get nodes --selector=ingress-ready=true -o name
```
Expected output: `node/shiplog-control-plane` only.

**Checkpoint:** `kubectl get nodes` shows all 3 nodes `Ready`, and exactly one of them (`shiplog-control-plane`) carries `ingress-ready=true`.

---

## Phase 2 — raw manifests for shiplog

No Helm here — every manifest is written by hand so you actually understand what a chart would be templating for you later, in Mission 05. Postgres runs as a plain Deployment + PVC for now; that's a known simplification (a single Postgres pod backed by a PVC has no protection against a node failure taking the data with it) — Mission 05 replaces it with a proper StatefulSet.

**Namespace:**

```bash
cat <<'EOF' > manifests/00-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: shiplog
EOF
kubectl apply -f manifests/00-namespace.yaml
```

If you created `regcred-secret.yaml` in the pre-flight step, apply it now that the namespace exists:
```bash
kubectl apply -f regcred-secret.yaml
```

**ConfigMap** — non-secret app settings:

```bash
cat <<'EOF' > manifests/01-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: shiplog-config
  namespace: shiplog
data:
  APP_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "8000"
EOF
kubectl apply -f manifests/01-configmap.yaml
```

**Secret** — the Postgres password and the full DB connection string. `stringData` gets base64-encoded by the API server on write, so you type plain text here and never hand-encode anything:

```bash
cat <<'EOF' > manifests/02-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: shiplog-secret
  namespace: shiplog
type: Opaque
stringData:
  POSTGRES_PASSWORD: "changeme-supersecret"
  DATABASE_URL: "postgresql://shiplog:changeme-supersecret@shiplog-db:5432/shiplog"
EOF
kubectl apply -f manifests/02-secret.yaml
```

**Postgres PVC:**

```bash
cat <<'EOF' > manifests/03-postgres-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shiplog-db-pvc
  namespace: shiplog
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 1Gi
EOF
kubectl apply -f manifests/03-postgres-pvc.yaml
```

`standard` is kind's default `StorageClass` (backed by the `rancher.io/local-path` provisioner) — confirm it exists before moving on:
```bash
kubectl get storageclass
```
Expected output: one line, `standard (default) ... rancher.io/local-path`.

**Postgres Deployment + Service:**

```bash
cat <<'EOF' > manifests/04-postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shiplog-db
  namespace: shiplog
  labels:
    app: shiplog-db
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: shiplog-db
  template:
    metadata:
      labels:
        app: shiplog-db
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: "shiplog"
            - name: POSTGRES_USER
              value: "shiplog"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: shiplog-secret
                  key: POSTGRES_PASSWORD
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: db-storage
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "shiplog"]
            initialDelaySeconds: 5
            periodSeconds: 5
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "shiplog"]
            initialDelaySeconds: 15
            periodSeconds: 10
      volumes:
        - name: db-storage
          persistentVolumeClaim:
            claimName: shiplog-db-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: shiplog-db
  namespace: shiplog
spec:
  selector:
    app: shiplog-db
  ports:
    - port: 5432
      targetPort: 5432
EOF
kubectl apply -f manifests/04-postgres-deployment.yaml
```

`strategy: Recreate` matters here: a `RollingUpdate` on a single-replica Deployment backed by a `ReadWriteOnce` PVC would try to start a second pod before killing the first, and the second pod would sit `Pending` forever waiting for a volume that's already attached. `Recreate` kills the old pod first.

**shiplog app Deployment + Service:**

```bash
cat <<'EOF' > manifests/05-shiplog-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shiplog
  namespace: shiplog
  labels:
    app: shiplog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shiplog
  template:
    metadata:
      labels:
        app: shiplog
    spec:
      imagePullSecrets:
        - name: regcred
      containers:
        - name: shiplog
          image: ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.0
          ports:
            - containerPort: 8000
          envFrom:
            - configMapRef:
                name: shiplog-config
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: shiplog-secret
                  key: DATABASE_URL
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8000
            initialDelaySeconds: 3
            periodSeconds: 5
            failureThreshold: 2
---
apiVersion: v1
kind: Service
metadata:
  name: shiplog-svc
  namespace: shiplog
spec:
  selector:
    app: shiplog
  ports:
    - port: 80
      targetPort: 8000
EOF
kubectl apply -f manifests/05-shiplog-deployment.yaml
```

(If your image is public, delete the `imagePullSecrets` block above — an empty/missing secret named `regcred` will otherwise leave the pod `ContainerCreating` forever waiting on a Secret that doesn't exist.)

Liveness and readiness hit the same `/healthz` endpoint here on purpose, with different timing: liveness asks "is this process alive at all, or should the kubelet kill and restart it?"; readiness asks "is this pod ready to receive traffic right now, or should the Service pull it out of its endpoint list?" A pod can fail readiness (temporarily overloaded, still warming up) without needing a restart — that distinction is exactly what you'll break on purpose in the OOMKilled and CrashLoopBackOff drills later.

**Checkpoint:**
```bash
kubectl get pods -n shiplog -o wide
```
Expected output: 3 pods (`shiplog-db-xxxxx`, `shiplog-xxxxx` ×2), all `STATUS Running`, all `READY 1/1`, spread across your two worker nodes.

```bash
kubectl exec -n shiplog deploy/shiplog -- curl -sf localhost:8000/healthz
```
Expected output: a `200`-backed response body from your app (e.g. `{"status":"ok"}`) — confirms the app can reach Postgres over `DATABASE_URL` and answer its own health check from inside the pod, before you add ingress on top.

---

## Phase 3 — ingress-nginx

**Install ingress-nginx's kind-specific manifest** (it's pre-wired with a `nodeSelector` for `ingress-ready=true` and `hostNetwork: true`, matching what you set up in Phase 1):

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
```
Expected output: a stream of `namespace/ingress-nginx created`, `serviceaccount/... created`, `configmap/... created`, ending with `deployment.apps/ingress-nginx-controller created`.

Wait for the controller pod to actually be ready (it isn't the moment `apply` returns):

```bash
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```
Expected output: `pod/ingress-nginx-controller-xxxxxxxxx-xxxxx condition met`.

**Ingress manifest** for shiplog:

```bash
cat <<'EOF' > manifests/06-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shiplog-ingress
  namespace: shiplog
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: shiplog.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: shiplog-svc
                port:
                  number: 80
EOF
kubectl apply -f manifests/06-ingress.yaml
```

Confirm the Ingress picked up an address:
```bash
kubectl get ingress -n shiplog
```
Expected output: `shiplog-ingress   nginx   shiplog.local   localhost   80` (the `ADDRESS` column may take a few seconds to populate).

Because the control-plane node maps host ports 80/443 to itself, `localhost` on your machine now *is* the ingress. Send the `Host` header manually rather than editing `/etc/hosts` (either works — this is the faster path):

```bash
curl -sf -H "Host: shiplog.local" http://localhost/healthz -w "\nHTTP_STATUS:%{http_code}\n"
```
Expected output: your app's health JSON body, followed by `HTTP_STATUS:200`.

If you'd rather browse it normally, add a hosts entry instead (`127.0.0.1 shiplog.local` in `/etc/hosts` on Linux/macOS, or `C:\Windows\System32\drivers\etc\hosts` on Windows, run as Administrator) and hit `http://shiplog.local/healthz` directly.

**Checkpoint:** `curl` through the ingress returns `HTTP_STATUS:200` from `/healthz` — traffic is flowing `localhost → kind control-plane hostPort → ingress-nginx → shiplog-svc → shiplog pod`, not a shortcut around it.

---

## Phase 4 — rollout mechanics

If you only pushed one tag in Mission 02, build and push a second one now so you have two real, distinct tags to roll between:
```bash
docker tag ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.0 ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.1
docker push ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.1
```

**Trigger a rollout** by changing the image tag:
```bash
kubectl set image deployment/shiplog shiplog=ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.1 -n shiplog
```
Expected output: `deployment.apps/shiplog image updated`.

**Watch it happen:**
```bash
kubectl rollout status deployment/shiplog -n shiplog
```
Expected output:
```
Waiting for deployment "shiplog" rollout to finish: 1 out of 2 new replicas have been updated...
deployment "shiplog" successfully rolled out
```

Check the history it recorded:
```bash
kubectl rollout history deployment/shiplog -n shiplog
```
Expected output: a `REVISION` table with at least 2 entries.

**Undo it** — pretend `0.2.1` was bad:
```bash
kubectl rollout undo deployment/shiplog -n shiplog
kubectl rollout status deployment/shiplog -n shiplog
```
Expected output: rollout completes again, and:
```bash
kubectl get deployment shiplog -n shiplog -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```
Expected output: back to `ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.0`.

**maxSurge / maxUnavailable experiment.** Scale up first so the surge behavior is visible across more than 2 pods:
```bash
kubectl scale deployment/shiplog -n shiplog --replicas=4
```

Patch the strategy to zero-downtime (extra capacity during rollout, never fewer than desired):
```bash
kubectl patch deployment shiplog -n shiplog --type=merge -p '{"spec":{"strategy":{"rollingUpdate":{"maxSurge":1,"maxUnavailable":0}}}}'
kubectl set image deployment/shiplog shiplog=ghcr.io/YOUR_GH_USERNAME/shiplog:0.2.1 -n shiplog
kubectl get pods -n shiplog -l app=shiplog -w
```
Expected output (Ctrl+C once it settles): pod count briefly rises to 5 (4 desired + 1 surge) before old pods terminate — it never drops below 4.

Now the opposite — no extra capacity, but capacity can dip during rollout:
```bash
kubectl patch deployment shiplog -n shiplog --type=merge -p '{"spec":{"strategy":{"rollingUpdate":{"maxSurge":0,"maxUnavailable":1}}}}'
kubectl rollout restart deployment/shiplog -n shiplog
kubectl get pods -n shiplog -l app=shiplog -w
```
Expected output: pod count briefly drops to 3 (one old pod terminated before its replacement is ready) — it never exceeds 4.

**Checkpoint:** you watched pod counts rise above desired with `maxSurge:1/maxUnavailable:0`, and dip below desired with `maxSurge:0/maxUnavailable:1`, and you can state which one you'd pick for a production API versus a batch job.

---

## Phase 5 — RBAC: least privilege for shiplog

**ServiceAccount with zero permissions** — a plain ServiceAccount grants nothing by itself; RBAC is additive and default-deny:

```bash
cat <<'EOF' > manifests/07-serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: shiplog-sa
  namespace: shiplog
EOF
kubectl apply -f manifests/07-serviceaccount.yaml
```

Wire it into the Deployment and roll the pods onto it:
```bash
kubectl patch deployment shiplog -n shiplog --type=merge -p '{"spec":{"template":{"spec":{"serviceAccountName":"shiplog-sa"}}}}'
kubectl rollout status deployment/shiplog -n shiplog
```

**Prove it has no permissions:**
```bash
kubectl auth can-i list pods -n shiplog --as=system:serviceaccount:shiplog:shiplog-sa
```
Expected output: `no`

```bash
kubectl auth can-i list secrets -n shiplog --as=system:serviceaccount:shiplog:shiplog-sa
```
Expected output: `no`

**Grant exactly one permission** — `list`/`get`/`watch` on pods, nothing else:

```bash
cat <<'EOF' > manifests/08-rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: shiplog-pod-reader
  namespace: shiplog
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: shiplog-pod-reader-binding
  namespace: shiplog
subjects:
  - kind: ServiceAccount
    name: shiplog-sa
    namespace: shiplog
roleRef:
  kind: Role
  name: shiplog-pod-reader
  apiGroup: rbac.authorization.k8s.io
EOF
kubectl apply -f manifests/08-rbac.yaml
```

**Re-prove permissions, precisely:**
```bash
kubectl auth can-i list pods -n shiplog --as=system:serviceaccount:shiplog:shiplog-sa
```
Expected output: `yes`

```bash
kubectl auth can-i delete pods -n shiplog --as=system:serviceaccount:shiplog:shiplog-sa
```
Expected output: `no`

```bash
kubectl auth can-i list secrets -n shiplog --as=system:serviceaccount:shiplog:shiplog-sa
```
Expected output: `no`

```bash
kubectl auth can-i list pods -n default --as=system:serviceaccount:shiplog:shiplog-sa
```
Expected output: `no` — a `Role`/`RoleBinding` is namespace-scoped; this ServiceAccount can list pods in `shiplog` only, nowhere else.

**Checkpoint:** all four `can-i` checks above return exactly the shown value — one `yes`, three `no`. If the app itself never actually calls the k8s API, this whole ServiceAccount is a security-hardening exercise, not a functional requirement — and that's the point: least privilege applies even when nothing appears to need it yet.

---

## Phase 6 — NetworkPolicy: default-deny, then narrow allows

By default, k8s networking is flat — every pod can reach every other pod, any namespace, no restrictions. `NetworkPolicy` is opt-in and additive-only per pod: the moment *any* policy selects a pod, that pod's traffic (for whichever direction the policy declares) is default-denied except for what policies explicitly allow. Zero policies = zero restrictions; one default-deny policy = everything blocked until you add allows back one at a time.

**1. Default-deny everything, both directions:**

```bash
cat <<'EOF' > manifests/09-netpol-default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: shiplog
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
EOF
kubectl apply -f manifests/09-netpol-default-deny.yaml
```

**2. Allow DNS egress** (every pod needs to resolve names — without this, nothing works at all, including the allows you're about to add):

```bash
cat <<'EOF' > manifests/10-netpol-allow-dns.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: shiplog
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
EOF
kubectl apply -f manifests/10-netpol-allow-dns.yaml
```

**3. Allow ingress-nginx → app** (only the ingress controller's namespace may reach shiplog pods, on the app port only):

```bash
cat <<'EOF' > manifests/11-netpol-allow-ingress-to-app.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-app
  namespace: shiplog
spec:
  podSelector:
    matchLabels:
      app: shiplog
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8000
EOF
kubectl apply -f manifests/11-netpol-allow-ingress-to-app.yaml
```

(Kubernetes 1.21+ auto-labels every namespace with `kubernetes.io/metadata.name`, so this works with no extra setup. Confirm with `kubectl get ns ingress-nginx --show-labels` if you want to see it.)

**4. Allow app → db** — this needs *two* policies, one per side, because `NetworkPolicy` is directional and the default-deny above locked down both the app's egress and the db's ingress independently:

```bash
cat <<'EOF' > manifests/12-netpol-allow-app-to-db.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-egress-to-db
  namespace: shiplog
spec:
  podSelector:
    matchLabels:
      app: shiplog
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: shiplog-db
      ports:
        - protocol: TCP
          port: 5432
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-db-ingress-from-app
  namespace: shiplog
spec:
  podSelector:
    matchLabels:
      app: shiplog-db
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: shiplog
      ports:
        - protocol: TCP
          port: 5432
EOF
kubectl apply -f manifests/12-netpol-allow-app-to-db.yaml
```

**Verify — allowed paths pass:**

Ingress still answers (proves ingress-nginx → app survived the lockdown):
```bash
curl -sf -H "Host: shiplog.local" http://localhost/healthz -w "\nHTTP_STATUS:%{http_code}\n"
```
Expected output: `HTTP_STATUS:200`, same as Phase 3.

App can still reach the db (proves app → db survived):
```bash
kubectl exec -n shiplog deploy/shiplog -- curl -sf localhost:8000/healthz
```
Expected output: `200`-backed health response (the app internally depends on reaching Postgres to answer this).

DNS resolves from inside an app pod:
```bash
kubectl exec -n shiplog deploy/shiplog -- getent hosts shiplog-db
```
Expected output: an IP address followed by `shiplog-db`.

**Verify — blocked paths fail:**

A pod in an unrelated namespace cannot reach shiplog at all (cross-namespace blocked — nothing matches the `ingress-nginx` namespaceSelector):
```bash
kubectl run netpol-test --rm -it --restart=Never --image=curlimages/curl -n default -- \
  curl -sf --max-time 5 http://shiplog-svc.shiplog.svc.cluster.local/healthz
```
Expected output: the command hangs until the 5s timeout, then exits non-zero (`curl: (28) Connection timed out`) — the `pod` prints an error and the temporary pod is auto-removed by `--rm`.

The app pod cannot reach anything on the open internet (egress default-deny has no "allow everything else" rule):
```bash
kubectl exec -n shiplog deploy/shiplog -- curl -sf --max-time 5 https://example.com
```
Expected output: times out / connection error — no policy allows egress to anything outside `kube-system` DNS and the db pod.

**Checkpoint:** ingress→app and app→db both still work; a pod from `default` namespace gets blocked reaching shiplog; the app pod's egress to the open internet is blocked. Cross-namespace blocked, allowed paths pass — exactly the two properties this phase set out to prove.

---

## Phase 7 — the debugging toolbox

You'll use every one of these in the break-fix drills next — read this phase even if nothing is currently broken, because you need the muscle memory before the clock starts.

**`describe`** — the single most useful command in k8s. Shows spec, status, and (critically) the event log at the bottom:
```bash
kubectl describe pod -n shiplog -l app=shiplog
```
Expected output: full pod spec/status, ending with an `Events:` table — scheduling decisions, image pulls, probe failures, restarts, all with timestamps.

**Events, cluster-wide, newest last** — useful when you don't even know which pod to look at yet:
```bash
kubectl get events -n shiplog --sort-by='.lastTimestamp'
```
Expected output: a chronological list — `Scheduled`, `Pulled`, `Created`, `Started`, and any `Warning`-type events like `BackOff` or `Unhealthy`.

**`logs --previous`** — the current container's logs are useless once it's already restarted; `--previous` gets you the *last* container's logs before it died:
```bash
kubectl logs -n shiplog <pod-name> --previous
```
Expected output: the final lines the crashed container printed before exiting — usually the actual stack trace or error message that `describe`'s event table only summarizes as `CrashLoopBackOff`.

**`exec`** — a shell (or single command) inside a running container:
```bash
kubectl exec -it -n shiplog deploy/shiplog -- sh
```
Expected output: an interactive shell inside the container. Exit with `exit`.

**`port-forward`** — reach a pod or Service directly from your machine, bypassing ingress entirely (useful for isolating "is this an ingress problem or an app problem?"):
```bash
kubectl port-forward -n shiplog svc/shiplog-svc 8080:80
```
Expected output: `Forwarding from 127.0.0.1:8080 -> 8000`. In another terminal, `curl localhost:8080/healthz` should return `200` — if it does but the ingress path doesn't, the bug is in ingress/NetworkPolicy, not the app.

**`kubectl debug` with an ephemeral container** — for the case a normal `exec` can't reach: a container that has no shell at all, or one that's crash-looping too fast to `exec` into. An ephemeral container attaches a *second*, debug-only container into the same pod, sharing its network and (with `--target`) its process namespace, without restarting anything:
```bash
kubectl debug -it -n shiplog <pod-name> --image=busybox:1.36 --target=shiplog -- sh
```
Expected output: a shell from the injected `busybox` container, running alongside the original app container in the same pod — `ps aux` inside it (if `--target` is honored by the container runtime) shows the app's own processes too, and `wget -qO- localhost:8000/healthz` reaches the app over `localhost` since they share a network namespace.

**Checkpoint:** you've run all six of the above against the healthy stack at least once, and you know, without looking anything up, which one you'd reach for first for each of: "pod won't start," "pod keeps restarting," "pod is up but Service returns nothing," "I need to see the crash's actual output."

---

## Break-fix drills

Your Claude Code session seeds these live, one at a time, by patching a real manifest or resource in your running cluster — it will not tell you which of the five it picked. **Set a 40-minute clock for all five combined.** For each one: observe the symptom, diagnose it with Phase 7's toolbox, fix it, confirm the fix, and write one line stating the root cause (not the symptom — "CrashLoopBackOff" is a symptom, "DATABASE_URL pointed at the wrong port" is a root cause). Say you're ready and ask your session to seed the first one.

### Drill 1 — CrashLoopBackOff (bad env)

Symptom: `kubectl get pods -n shiplog` shows a shiplog pod cycling through `CrashLoopBackOff`, restart count climbing.

<details>
<summary>Hint</summary>
`describe` will show you the restart count and recent events, but the actual reason is almost always in the dead container's own output. Go straight to <code>kubectl logs --previous</code> before anything else — guessing from the Deployment spec alone wastes time when the crash reason is printed in plain text in the log.
</details>

### Drill 2 — ImagePullBackOff (typo tag)

Symptom: a shiplog pod sits at `0/1` ready, status `ImagePullBackOff` or `ErrImagePull`, never reaches `Running`.

<details>
<summary>Hint</summary>
<code>kubectl describe pod</code>'s event table spells out exactly what it tried to pull and why it failed — read the image string character by character against what you know you pushed. This is also the drill to double check isn't actually the private-registry-auth problem from the pre-flight step, if you skipped setting up <code>regcred</code>.
</details>

### Drill 3 — Pending (impossible resources)

Symptom: a pod never leaves `Pending`, no container ever starts.

<details>
<summary>Hint</summary>
A `Pending` pod with no container means it never got scheduled — `describe` on a pod that never started shows scheduler decisions in its events, not container events. Look for a <code>FailedScheduling</code> event, and check what it says couldn't be satisfied against <code>kubectl describe nodes</code>'s allocatable resources.
</details>

### Drill 4 — OOMKilled (low limit)

Symptom: a shiplog pod's restart count climbs, but unlike Drill 1, `describe` shows `Last State: Terminated, Reason: OOMKilled` rather than a plain application crash.

<details>
<summary>Hint</summary>
`logs --previous` may show nothing useful here — an OOM kill is the kernel cgroup killing the process from outside, not the app choosing to exit, so there's often no graceful log line. `kubectl describe pod` is the one that names it directly: check the container's <code>Last State</code> block, and compare its memory <code>limit</code> against what the app actually needs under load.
</details>

### Drill 5 — Service selector mismatch

Symptom: pods are `Running` and `1/1 Ready`, `curl` through the ingress returns `502`/`503` or hangs, but the pods themselves look completely healthy.

<details>
<summary>Hint</summary>
Healthy pods plus a broken path in front of them means the break is in what connects them, not in them. <code>kubectl get endpoints -n shiplog shiplog-svc</code> shows you exactly which pod IPs the Service is currently sending traffic to — compare that list against <code>kubectl get pods -n shiplog -l app=shiplog -o wide</code> and look for why they don't match.
</details>

---

## Prove-it: full redeploy from zero, under 10 minutes, no guide

Tear the stack down completely:
```bash
kind delete cluster --name shiplog
```

Close this file. From your `manifests/` directory (plus `kind-config.yaml` and, if needed, `regcred-secret.yaml`) alone, rebuild the entire cluster and stack — `kind create cluster`, ingress-nginx install, every manifest in order, `regcred` if your image is private — and get a `curl -H "Host: shiplog.local" http://localhost/healthz` returning `200` again. Time yourself from the first command to that final `200`.

If you go over 10 minutes, don't just try again immediately — look at where the time actually went (usually: waiting on ingress-nginx's controller pod, or applying manifests in an order that fights dependencies) and fix your own process, then retry.

**Checkpoint:** cluster rebuilt, full stack redeployed, ingress returns `200` on `/healthz`, all from your own manifests directory in under 10 minutes, guide closed.

---

## Done when

- [ ] 3-node kind cluster running, control-plane correctly labeled `ingress-ready=true`
- [ ] shiplog and Postgres both `Running`/`1/1 Ready` from hand-written manifests, no Helm
- [ ] ingress-nginx installed and `curl` through `localhost` with the `Host: shiplog.local` header returns `200`
- [ ] A rollout to a new tag completed, was rolled back with `rollout undo`, and you've watched both a surge-first and a drain-first rolling update in action
- [ ] `shiplog-sa` proven to have zero permissions, then exactly `get/list/watch` on pods and nothing else, via four `kubectl auth can-i` checks
- [ ] Default-deny `NetworkPolicy` in place, with DNS, ingress→app, and app→db explicitly allowed — cross-namespace access blocked, allowed paths pass
- [ ] All six Phase 7 debugging commands run at least once against the healthy stack
- [ ] All 5 break-fix drills diagnosed and fixed, one-line root cause written for each, under the 40-minute clock
- [ ] Full stack redeployed from your own manifests, from zero, in under 10 minutes, guide closed
