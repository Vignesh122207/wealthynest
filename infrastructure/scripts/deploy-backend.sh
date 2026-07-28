#!/usr/bin/env bash
#
# Invoked over SSM Run Command by .github/workflows/backend.yml (as root, AWS-RunShellScript's
# default). Three call forms:
#
#   deploy-backend.sh <s3-bucket> <s3-key> <version>   # normal deploy
#   deploy-backend.sh --rollback                        # revert to the last known-good release
#   deploy-backend.sh --refresh-env                      # re-read secrets/params, restart, no new JAR
#
# --refresh-env exists for DatabaseStack's Secrets Manager rotation schedule (db-credentials
# rotates automatically every N days - see DatabaseStack's own comment on the operational caveat):
# a rotated password only takes effect for *new* DB connections once current.env is rewritten with
# it, which only otherwise happens on the next actual deploy. Run this by hand over SSM after a
# rotation (or point a scheduled trigger at it) rather than waiting for the next deploy to happen
# to fix it.
#
# Release layout, borrowed from the standard "releases + current symlink" pattern so a rollback
# is just re-pointing a symlink and restarting, never a redeploy:
#   /opt/wealthynest/releases/<version>/app.jar
#   /opt/wealthynest/current -> releases/<version>       (systemd's ExecStart always points here)
#   /opt/wealthynest/current-version                     (plain text, last release that passed its
#                                                          own health check - what --rollback targets)
set -euo pipefail

APP_DIR=/opt/wealthynest
RELEASES_DIR="$APP_DIR/releases"
CURRENT_LINK="$APP_DIR/current"
ENV_FILE="$APP_DIR/current.env"
STATE_FILE="$APP_DIR/current-version"
SERVICE=wealthynest-backend
HEALTH_URL="http://127.0.0.1:8080/actuator/health"
KEEP_RELEASES=5

log() { echo "[deploy] $(date -u +%FT%TZ) $*"; }

# ENV_NAME, AWS_REGION - written once by bootstrap-ec2.sh, read on every deploy/rollback so this
# script never needs its own copy of environment-specific config.
# shellcheck disable=SC1091
source "$APP_DIR/env.conf"

secret_field() { # $1 = secret name suffix, $2 = jq filter - for a JSON-shaped secret only
  # (db-credentials, smtp-credentials). jq parses its input as JSON first; a plain-string
  # secret's raw value (e.g. a bare 64-char alphanumeric JWT secret) is not valid JSON on its
  # own - `jq -r "."` on one fails with a parse error and silently yields an empty string. Use
  # secret_value() below for those instead.
  aws secretsmanager get-secret-value --region "$AWS_REGION" \
    --secret-id "wealthynest-${ENV_NAME}-$1" --query SecretString --output text | jq -r "$2"
}

secret_value() { # $1 = secret name suffix - for a plain-string secret; no JSON parsing involved
  aws secretsmanager get-secret-value --region "$AWS_REGION" \
    --secret-id "wealthynest-${ENV_NAME}-$1" --query SecretString --output text
}

ssm_value() {
  aws ssm get-parameter --region "$AWS_REGION" --name "/wealthynest/${ENV_NAME}/$1" --query Parameter.Value --output text
}

