#!/bin/sh
# Operator runs this with the reviewed staging env and a private encrypted mount.
set -eu
umask 077
: "${VISIONTECH_BACKUP_SCRATCH:?encrypted scratch mount required}"
: "${RESTIC_REPOSITORY:?independent repository required}"
: "${RESTIC_PASSWORD_FILE:?separate recovery password file required}"
case "$RESTIC_REPOSITORY" in s3:https://*) ;; *) echo 'Expected HTTPS S3 repository.' >&2; exit 1;; esac
[ "$SUPABASE_URL" = 'https://fszrsispjxunckknphaw.supabase.co' ]
[ -r "$RESTIC_PASSWORD_FILE" ]
mountpoint -q "$VISIONTECH_BACKUP_SCRATCH"
work=$(mktemp -d "$VISIONTECH_BACKUP_SCRATCH/visiontech.XXXXXXXX")
trap 'rm -rf -- "$work"' EXIT
app=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
case "${1:-backup}" in
  verify)
    restic check --read-data
    restic restore latest --host visiontech-staging --tag product-media --target "$work/recovered"
    manifest=$(find "$work/recovered" -name manifest.json -type f)
    [ -f "$manifest" ]
    node "$app/deploy/staging/verify-snapshot.mjs" "$(dirname "$manifest")"
    exit 0 ;;
  backup) ;;
  *) echo 'Expected backup or verify.' >&2; exit 2 ;;
esac
node "$app/services/product-media-backup.mjs" backup "$work/catalogue" fszrsispjxunckknphaw.supabase.co
node "$app/deploy/staging/backup-metadata.mjs" "$work/catalogue"
node "$app/deploy/staging/verify-snapshot.mjs" "$work/catalogue"
(cd "$work" && restic backup --host visiontech-staging --tag product-media catalogue)
restic check
if [ "${VISIONTECH_APPLY_RETENTION:-false}" = true ]; then
  restic forget --host visiontech-staging --tag product-media --group-by host,tags --keep-daily 30 --prune
  restic check
else
  restic forget --host visiontech-staging --tag product-media --group-by host,tags --keep-daily 30 --dry-run
fi
