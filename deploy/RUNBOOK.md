# Deployment runbook

Production: **https://nvimmigrationpvtltd.com**
Droplet: `206.189.138.33` (Bangalore BLR1) · Database: `nv-immigration-db` (managed, same region)

---

## Deploy a change

On your machine:

```powershell
cd C:\project\nv-immigration-portal
git add -A
git commit -m "what changed"
git push origin main
```

On the server:

```bash
ssh deploy@206.189.138.33
cd ~/nv-immigration-portal
bash deploy/deploy.sh
```

`deploy.sh` pulls, rebuilds both images, applies migrations as a separate step,
restarts, waits for the health check, and prunes old images. It stops on the
first failure rather than leaving a half-deployed stack.

---

## Change configuration only

`.env.production` is deliberately **not** in git — it holds real secrets. Edit it
on the server, then redeploy so the containers pick it up:

```bash
nano backend/.env.production
bash deploy/deploy.sh
```

---

## Check it worked

```bash
curl -s https://nvimmigrationpvtltd.com/api/health
```

Expect `{"status":"ok","database":"up","env":"production"}`. That endpoint
returns 503 when Postgres is unreachable, so it is a real readiness check rather
than a ping.

---

## Logs

```bash
cd ~/nv-immigration-portal
C="docker compose -f deploy/docker-compose.prod.yml"

$C logs -f api            # follow the API
$C logs --tail=200 -t api # recent, timestamped
$C logs --since 30m api   # last half hour
$C ps                     # what is running, and health status
```

Worth knowing which lines matter:

| Grep | Tells you |
|---|---|
| `\[mail\]` | Password-reset links, when MAIL_* is unconfigured — they are logged, not sent |
| `\[rate-limit\]` | Whether Redis attached, or it silently fell back to in-memory |
| `" 5[0-9][0-9] "` | Server errors |

Logs are capped at 10MB x 3 files per service, so they cannot fill the disk.

---

## Restart without rebuilding

```bash
docker compose -f deploy/docker-compose.prod.yml restart api
```

---

## Roll back

Images are tagged `latest`, so rolling back means checking out the previous
commit and rebuilding:

```bash
git log --oneline -5
git checkout <previous-sha>
bash deploy/deploy.sh
```

Then `git checkout main` once the fix is ready.

**Migrations do not roll back.** If a deploy fails *after* migrations applied,
rolling back the code leaves a newer schema in place. Usually harmless — the
migrations here are additive — but check before assuming.

---

## Database

```bash
# One-off SQL or Prisma commands run inside the api container
docker compose -f deploy/docker-compose.prod.yml run --rm api npx prisma migrate status

# Reference data (safe to re-run; creates no users in production)
docker compose -f deploy/docker-compose.prod.yml run --rm api node prisma/seed.js
```

Connecting from your laptop needs the **public** host (no `private-` prefix) and
your current IP in Trusted Sources. Because that IP is mobile and rotates, the
durable option is a tunnel through the droplet:

```powershell
ssh -L 5433:private-nv-immigration-db-do-user-42308945-0.e.db.ondigitalocean.com:25060 deploy@206.189.138.33
```

Then point pgAdmin at `localhost:5433`.

---

## Certificates

Renewal is automatic — the `certbot` service checks every 12 hours. To confirm:

```bash
docker compose -f deploy/docker-compose.prod.yml logs certbot | tail -20
```

Expiry warnings go to `nvimmigrationsurat@gmail.com`. If one arrives, renewal has
been failing and the certificate is close to expiring.

---

## Still outstanding

- **Email is unconfigured.** Password reset generates a link but only logs it, so
  no user can complete a reset. Set `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM`.
- **Uploads are on local disk**, on a named Docker volume. They survive redeploys
  but live on one box. Configure the `S3_*` block for DigitalOcean Spaces when
  volume grows.
- **Landing page photos** are gradient placeholders — see the IMAGE SLOTS note at
  the bottom of `frontend/src/styles/landing.css`.
