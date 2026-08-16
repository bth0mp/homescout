#!/usr/bin/env bash
# Create a Debian LXC on a Proxmox node and run HomeScout in it under Docker.
#
# RUN THIS ON THE PROXMOX NODE SHELL (as root), not on your laptop:
#   APP_PASSWORD='something-strong' bash proxmox-lxc.sh
#
# Everything is overridable:
#   CTID=151 STORAGE=local-zfs CT_IP=192.168.1.60/24 CT_GW=192.168.1.1 \
#     APP_PASSWORD='...' bash proxmox-lxc.sh
#
# Refuses to clobber an existing CTID. On failure it tells you how to clean up;
# pass ROLLBACK=1 to have it destroy the half-built container automatically.
set -euo pipefail

CTID="${CTID:-150}"
CT_HOSTNAME="${CT_HOSTNAME:-homescout}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
BRIDGE="${BRIDGE:-vmbr0}"
CT_IP="${CT_IP:-dhcp}"          # "dhcp" or CIDR e.g. 192.168.1.60/24
CT_GW="${CT_GW:-}"              # required when CT_IP is not dhcp
DISK_GB="${DISK_GB:-8}"
CORES="${CORES:-2}"
RAM_MB="${RAM_MB:-1024}"

IMAGE="${IMAGE:-ghcr.io/bth0mp/homescout:latest}"
APP_PORT="${APP_PORT:-3000}"

# App config. APP_PASSWORD is required: without it the admin UI has no auth of
# its own and every server action becomes an unauthenticated write endpoint.
APP_PASSWORD="${APP_PASSWORD:-}"
APP_URL="${APP_URL:-}"
GEOCODER_CONTACT="${GEOCODER_CONTACT:-homescout (change-me@example.com)}"
FBI_CDE_API_KEY="${FBI_CDE_API_KEY:-}"
SOCRATA_APP_TOKEN="${SOCRATA_APP_TOKEN:-}"

# Set these two only if the GHCR package is still private.
GHCR_USER="${GHCR_USER:-bth0mp}"
GHCR_TOKEN="${GHCR_TOKEN:-}"

die() { echo "ERROR: $*" >&2; exit 1; }
say() { echo "==> $*"; }

# --- pre-flight -------------------------------------------------------------
command -v pct >/dev/null || die "pct not found — run this on the Proxmox node, not in a container."
[ "$(id -u)" -eq 0 ] || die "run as root on the Proxmox node."
[ -n "$APP_PASSWORD" ] || die "APP_PASSWORD is required. Re-run: APP_PASSWORD='something-strong' bash $0"

# The password crosses two parsers (this heredoc, then Compose's dotenv reader).
# Single-quoting in the env file handles $ # and spaces; these two characters it
# cannot survive, and a silently-truncated password means a silently-open app.
case "$APP_PASSWORD" in
  *"'"*) die "APP_PASSWORD must not contain a single quote." ;;
  *"
"*)    die "APP_PASSWORD must not contain a newline." ;;
esac

if [ "$CT_IP" != "dhcp" ] && [ -z "$CT_GW" ]; then
  die "CT_GW is required when CT_IP is a static address."
fi
if pct status "$CTID" >/dev/null 2>&1; then
  die "CTID $CTID already exists. Remove it (pct stop $CTID && pct destroy $CTID) or pick another: CTID=151 bash $0"
fi

# Validate storage BEFORE the ~150MB template download. pct only surfaces this
# after all the expensive work, and its message never names a working
# alternative — on a ZFS-root node there is no local-lvm at all.
ROOTDIR_STORES="$(pvesm status --content rootdir | awk 'NR>1{print $1}')"
grep -qxF "$STORAGE" <<<"$ROOTDIR_STORES" \
  || die "storage '$STORAGE' is missing or has no 'rootdir' content. Try one of: $(echo $ROOTDIR_STORES)"

VZTMPL_STORES="$(pvesm status --content vztmpl | awk 'NR>1{print $1}')"
grep -qxF "$TEMPLATE_STORAGE" <<<"$VZTMPL_STORES" \
  || die "template storage '$TEMPLATE_STORAGE' is missing or has no 'vztmpl' content. Try one of: $(echo $VZTMPL_STORES)"

# --- template ---------------------------------------------------------------
say "Refreshing template list"
pveam update >/dev/null

TEMPLATE_NAME="$(pveam available --section system \
  | awk '{print $NF}' \
  | grep -E '^debian-[0-9]+-standard_.*_amd64\.tar\.(zst|gz|xz)$' \
  | sort -V | tail -1)"
[ -n "$TEMPLATE_NAME" ] || die "no Debian standard template found in 'pveam available'."

if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE_NAME"; then
  say "Downloading template $TEMPLATE_NAME to $TEMPLATE_STORAGE"
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE_NAME"
fi
TEMPLATE_REF="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE_NAME}"

if [ "$CT_IP" = "dhcp" ]; then
  NETCFG="name=eth0,bridge=${BRIDGE},ip=dhcp"
else
  NETCFG="name=eth0,bridge=${BRIDGE},ip=${CT_IP},gw=${CT_GW}"
fi

# --- container --------------------------------------------------------------
say "Creating unprivileged LXC $CTID ($CT_HOSTNAME) on $STORAGE"
# nesting + keyctl are what let Docker run inside an unprivileged container.
pct create "$CTID" "$TEMPLATE_REF" \
  --hostname "$CT_HOSTNAME" \
  --cores "$CORES" \
  --memory "$RAM_MB" \
  --swap 512 \
  --rootfs "${STORAGE}:${DISK_GB}" \
  --net0 "$NETCFG" \
  --features nesting=1,keyctl=1 \
  --unprivileged 1 \
  --onboot 1 \
  --start 1 \
  --description "HomeScout — home-buying research tool"