write_env_file() {
  log "Writing ${ENV_FILE}"
  umask 077
  {
    echo "PORT=8080"
    echo "SPRING_PROFILES_ACTIVE=prod"
    echo "DB_URL=$(ssm_value db-url)"
    echo "DB_USERNAME=$(secret_field db-credentials .username)"
    echo "DB_PASSWORD=$(secret_field db-credentials .password)"
    echo "REDIS_HOST=$(ssm_value redis-host)"
    echo "REDIS_PORT=$(ssm_value redis-port)"
    echo "JWT_SECRET=$(secret_value jwt-secret)"
    echo "VAULT_ENCRYPTION_KEY=$(secret_value vault-encryption-key)"
    echo "VAULT_HASH_PEPPER=$(secret_value vault-hash-pepper)"
    echo "GOOGLE_NATIVE_CLIENT_SECRET=$(secret_value google-oauth-client-secret)"
    echo "MAIL_HOST=smtp-relay.brevo.com"
    echo "MAIL_PORT=587"
    echo "MAIL_USERNAME=$(secret_field smtp-credentials .MAIL_USERNAME)"
    echo "MAIL_PASSWORD=$(secret_field smtp-credentials .MAIL_PASSWORD)"
    echo "FCM_SERVICE_ACCOUNT_JSON=$(secret_value fcm-service-account)"
    echo "CORS_ORIGINS=https://wealthynest.in"
    echo "FRONTEND_URL=https://wealthynest.in"
    echo "RATE_LIMIT_TRUSTED_PROXIES=$(ssm_value rate-limit-trusted-proxies)"
    # GOOGLE_CLIENT_ID / GOOGLE_NATIVE_CLIENT_ID are public (non-secret) OAuth client IDs, not
    # provisioned by CDK — from the OAuth clients already created in Google Cloud Console (see
    # docs/secrets-management-guide.md).
    echo "GOOGLE_CLIENT_ID=510219615328-nsin4tqf2pe39vd0qg7pd23guq9da7a6.apps.googleusercontent.com"
    echo "GOOGLE_NATIVE_CLIENT_ID=510219615328-2pspp599ckp92b6kfrrkk8ovkdlj61uj.apps.googleusercontent.com"
  } > "$ENV_FILE"
  chown wealthynest:wealthynest "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

wait_for_health() {
  local tries=0
  until curl -sf "$HEALTH_URL" 2>/dev/null | grep -q '"status":"UP"'; do
    tries=$((tries + 1))
    if [ "$tries" -ge 24 ]; then # 24 * 5s = 2 minutes
      return 1
    fi
    sleep 5
  done
  return 0
}

switch_to() {
  local version="$1"
  ln -sfn "$RELEASES_DIR/$version" "$CURRENT_LINK"
  systemctl restart "$SERVICE"
}

prune_old_releases() {
  # shellcheck disable=SC2012
  ls -1t "$RELEASES_DIR" 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
    log "Pruning old release ${old}"
    rm -rf "${RELEASES_DIR:?}/${old:?}"
  done
}

rollback() {
  log "Rollback requested"
  if [ ! -f "$STATE_FILE" ]; then
    log "No recorded previous version - nothing to roll back to"
    exit 1
  fi
  local previous
  previous=$(cat "$STATE_FILE")
  if [ ! -d "$RELEASES_DIR/$previous" ]; then
    log "Recorded version ${previous} is no longer on disk - cannot roll back"
    exit 1
  fi
  switch_to "$previous"
  if wait_for_health; then
    log "Rolled back to ${previous}, healthy"
    exit 0
  fi
  log "Rollback target ${previous} did NOT become healthy either - manual intervention required"
  exit 1
}

deploy() {
  local bucket="$1" s3_key="$2" version="$3"
  local release_dir="$RELEASES_DIR/$version"

  local previous_version=""
  if [ -L "$CURRENT_LINK" ]; then
    previous_version="$(basename "$(readlink -f "$CURRENT_LINK")")"
  fi

  log "Deploying version ${version} (previous: ${previous_version:-none})"
  mkdir -p "$release_dir"
  aws s3 cp "s3://${bucket}/${s3_key}" "$release_dir/app.jar"
  chown -R wealthynest:wealthynest "$release_dir"

  write_env_file
  switch_to "$version"

  if wait_for_health; then
    log "Release ${version} is healthy"
    echo "$version" > "$STATE_FILE"
    prune_old_releases
    exit 0
  fi

  log "Release ${version} failed its health check"
  if [ -n "$previous_version" ] && [ -d "$RELEASES_DIR/$previous_version" ]; then
    log "Self-rolling-back to ${previous_version}"
    switch_to "$previous_version"
    if wait_for_health; then
      log "Rolled back to ${previous_version} successfully"
    else
      log "Rollback to ${previous_version} ALSO failed its health check - manual intervention required"
    fi
  else
    log "No previous release available to roll back to (first deploy?) - leaving the broken release in place for inspection"
  fi
  exit 1
}

refresh_env() {
  log "Refreshing ${ENV_FILE} from Secrets Manager/SSM (no JAR change) and restarting ${SERVICE}"
  if [ ! -L "$CURRENT_LINK" ]; then
    log "No current release deployed yet - nothing to refresh"
    exit 1
  fi
  write_env_file
  systemctl restart "$SERVICE"
  if wait_for_health; then
    log "Refreshed and healthy"
    exit 0
  fi
  # Unlike deploy(), there's no previous JAR/env pairing to fall back to here - the JAR didn't
  # change, so a failure means the freshly-read secret itself is bad (e.g. rotation produced a
  # credential the DB user doesn't actually have yet), not a bad release. Nothing to self-roll-back
  # to; surface it loudly instead.
  log "Service did not become healthy after refreshing env - manual investigation required"
  exit 1
}

case "${1:-}" in
  --rollback)
    rollback
    ;;
  --refresh-env)
    refresh_env
    ;;
  *)
    if [ $# -lt 3 ]; then
      echo "usage: deploy-backend.sh <s3-bucket> <s3-key> <version>  |  deploy-backend.sh --rollback  |  deploy-backend.sh --refresh-env" >&2
      exit 2
    fi
    deploy "$1" "$2" "$3"
    ;;
esac
