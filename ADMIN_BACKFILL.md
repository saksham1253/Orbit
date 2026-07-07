# Orbit Admin Portal — Backfill

Admin controls for the user-facing systems shipped since the portal was built
(Photons economy, Nebula Store, rarity, streaks/ranking, calls, skills/reviews).
Delivered on branch **`feat/admin-backfill`** in reviewable phases. Everything is
**additive, RBAC-gated, audited, and reversible**; nothing user-facing changes
unless an admin acts.

---

## 1. What already existed (reused, NOT rebuilt)

An audit of the portal found it far more complete than the brief assumed. We
**extended** these rather than duplicating them:

| Capability | Where |
|---|---|
| Hardened Command Center API (unguessable base) | `routes/adminPortal.js` → `/api/__ssctl` |
| TOTP 2-step admin auth + CSRF + rate-limit + IP allowlist | `controllers/adminAuthController.js`, `middleware/adminAuth.js`, `utils/adminCrypto.js` |
| **Append-only audit log** (actor/action/target/before→after) | `models/AuditLog.js`, `utils/adminAudit.js` |
| **Live runtime flag store** (Mongo overrides env, 15s hot-reload) | `models/FeatureFlag.js`, `services/flagStore.js` |
| **Persisted Photon ledger** (every earn/spend) | `models/PhotonLedger.js`, `services/photonLedger.js` |
| Reports queue + user moderation (flag/suspend/ban/soft-delete) | `models/Report.js`, `controllers/adminSystemController.js` |
| Scoped design system + nav via `SECTIONS` array | `admin/admin.css` (`.ssctl-*`), `admin/AdminShell.jsx` |
| Per-user state (photons, cosmetics, streak, league, cosmic) | `models/user.js` (`orbit.*`, `cosmic.*`) |

## 2. What was added (by phase)

### Phase 0 — Foundations
- **`AppConfig` + `services/configStore.js`** — a general runtime config store
  (namespaced JSON, Mongo-backed, in-memory cache, 15s hot-reload, write-through)
  mirroring `flagStore`. `resolveConfig(ns, defaults)` overlays admin overrides on
  the hard-coded JS defaults, so gameplay hot paths stay pure/synchronous and an
  **empty collection == prior behavior**. Booted in `server.js`.
- **RBAC tiering** — `admin.portalRole` on the user (`superadmin | economy |
  catalog | moderator | support | analyst`), default `superadmin` (back-compat).
  Reworked the previously-unused `requireRole()` to enforce it; exposed in
  `/auth/me`. Shared UI: `admin/components/{ConfirmModal,Toast}.jsx`.

### Phase 1 — Economy & Photons (spec A)
- `services/economyConfig.js` bridges the pure engine constants to admin editing;
  the freeze-buy cost/cap now read the overridable values live.
- `controllers/adminEconomyController.js`: supply dashboard, per-user ledger,
  grant/deduct (reason + audit + real `PhotonLedger` entry), earn-rules config.
- Frontend `admin/pages/Economy.jsx` (Supply / Ledger+Grants / Earn Rules).
- **Invariant (tested):** admin Photon actions touch `orbit.stardust` + the ledger
  only — never `cosmic.score`/rank.

### Phase 2 — Nebula Store + Rarity (spec B + C)
- **`models/StoreItem.js`** (catalog → DB, draft→live→archived) and
  **`models/RarityTier.js`** (net-new backend rarity, 15 tiers).
- `services/cosmeticsCatalog.js` refactor: pure buy/equip reducers **unchanged**;
  catalog data is cache-backed (defaults seed, StoreItem overlay via `refresh()`).
- `controllers/adminStoreController.js`: item CRUD, publish/unpublish, archive,
  per-item analytics, rarity CRUD with a **milestone/league name-collision
  guardrail**.
- `scripts/seedStore.js` (`npm run seed:store`) seeds the 15 tiers + 9 items.
- Frontend `admin/pages/Store.jsx` (Items + Rarity).

### Phase 3 — Progression (spec F + G)
- `controllers/adminProgressionController.js`: user progression snapshot; adjust/
  restore streak; grant Gravity Assist freeze (all audited, reason required,
  touch orbit only); consolidated live config view (milestones, phases, Gravity
  Assist economics [editable], CosmicScore weights, league rules).
- Frontend `admin/pages/Progression.jsx` (Support Tools / Config).

### Phase 4 — Ops & Moderation (spec H + I)
- Call monitoring (`/ops/calls` from `CallHistory`, active count).
- **`models/SkillCategory.js`** (net-new taxonomy) + CRUD.
- Review moderation: `rating.js` gains `hidden/hiddenBy/hiddenAt/hiddenReason`;
  hide/restore (audited); `trustController.getUserRatings` excludes hidden reviews.
- Frontend `admin/pages/Ops.jsx` (Calls / Skill Categories / Reviews).

## 3. Data-model additions

