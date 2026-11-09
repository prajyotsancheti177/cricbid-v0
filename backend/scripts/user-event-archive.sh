#!/usr/bin/env bash
#
# Archive user_event rows to a gzipped CSV on the server, and put them back.
#
# user_event is by far the largest thing in the database — 285 MB of a 424 MB
# total in November 2026, two thirds of it page_view rows nobody reads after a
# few weeks. Gzipped CSV holds the same 354,971 rows in 12 MB, so the data is
# kept rather than thrown away and the table stays small.
#
# Archives live OUTSIDE the repo. A deploy runs `git reset --hard`, and the
# repo is not the place for data that cannot be regenerated.
#
# Usage, from anywhere on the server:
#
#   ./user-event-archive.sh export                 # whole table -> archives/
#   ./user-event-archive.sh export 2026-08-01      # only rows before that date
#   ./user-event-archive.sh verify <file.csv.gz>   # round-trip into a temp table and compare
#   ./user-event-archive.sh restore <file.csv.gz> [table]   # load into user_event_archive
#   ./user-event-archive.sh prune  <file.csv.gz> <before-date> --confirm
#
# `prune` refuses to delete anything unless the archive it is given verifies
# first and covers every row being removed. Without --confirm it only reports.

set -euo pipefail

ARCHIVE_DIR=${ARCHIVE_DIR:-/home/ubuntu/cricBid/archives}
ENV_FILE=${ENV_FILE:-/home/ubuntu/cricBid/cricbid-v0-sql/backend/.env}

# Prisma puts connection_limit and pool_timeout in DATABASE_URL; libpq rejects
# both, so everything after the "?" is replaced with the one parameter psql needs.
raw=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
DB="${raw%%\?*}?sslmode=require"

psq() { psql "$DB" "$@"; }
rows_in() { zcat "$1" | tail -n +2 | wc -l | tr -d ' '; }

cmd=${1:-}; shift || true

case "$cmd" in

export)
  before=${1:-}
  mkdir -p "$ARCHIVE_DIR"
  if [ -n "$before" ]; then
    where="WHERE timestamp < '$before'"
    out="$ARCHIVE_DIR/user_event_before_${before//-/}.csv.gz"
  else
    where=""
    out="$ARCHIVE_DIR/user_event_$(date +%Y%m%d).csv.gz"
  fi
  echo "exporting ${before:+rows before $before}${before:+...}${before:-the whole table ...}"
  psq -c "\copy (SELECT * FROM user_event $where ORDER BY timestamp) TO STDOUT WITH (FORMAT csv, HEADER)" \
    | gzip -9 > "$out"
  echo "wrote $out ($(du -h "$out" | cut -f1), $(rows_in "$out") rows)"
  echo "now run: $0 verify $out"
  ;;

verify)
  file=${1:?usage: $0 verify <file.csv.gz>}
  tmp="user_event_verify_$$"
  echo "restoring into $tmp ..."
  psq -q -c "DROP TABLE IF EXISTS $tmp;"
  psq -q -c "CREATE TABLE $tmp (LIKE user_event INCLUDING DEFAULTS);"
  zcat "$file" | psq -q -c "\copy $tmp FROM STDIN WITH (FORMAT csv, HEADER)"
  # Compares every column of every row, not just the count.
  read -r a b < <(psq -At -F' ' -c "
    SELECT
      (SELECT md5(string_agg(x, chr(10))) FROM (SELECT t::text AS x FROM $tmp t ORDER BY id) q),
      (SELECT md5(string_agg(x, chr(10))) FROM (
         SELECT t::text AS x FROM user_event t WHERE id IN (SELECT id FROM $tmp) ORDER BY id) r)")
  psq -q -c "DROP TABLE $tmp;"
  if [ "$a" = "$b" ]; then echo "OK — archive matches the table exactly ($a)"; else
    echo "MISMATCH — archive $a vs table $b"; exit 1; fi
  ;;

restore)
  file=${1:?usage: $0 restore <file.csv.gz> [table]}
  table=${2:-user_event_archive}
  echo "restoring $file into $table ..."
  psq -q -c "CREATE TABLE IF NOT EXISTS $table (LIKE user_event INCLUDING DEFAULTS);"
  zcat "$file" | psq -q -c "\copy $table FROM STDIN WITH (FORMAT csv, HEADER)"
  psq -At -c "SELECT '$table now holds ' || count(*) || ' rows' FROM $table"
  ;;

prune)
  file=${1:?usage: $0 prune <file.csv.gz> <before-date> [--confirm]}
  before=${2:?usage: $0 prune <file.csv.gz> <before-date> [--confirm]}
  confirm=${3:-}

  "$0" verify "$file"

  # Every row about to go must be present in the archive, by id.
  missing=$(zcat "$file" | tail -n +2 | cut -d, -f1 | tr -d '"' | sort > /tmp/arch_ids.$$
    psq -At -c "SELECT id FROM user_event WHERE timestamp < '$before'" | sort > /tmp/del_ids.$$
    comm -23 /tmp/del_ids.$$ /tmp/arch_ids.$$ | wc -l | tr -d ' ')
  rm -f /tmp/arch_ids.$$ /tmp/del_ids.$$
  doomed=$(psq -At -c "SELECT count(*) FROM user_event WHERE timestamp < '$before'")

  echo "$doomed rows are older than $before; $missing of them are NOT in the archive"
  [ "$missing" = "0" ] || { echo "refusing: the archive does not cover every row"; exit 1; }

  if [ "$confirm" != "--confirm" ]; then
    echo "dry run. re-run with --confirm to delete, then VACUUM FULL to reclaim the disk."
    exit 0
  fi
  psq -c "DELETE FROM user_event WHERE timestamp < '$before';"
  echo "deleted. Space is not returned to the OS until:"
  echo "  psql \"\$DB\" -c 'VACUUM FULL user_event;'   # exclusive lock, minutes — run off-peak"
  ;;

*)
  sed -n '2,30p' "$0"; exit 1 ;;
esac
