# HomeScout

Self-hosted home-buying research. Saves properties, geocodes them, builds
outbound listing links, and (as milestones land) runs VA loan math, closing
cost estimates and area crime lookups.

> **DISCLAIMER — this is an estimate tool, not a lender.** Every dollar figure
> it produces is an approximation from the numbers you type in. It is not
> lender-verified, not an offer of credit, and not financial advice. Your Loan
> Estimate and Closing Disclosure are the documents that govern. VA funding fee
> exemption and entitlement are determined by your Certificate of Eligibility,
> not by this app.

---

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (webpack — see note below) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Regenerate Drizzle migrations after a schema change |

**Builder note:** both `dev` and `build` pass `--webpack`. Turbopack cannot
create junction points on an SMB/UNC share, which is where this repo lives; it
panics on `next build`. On a local disk you can drop the flag.

---

## Environment variables

Everything is optional except where noted. Copy `.env.example` to `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_PATH` | `./data/homescout.db` | SQLite file. Point at the mounted volume in Docker. |
| `APP_URL` | — | Public origin, used to render share links. No trailing slash. |
| `GEOCODER_CONTACT` | `homescout (unconfigured)` | **Set this.** Sent as `User-Agent` to Census and Nominatim; their usage policies require a real identifier. |
| `APP_PASSWORD` | *(unset)* | **Strongly recommended.** See [Authentication](#authentication). |
| `FBI_CDE_API_KEY` | — | FBI Crime Data Explorer. Free at https://api.data.gov/signup/ |
| `SOCRATA_APP_TOKEN` | — | Optional; city open-data portals throttle hard without one. |
| `ENABLE_LISTING_ENRICHMENT` | `false` | Feature flag for licensed listing APIs. Off unless you hold a license. |
| `ATTOM_API_KEY` / `RENTCAST_API_KEY` / `BRIDGE_API_KEY` | — | Only read when the flag above is on. |

No key is ever exposed to the browser — everything that needs one runs in a
server action or a route handler.

---

## Authentication

The app has **no user accounts**. It assumes a reverse proxy (Pangolin)
authenticates the admin side. That assumption is load-bearing, so there is a
second lock:

- **`APP_PASSWORD` set** → every route except `/s/*` and `/api/health` requires
  HTTP Basic auth. Any username, that password. This is enforced in
  `middleware.ts`, which also covers server actions.
- **`APP_PASSWORD` unset** → the app trusts the proxy completely. If a proxy
  rule ever drifts, `createProperty` / `updateProperty` / `deleteProperty`
  become unauthenticated write endpoints, and deletes cascade to scenarios and
  share links. Set the password.

### Route exposure

| Route | Exposure | Why |
| --- | --- | --- |
| `/api/health` | **Public** | Container healthcheck; returns no property data. |
| `/s/*` | **Public** | Read-only share links, authorized by the token itself. |
| everything else | **Protected** | Board, property detail, all mutations. |

---

## Docker deployment

Two compose files, because the two situations genuinely differ:

| File | Use when |
| --- | --- |
| `docker-compose.yml` | You have the source on the Docker host and want to build locally. |
| `docker-compose.dockhand.yml` | You paste compose into a UI (Dockhand, Portainer, Komodo) and there is no build context. |

### Prerequisites

1. **The external network must already exist.** Both files attach to an
   external network named `pangolin`. Compose does *not* create it — it aborts
   with `network pangolin declared as external, but could not be found`.
   ```bash
   docker network ls
   ```
   If yours is named something else, either edit the file or set
   `PROXY_NETWORK=your-network-name` (source-based file only).

2. **For the paste-in file, the image must be pullable.** Push to GHCR by
   letting the `Build image` GitHub Action run (it triggers on push to
   `master`), then either make the `homescout` package public or add a GHCR
   registry credential in your Docker UI.

### Source-based

```bash
cp .env.example .env
docker compose up -d --build
```

### Paste-in (Dockhand etc.)

Paste the contents of `docker-compose.dockhand.yml`, fill in the environment
values in the UI (especially `APP_PASSWORD`, `APP_URL` and
`GEOCODER_CONTACT`), and deploy. There is no `.env` file and no build step.

### Proxmox (LXC + Docker)

`deploy/proxmox-lxc.sh` creates an unprivileged Debian LXC, installs Docker in
it, and brings the stack up. **Run it on the Proxmox node shell as root:**

```bash
APP_PASSWORD='something-strong' bash deploy/proxmox-lxc.sh
```

Overridable: `CTID` `STORAGE` `TEMPLATE_STORAGE` `BRIDGE` `CT_IP` `CT_GW`
`DISK_GB` `CORES` `RAM_MB` `APP_PORT` `IMAGE` `APP_URL` `GEOCODER_CONTACT`
`GHCR_USER` `GHCR_TOKEN` `ROLLBACK`.

```bash
CTID=151 STORAGE=local-zfs CT_IP=192.168.1.60/24 CT_GW=192.168.1.1 APP_PASSWORD='...' bash deploy/proxmox-lxc.sh
```

Notes:

- It validates storage **before** downloading a ~150 MB template, and names the
  storages that would actually work — `local-lvm` does not exist on a ZFS-root
  node.
- After deploying it asserts `GET /` returns **401**. `/api/health` is public,
  so a healthy container proves nothing about auth; this catches an
  `APP_PASSWORD` that failed to arrive intact.
- `APP_PASSWORD` may not contain a single quote or newline — the script rejects
  those up front rather than silently truncating the password.
- If a step fails after the container is created, it prints the `pct stop` /
  `pct destroy` cleanup. `ROLLBACK=1` destroys it automatically.
- The app is published on the LXC's IP, so Newt can reach it from any host. If
  Pangolin runs as Docker on that same LXC, drop the `ports:` block and share a
  Docker network instead.

### Behind Pangolin / Newt

The container publishes **no host ports** on purpose. Newt reaches it over the
shared Docker network:

- **Target:** `http://homescout:3000` (container name, container port)
- Put Newt and HomeScout on the same Docker network
- Terminate TLS at Pangolin; Basic auth credentials would otherwise cross the
  wire in the clear

Resource rules to configure in Pangolin:

| Path | Auth |
| --- | --- |
| `/api/health` | none |
| `/s/*` | none |
| `/*` | your Pangolin auth |

### Data and backups

SQLite lives on the `homescout-data` volume at `/data/homescout.db` in WAL
mode, so `-wal` and `-shm` sidecar files sit next to it. **Copying the `.db`
file alone while the container runs can miss committed transactions.** Back up
with the container stopped, or use SQLite's backup API:

```bash
docker exec homescout node -e "const D=require('better-sqlite3');new D('/data/homescout.db').backup('/data/backup.db').then(()=>process.exit(0))"
```

---

## Adding a property from a listing link

Paste a listing URL into the field at the top of the Add-property form and the
address fills itself in. Supported: **Redfin, Zillow, Realtor.com, Trulia,
Homes.com** — property pages, not search pages.

**This still does not scrape.** These sites encode the address in the URL path
(`/WA/Wenatchee/908-N-Elliott-Ave-98801/home/75131851`), so it is parsed as a
string. The listing page is never fetched. The parsed address is then handed to
the geocoder for coordinates and FIPS codes.

One subtlety worth knowing: the Census geocoder returns a USPS-reduced street —
`908 N Elliott Ave` comes back as `908 ELLIOTT AVE`, directional dropped. That
string is what the outbound listing links are built from, so where the URL gives
unambiguous fields (Redfin, Realtor.com) the URL wins for the street and the
geocoder is used only for coordinates. Elsewhere the geocoder's answer is
title-cased for display.

If a link cannot be read, it says so and asks you to type the address rather
than guessing.

## Staying up to date

`deploy/proxmox-lxc.sh` installs a **systemd timer** in the container that runs
`docker compose pull && up -d` every 6 hours (`UPDATE_INTERVAL_HOURS`). Push to
`master` → Actions builds and smoke-tests → the node picks it up.

```bash
pct exec 150 -- systemctl list-timers homescout-update.timer
pct exec 150 -- journalctl -u homescout-update.service -f
pct exec 150 -- systemctl start homescout-update.service   # run one now
```

Every page footer shows the running build's short SHA and whether `master` has
moved past it; `/api/version` returns the same as JSON. To read it without
typing your password:

```bash
pct exec 150 -- bash -c 'set -a; . /opt/homescout/.env; curl -s -u any:"$APP_PASSWORD" http://127.0.0.1:3000/api/version'
```

### Why not Watchtower

It was the obvious choice and it does not work here. `containrrr/watchtower`'s
last image push was **2023-11-11** and the project is unmaintained, so its
bundled Docker client speaks API 1.25 while a current daemon requires ≥ 1.40 —
it crash-loops on any modern host with `client version 1.25 is too old`. The
timer needs no third-party image and hands the Docker socket to nobody.

### Why no update button in the app

A button would need the Docker socket mounted into the web container, which
turns any auth bypass in an internet-facing app into root on the LXC. The timer
holds no HTTP surface at all. If you want a button, the safe route is a
restricted socket-proxy — not a socket mount.

## Data sources, licensing and attribution

| Source | Used for | Terms |
| --- | --- | --- |
| [U.S. Census Geocoder](https://geocoding.geo.census.gov/geocoder/) | Primary geocoding, FIPS state/county/tract | U.S. Government work, public domain. No key, no published rate limit — be polite anyway. |
| [Nominatim](https://nominatim.openstreetmap.org/) | Geocoding fallback | ODbL. **Requires** an identifying `User-Agent` and max 1 request/second. Set `GEOCODER_CONTACT`. Results are © OpenStreetMap contributors. |
| Zillow, Redfin, Realtor.com, Trulia, Homes.com | Outbound deep links only | **No scraping, no API wrappers.** The app only ever builds a URL you click. Patterns live in `lib/listing-links.ts` with a `LAST_VERIFIED` date. |
| FBI Crime Data Explorer | Agency/state offense counts *(milestone 5)* | Free `api.data.gov` key. Agency-level, not address-level. |
| Socrata / city open data | Incident-level crime *(milestone 5)* | Per-city terms. Configured per city in `lib/crime/cities.ts`. |

Geocoding results are cached in SQLite forever, keyed on a normalized address,
so the same house never costs a second API call.

---

## Rate and fee tables

These change by statute or market and are pinned with a `LAST_VERIFIED`
constant. Check them against the source before trusting a number:

| File | Contents |
| --- | --- |
| `lib/listing-links.ts` | Outbound listing-site URL patterns |
| `lib/listing-parse.ts` | Inbound listing-URL shapes (paste-a-link) |
| `lib/va/funding-fee.ts` | VA funding fee tiers *(milestone 3)* |
| `lib/va/residual-income.ts` | VA residual income table *(milestone 3)* |
| `lib/closing/defaults.ts` | Closing cost defaults, transfer tax by state |
| `lib/closing/non-allowable.ts` | VA fees the veteran may not be charged |

---

## Status

| Milestone | State |
| --- | --- |
| 0 — Scaffold, theme, SQLite, health check, Docker | done |
| 1 — Properties + geocoding | done |
| 2 — Listing deep links | done |
| 3 — VA loan calculator | done |
| 4 — Closing cost estimator | done |
| Maps (board + per property) | done |
| 5 — Area crime lookup | next |
| 6 — Compare view | pending |
| 7 — Sharing | pending |
| Auto-update button | after the build is complete |
