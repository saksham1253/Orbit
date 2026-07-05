# Rollback & kill-switch guide — Orbit merge

Merge of `feat/orbit-all` into `main`. Pre-merge `main` is tagged **`pre-orbit-merge`**.

## Fastest fix: flip a flag (no revert, no redeploy of code)
Set these as env vars on the backend host (and `VITE_*` at build for the app):
- `ORBIT_TIER1=false` — disable streak/missions/Photons tracking
- `ORBIT_TIER2=false` — hide Leagues + Constellations
- `ORBIT_TIER3=false` — hide cosmetics shop
- `ORBIT_TIER2_PCT=10` (etc.) — roll a tier to 10% of users instead of 100%
- `ORBIT_DECAY_REMINDERS=false` — silence streak reminders
- `ORBIT_ANALYTICS=false` — silence analytics log lines

**Recommended staged rollout:** start with `ORBIT_TIER2_PCT=0` and `ORBIT_TIER3_PCT=0`
(Tier 1 on), watch, then raise the percentages. Defaults are ON at 100%.

## Full revert (structural problem only)
The merge is a `--no-ff` merge commit. Revert the whole thing:
```
git revert -m 1 <merge_commit_sha>     # creates a clean undo commit
git push origin main
```
Or reset to the tagged pre-merge point (only if nothing else has landed on main):
```
git diff pre-orbit-merge main          # review what would be undone
# preferred: revert as above, NOT reset --hard on a shared main
```
To re-merge later after a revert, revert the revert first, or rebase the branch.

## Data safety
Code reverts cleanly; **data written while live is NOT auto-removed** — and that's fine here:
- No DB column was renamed (Photons kept the `stardust` field), so there's nothing to migrate back.
- New fields/collections (`orbit.*`, `sessionsTaught`, `Constellation`, `fcmTokens`, league state) are additive — after a revert they simply sit unused. No cleanup needed.

## Verify after merge
- `cd BackEnd && npx jest` → 162/162
- `cd FrontEnd && npm run build` → succeeds
- Walk `QA_CHECKLIST.md` on web + APK.
