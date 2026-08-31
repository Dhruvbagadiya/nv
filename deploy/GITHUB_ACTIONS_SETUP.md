# Automating deploys

`deploy/deploy.sh` stays the release process. GitHub Actions only decides *when*
it runs, so a deploy can still be done by hand over SSH when GitHub is down or a
release has to go out from a phone.

After setup: **push to `main` and it deploys itself**, provided lint, tests and
the build pass first. A pull request runs the same checks but never deploys.

## One-time setup

### 1. A deploy key for the runner

Generate it on your own machine, not on the server — the private half never
needs to touch the droplet.

    ssh-keygen -t ed25519 -f ~/.ssh/nv-deploy -C "github-actions" -N ""

Authorise the public half on the droplet:

    ssh-copy-id -i ~/.ssh/nv-deploy.pub deploy@206.189.138.33

Or, by hand:

    cat ~/.ssh/nv-deploy.pub | ssh deploy@206.189.138.33 \
      'cat >> ~/.ssh/authorized_keys'

### 2. Pin the host key

    ssh-keyscan -H 206.189.138.33

Copy the whole output. This is what stops the runner from handing your deploy
key to whatever machine answers on that address.

### 3. Repository secrets

GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | `206.189.138.33` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | contents of `~/.ssh/nv-deploy` (the private one, `BEGIN`/`END` lines included) |
| `DEPLOY_KNOWN_HOSTS` | the `ssh-keyscan` output from step 2 |

### 4. Check it before trusting it

Actions tab → Deploy → Run workflow. Watch it once end to end rather than
finding out on a release you care about.

## What it does not do

**It does not run scraper imports.** Those talk to a local MongoDB on your
machine and to the database directly; they are not part of a release.

**It does not roll back.** If a deploy leaves the site broken, the fastest
recovery is still to revert the commit and let the pipeline redeploy, or SSH in
and run `deploy/deploy.sh` against an earlier checkout. A migration that has
already applied is not undone by either — write migrations so the previous
image can still run against the new schema, which is what made the nullable
`applicationFee` change safe to ship ahead of the code that reads it.

**It does not restart the droplet.** The login banner currently says
*** System restart required ***; that is a separate, deliberate decision.

## If the deploy step fails but verify passed

Almost always SSH rather than the app:

- `Host key verification failed` — `DEPLOY_KNOWN_HOSTS` is stale. The droplet
  was rebuilt or its key rotated; re-run `ssh-keyscan` and update the secret.
- `Permission denied (publickey)` — the public half is not in the deploy user's
  `authorized_keys`, or `DEPLOY_SSH_KEY` lost its trailing newline on paste.
- The job hangs — something on the server is prompting. `deploy.sh` needs no
  input; check `git pull --ff-only` is not stuck on divergent history.
