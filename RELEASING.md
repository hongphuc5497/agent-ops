# Releasing Agent Ops

Releases are automated. Push a `v<semver>` tag and the
[`Release` workflow](.github/workflows/release.yml) runs the test suite,
publishes to npm with the correct dist-tag, and creates the matching
GitHub release with notes from [CHANGELOG.md](CHANGELOG.md).

## One-time setup — npm Trusted Publishing (no secrets)

This package publishes via npm's [Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
flow. The workflow mints a short-lived OIDC token from GitHub's identity
provider on every run; npm validates it against the package's trusted-publisher
config. **No long-lived `NPM_TOKEN` secret is stored anywhere** — that's the
whole point.

Configure the trusted publisher once on npmjs.com:

1. Open the package settings:
   <https://www.npmjs.com/package/@hongphuc5497/agent-ops/access>
2. Scroll to **Publishing access** → **Trusted Publisher** → **Add publisher**.
3. Pick **GitHub Actions** and fill in:
   - **Repository owner:** `hongphuc5497`
   - **Repository name:** `agent-ops`
   - **Workflow filename:** `release.yml`
   - **Environment name:** *(leave blank — we don't gate on environments)*
4. Save.

That's it. `GITHUB_TOKEN` is provided automatically by Actions; nothing else
to configure.

### Why no token?

- Tokens leak. OIDC tokens are minted per-job, expire in minutes, and never
  touch your secret store.
- 2FA on your npm account doesn't break CI publishes anymore — OIDC bypasses
  the 2FA prompt the way Automation tokens used to, but without the long-lived
  credential.
- Revoking access is one click on the npm settings page; no secret to rotate.

## Cutting a release

```bash
# 1. Bump the version in THREE places on a release branch. They MUST match —
#    the `doctor` test asserts TOOL_VERSION == package.json version, and the
#    release workflow runs `npm test` before publishing, so any drift fails the
#    release. The places:
#      - package.json                "version"
#      - scripts/agent-ops-tool.py   TOOL_VERSION
#      - CHANGELOG.md                 new "## <ver> — YYYY-MM-DD" section at top
ver=0.4.0
git switch -c "release/v$ver"
node -e "const p=require('./package.json');p.version='$ver';require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2)+'\n')"
node -e "const f='scripts/agent-ops-tool.py',fs=require('fs');fs.writeFileSync(f, fs.readFileSync(f,'utf8').replace(/^TOOL_VERSION = .*/m, 'TOOL_VERSION = \"$ver\"'))"
# Edit CHANGELOG.md — add a `## $ver — YYYY-MM-DD` section at the top
npm test   # sanity: includes the doctor test that enforces the version lockstep

# 2. Open a PR. Merge after review.

# 3. From main, tag the merge commit and push
git switch main && git pull
git tag -a "v$ver" -m "v$ver"
git push origin "v$ver"
```

That last `git push origin v0.4.0` is what triggers the workflow. From
there, automation handles it:

1. Checks out the tag
2. Verifies `package.json` version matches the tag
3. Runs `npm test` — this is also where a `TOOL_VERSION` ≠ `package.json`
   mismatch is caught (the `doctor` test), so the publish never happens on a
   half-bumped release
4. Resolves the right npm dist-tag:
   - **`latest`** if the tag's version is higher than current `latest`
   - **`previous`** if the tag's version is lower (backfill / patch on
     an older minor)
   - **`next`** if the version has a pre-release suffix (e.g. `0.4.0-rc.1`)
5. `npm publish --access public --tag <name>` — authenticated via OIDC,
   no token needed
6. Creates or updates the GitHub release with notes extracted from
   CHANGELOG.md via [scripts/extract-changelog.sh](scripts/extract-changelog.sh)
7. Marks the GitHub release as `latest` only when the npm dist-tag was
   `latest` too — so both registries stay consistent

## Why both checks matter

Two registries, one source of truth. The two failure modes the workflow
guards against:

- **Tag/package.json mismatch** — someone pushes `v0.4.0` but
  `package.json` still says `0.3.0`. Workflow fails before publishing.
- **Latest divergence** — npm has `latest: 0.4.0` but GitHub shows
  `v0.3.0 — Latest`. Both flags are written from the same dist-tag
  decision in the same job, so they can't drift.

## Re-running for an existing tag

If a release fails mid-workflow (e.g. transient npm 500), you can
re-trigger it:

```bash
gh workflow run release.yml --ref v0.4.0
```

The workflow uses `gh release view` to detect an existing release and
updates instead of duplicating.

## Pre-releases

Tag with a suffix to get a non-latest channel:

```bash
git tag v0.4.0-rc.1
git push origin v0.4.0-rc.1
```

This publishes to npm with `--tag next` and marks the GitHub release as
`--prerelease`. Users install with `npm install @hongphuc5497/agent-ops@next`.

## Backfilling an old version

If npm is missing a version (e.g. v0.2.0 in the npm registry after
v0.3.0 already shipped), publish from a worktree of the old tag:

```bash
git worktree add --detach /tmp/agent-ops-v0.2.0 v0.2.0
cd /tmp/agent-ops-v0.2.0
npm publish --access public --tag previous
git worktree remove /tmp/agent-ops-v0.2.0
```

The `--tag previous` prevents the older version from claiming `latest`.
