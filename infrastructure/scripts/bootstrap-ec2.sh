#!/usr/bin/env bash
#
# WealthyNest EC2 app-server bootstrap. Runs as root via EC2 UserData on first boot (uploaded as
# a CDK asset and invoked by ComputeStack) and is safe to re-run by hand over SSM Session Manager
# after an AMI/dependency change - every step is idempotent.
#
# Usage: bootstrap-ec2.sh <envName> <awsRegion>
set -euo pipefail

ENV_NAME="${1:?usage: bootstrap-ec2.sh <envName> <awsRegion>}"
AWS_REGION="${2:?usage: bootstrap-ec2.sh <envName> <awsRegion>}"

APP_USER="wealthynest"
APP_DIR="/opt/wealthynest"
LOG_DIR="/var/log/wealthynest"
NGINX_SSL_DIR="/etc/nginx/ssl"
CW_AGENT_SSM_PARAM="/wealthynest/${ENV_NAME}/cloudwatch-agent-config"

log() { echo "[bootstrap] $(date -u +%FT%TZ) $*"; }

log "Starting bootstrap for env=${ENV_NAME} region=${AWS_REGION}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# --- Java 21 (Temurin) ---------------------------------------------------------------
if ! command -v java >/dev/null 2>&1 || ! java -version 2>&1 | grep -q '"21'; then
  log "Installing Temurin JDK 21"
  apt-get install -y wget apt-transport-https gnupg
  wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg
  echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print $2}' /etc/os-release) main" \
    > /etc/apt/sources.list.d/adoptium.list
  apt-get update -y
  apt-get install -y temurin-21-jdk
else
  log "Java 21 already installed, skipping"
fi

# --- Git, unzip, jq (used by deploy-backend.sh to parse Secrets Manager JSON) --------
apt-get install -y git unzip jq curl

# --- Docker + Docker Compose (Redis was moved to ElastiCache; kept for any future
#     sidecar containers and local operational parity with docker-compose.yml) -------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine + Compose plugin"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker already installed, skipping"
fi

# --- Nginx ----------------------------------------------------------------------------
if ! command -v nginx >/dev/null 2>&1; then
  log "Installing Nginx"
  apt-get install -y nginx
fi

mkdir -p "${NGINX_SSL_DIR}"
if [[ ! -f "${NGINX_SSL_DIR}/cloudflare-origin.pem" || ! -f "${NGINX_SSL_DIR}/cloudflare-origin.key" ]]; then
  log "WARNING: Cloudflare Origin CA certificate not found at ${NGINX_SSL_DIR}."
  log "Generating a temporary self-signed cert so Nginx can still start - replace it for real"
  log "traffic. See docs/deployment-guide.md 'TLS: Cloudflare Origin CA' for the real steps."
  openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
    -keyout "${NGINX_SSL_DIR}/cloudflare-origin.key" \
    -out "${NGINX_SSL_DIR}/cloudflare-origin.pem" \
    -subj "/CN=temporary-self-signed"
fi

install -m 0644 /tmp/wealthynest-nginx.conf /etc/nginx/sites-available/wealthynest.conf 2>/dev/null || true
if [[ -f /etc/nginx/sites-available/wealthynest.conf ]]; then
  ln -sf /etc/nginx/sites-available/wealthynest.conf /etc/nginx/sites-enabled/wealthynest.conf
  rm -f /etc/nginx/sites-enabled/default
  # Gate reload/restart behind a passing config test - `nginx -t && reload || restart` would
  # restart with a *known-bad* config if the test itself failed, taking a working Nginx down.
  if nginx -t; then
    systemctl reload nginx 2>/dev/null || systemctl restart nginx
  else
    log "WARNING: nginx config test failed - leaving the existing running config untouched"
  fi
fi
systemctl enable nginx

# --- CloudWatch Agent -------------------------------------------------------------------
if ! command -v amazon-cloudwatch-agent-ctl >/dev/null 2>&1; then
  log "Installing CloudWatch Agent"
  ARCH="$(dpkg --print-architecture)"
  curl -fsSL "https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/${ARCH}/latest/amazon-cloudwatch-agent.deb" \
    -o /tmp/amazon-cloudwatch-agent.deb
  dpkg -i /tmp/amazon-cloudwatch-agent.deb
  rm -f /tmp/amazon-cloudwatch-agent.deb
fi
# Best-effort, not fatal: this SSM parameter and the instance role's read grant on it both live
# in MonitoringStack, which deploys *after* ComputeStack creates this instance (and therefore
# after UserData starts running) - on a brand-new `cdk deploy --all`, there's a real window where
# this parameter or the IAM grant on it isn't propagated yet. Retry a few times with backoff to
# absorb ordinary IAM eventual-consistency; if it still fails, don't take the rest of bootstrap
# down with it (Nginx/systemd/firewall setup below matter far more than metrics starting exactly
# on first boot). Re-run this one command by hand over SSM once the full stack set has settled if
# it never catches up on its own - `amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c
# "ssm:${CW_AGENT_SSM_PARAM}" --region "${AWS_REGION}"`.
cw_agent_configured=false
for attempt in 1 2 3 4 5; do
  if /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
      -a fetch-config -m ec2 -s -c "ssm:${CW_AGENT_SSM_PARAM}" --region "${AWS_REGION}"; then
    cw_agent_configured=true
    break
  fi
  log "CloudWatch Agent config fetch failed (attempt ${attempt}/5) - retrying in 15s"
  sleep 15
done
if [[ "${cw_agent_configured}" != "true" ]]; then
  log "WARNING: CloudWatch Agent could not fetch its config after 5 attempts - continuing bootstrap without it. See this step's comment for how to retry by hand."
fi

# --- App user, directories -------------------------------------------------------------
id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "${APP_USER}"
mkdir -p "${APP_DIR}/releases" "${APP_DIR}/scripts" "${LOG_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${LOG_DIR}"

# env.conf is the one thing deploy-backend.sh can't derive on its own at deploy time - everything
# else it needs (secrets, DB/Redis endpoints) it reads fresh from Secrets Manager/SSM on every
# run, deliberately never cached on disk.
cat > "${APP_DIR}/env.conf" <<EOF
ENV_NAME=${ENV_NAME}
AWS_REGION=${AWS_REGION}
EOF
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/env.conf"

# --- systemd service ---------------------------------------------------------------------
if [[ -f /tmp/wealthynest-backend.service ]]; then
  install -m 0644 /tmp/wealthynest-backend.service /etc/systemd/system/wealthynest-backend.service
  systemctl daemon-reload
  systemctl enable wealthynest-backend
  log "systemd unit installed and enabled (not started - no JAR deployed yet, that's backend.yml's job)"
fi

# --- Firewall (defense in depth - the security group already restricts this at the AWS
#     layer to Cloudflare's published ranges; ufw is a second, host-level layer) ---------
apt-get install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "Bootstrap complete"