# From here on the CT exists and boots with the host. Anything that aborts
# leaves wreckage, so say so. die() exits via the exit builtin, which does not
# fire an ERR trap — hence EXIT with a success flag.
CT_CREATED=1
DEPLOY_OK=0
on_exit() {
  [ "${CT_CREATED:-0}" = 1 ] && [ "${DEPLOY_OK:-0}" = 0 ] || return 0
  {
    echo
    echo "!! Deploy failed after CT $CTID was created; it is running with onboot=1."
    echo "!! Remove it before re-running:"
    echo "!!     pct stop $CTID && pct destroy $CTID"
    echo "!! (or keep it to inspect, and re-run with CTID=<other>)"
  } >&2
  [ "${ROLLBACK:-0}" = 1 ] || return 0
  echo "!! ROLLBACK=1 — destroying CT $CTID" >&2
  pct stop "$CTID" >/dev/null 2>&1 || true
  pct destroy "$CTID" --force 1 >/dev/null 2>&1 || true
}
trap on_exit EXIT

say "Waiting for network in the container"
for i in $(seq 1 30); do
  if pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1; then break; fi
  [ "$i" -eq 30 ] && die "container never got DNS/network. Check bridge=$BRIDGE and IP settings."
  sleep 2
done

say "Installing Docker inside the container"
pct exec "$CTID" -- bash -eux <<'INSTALL'
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg >/dev/null
install -m 0755 -d /etc/apt/keyrings
rm -f /etc/apt/keyrings/docker.gpg
curl -fsSL https://download.docker.com/linux/debian/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null
systemctl enable --now docker
INSTALL

if [ -n "$GHCR_TOKEN" ]; then
  say "Logging the container's Docker into GHCR"
  # stdin, so the token never lands in argv on the host.
  printf '%s' "$GHCR_TOKEN" \
    | pct exec "$CTID" -- docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

# --- stack ------------------------------------------------------------------
say "Writing the stack"
pct exec "$CTID" -- mkdir -p /opt/homescout

# Values are single-quoted because Compose interpolates unquoted env-file values:
# an unquoted password containing $ would be silently mangled, and a mangled
# APP_PASSWORD that lands empty disables the auth gate entirely.
# install -m 600 first, so there is no world-readable window before chmod.
pct exec "$CTID" -- bash -c "install -m 600 /dev/null /opt/homescout/.env && cat > /opt/homescout/.env" <<ENVFILE
DATABASE_PATH='/data/homescout.db'
APP_PASSWORD='${APP_PASSWORD}'
APP_URL='${APP_URL}'
GEOCODER_CONTACT='${GEOCODER_CONTACT}'
FBI_CDE_API_KEY='${FBI_CDE_API_KEY}'
SOCRATA_APP_TOKEN='${SOCRATA_APP_TOKEN}'
ENVFILE

pct exec "$CTID" -- bash -c "cat > /opt/homescout/docker-compose.yml" <<COMPOSE
services:
  homescout:
    image: ${IMAGE}
    container_name: homescout
    restart: unless-stopped
    # Short form on purpose: 'required' defaults to true, so a missing .env
    # aborts the deploy instead of silently starting with no APP_PASSWORD.
    # The app fails OPEN when that variable is unset.
    env_file:
      - .env
    # Published on the container's own IP so Newt can reach it from anywhere on
    # the LAN. If Pangolin runs as Docker on THIS same LXC, drop the ports block
    # and put both services on a shared docker network instead.
    ports:
      - "${APP_PORT}:3000"
    volumes:
      - homescout-data:/data
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

volumes:
  homescout-data:
COMPOSE

say "Pulling and starting"
pct exec "$CTID" -- docker compose -f /opt/homescout/docker-compose.yml up -d

say "Waiting for health"
HEALTHY=0
for i in $(seq 1 45); do
  # Probe APP_PORT: port 3000 lives in the app container's namespace, not the LXC's.
  if pct exec "$CTID" -- curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    HEALTHY=1; break
  fi
  sleep 2
done

[ "$HEALTHY" -eq 1 ] || {
  echo "!! /api/health never answered. Container logs:" >&2
  pct exec "$CTID" -- docker logs --tail 50 homescout >&2 || true
  die "deploy did not come up healthy."
}

# /api/health is PUBLIC by design, so a 200 there proves nothing about auth.
# Assert the gate is actually closed — this is what catches a password that got
# mangled in transit and left the app wide open.
say "Verifying the auth gate"
CODE="$(pct exec "$CTID" -- curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/" || true)"
[ "$CODE" = "401" ] \
  || die "auth gate is OPEN (GET / returned ${CODE:-no-response}, expected 401). APP_PASSWORD did not reach the container intact — do not expose this."

IP="$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}' || true)"

DEPLOY_OK=1
cat <<EOF

  HomeScout is up and the auth gate is closed.

  CTID          $CTID
  IP            ${IP:-unknown}
  App           http://${IP:-<ct-ip>}:${APP_PORT}
  Health        http://${IP:-<ct-ip>}:${APP_PORT}/api/health
  Auth          HTTP Basic — any username, the APP_PASSWORD you passed

  Point Newt at:  http://${IP:-<ct-ip>}:${APP_PORT}
  Public routes:  /api/health and /s/*      Protected: everything else

  Update to a new image later:
    pct exec $CTID -- docker compose -f /opt/homescout/docker-compose.yml pull
    pct exec $CTID -- docker compose -f /opt/homescout/docker-compose.yml up -d

  Back up the database (WAL mode — do not copy the .db file alone while running):
    pct exec $CTID -- docker exec homescout node -e "new (require('better-sqlite3'))('/data/homescout.db').backup('/data/backup.db').then(()=>process.exit(0))"

EOF