| Model | Purpose |
|---|---|
| `AppConfig` | namespaced runtime config overrides (`namespace`+`key` unique) |
| `StoreItem` | admin-managed Nebula Store catalog (status/stock/discount/window) |
| `RarityTier` | the 15-tier ladder (label/color/glow/order/live) |
| `SkillCategory` | curated skill taxonomy (slug/label/aliases/parent/active) |
| `Rating` (extended) | `hidden/hiddenBy/hiddenAt/hiddenReason` for review moderation |
| `User.admin` (extended) | `portalRole` for RBAC tiering |

## 4. Endpoints added (all under `/api/__ssctl`, behind `requireAdmin`)

| Method | Path | Role | Action |
|---|---|---|---|
| GET | `/economy/summary` | admin | supply / faucets vs sinks / inflation |
| GET | `/economy/ledger` | admin | per-user balance + ledger |
| POST | `/economy/adjust` | economy | grant/deduct Photons (audited) |
| GET/PATCH | `/economy/config` | admin / economy | view / edit earn rules |
| GET | `/store/items` | admin | list catalog |
| POST/PATCH | `/store/items[/:key]` | catalog | create / edit item |
| POST | `/store/items/:key/archive` | catalog | soft-remove |
| GET | `/store/items/:key/analytics` | admin | purchases / revenue |
| GET/PATCH | `/store/rarity[/:key]` | admin / catalog | list / edit tiers |
| GET | `/progression/config` | admin | live tuning view |
| GET | `/progression/user/:id` | admin | streak/freeze/league snapshot |
| POST | `/progression/user/:id/streak` | support | adjust/restore streak |
| POST | `/progression/user/:id/freeze` | support | grant Gravity Assist |
| GET | `/ops/calls` | admin | call session monitoring |
| GET/POST/PATCH | `/ops/categories[/:slug]` | admin / catalog | skill taxonomy CRUD |
| GET | `/ops/reviews` | admin | reviews for moderation |
| POST | `/ops/reviews/:id/{hide,restore}` | moderator | hide/restore a review |

## 5. RBAC matrix (`admin.portalRole`)

`superadmin` passes every gate. Others are least-privilege:

| Role | Can mutate |
|---|---|
| **superadmin** | everything |
| **economy** | Photon grants/deducts, economy config |
| **catalog** | store items, rarity tiers, skill categories |
| **moderator** | review hide/restore (+ existing reports queue) |
| **support** | streak adjust/restore, grant freeze |
| **analyst** | read-only (no mutation routes) |

All reads remain open to any authenticated admin; only mutations are role-gated.
Existing admins default to `superadmin`, so nothing they could do before is lost.

## 6. Cross-cutting guarantees

- **Audit:** every mutation writes an `AuditLog` row (actor, action, target,
  before→after, reason). Viewable in the Audit module.
- **Reversible:** config overrides clear back to JS defaults; store items
  draft/archive; reviews + categories soft-toggle; grants are ledgered.
- **Economy ≠ rank:** admin Photon/streak tools never touch `cosmic.score`/tier —
  asserted by unit tests (`adminEconomy.test.js`, `adminProgression.test.js`).
- **Safe by default:** empty `AppConfig`/`StoreItem`/`RarityTier` collections ⇒
  exactly the prior behavior (JS defaults). Seed with `npm run seed:store`.

## 7. QA checklist

- [ ] `cd BackEnd && npx jest --runInBand` → 201/201 green.
- [ ] `cd FrontEnd && npx eslint .` → 0 errors; `npm run build` clean.
- [ ] Log into the Command Center; the new nav sections render (Economy, Store,
      Progression, Ops & Moderation).
- [ ] Economy: grant Photons to a test user → balance rises, a `PhotonLedger`
      row + `AuditLog` row appear, `cosmic.score` unchanged.
- [ ] Store: `npm run seed:store`, then edit an item / publish-unpublish → the
      user `/shop` reflects it within a refresh; archived items leave the shop.
- [ ] Rarity: rename a tier to "Deep Space" → rejected (collision guardrail).
- [ ] Progression: adjust a user's streak → orbit.streak changes, rank untouched.
- [ ] Ops: hide a review → it vanishes from the public profile; restore returns it.
- [ ] RBAC: set a test admin's `portalRole` to `analyst` → mutation routes 404.

## 8. Deferred (honest scope)

- Full **Name FX** sub-type catalog (particles/entrances/fonts/titles as composable
  effects) — name-glows are already managed as `StoreItem type:'name_glow'`; the
  richer sub-type system is future work.
- **Live call kick/end** over the socket — current call ops are monitoring +
  review/report based (no realtime session teardown yet).
- **Runtime-editable** milestone payouts / CosmicScore weights — surfaced as live
  reference; making them editable needs non-breaking injection into the pure
  engines (a deliberate, separate change) rather than the overlay used for the
  I/O-layer economy values.
- **Persisted analytics** — telemetry is still the in-memory ring buffer.
