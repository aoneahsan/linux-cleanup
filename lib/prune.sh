#!/usr/bin/env bash
# prune.sh — idle detection and the pruning helpers built on it. Sourced, not executed.
# Needs lib/common.sh (ui_*, is_protected, safe_rm, dir_bytes, bytes_pretty).

# atime_reliable [path] — 0 when the filesystem holding <path> records access
# times. On a `noatime` mount a file that is read every day keeps the atime of
# the day it was written, so "idle for N days" cannot be told from "in use" —
# a Gradle distribution launched this morning looks untouched since its
# download. Every idle-based prune below refuses there. `relatime` (the Linux
# default) moves atime at most once a day: fine for a threshold in days.
atime_reliable() {
  local path="${1:-$HOME}" opts="" real
  while [[ ! -e "$path" && "$path" != "/" ]]; do path="$(dirname -- "$path")"; done
  if command -v findmnt >/dev/null 2>&1; then
    opts="$(findmnt -no OPTIONS -T "$path" 2>/dev/null | head -1)"
  fi
  if [[ -z "$opts" ]]; then
    # No findmnt: take the longest mount point that prefixes the path (a later
    # line shadows an earlier one at the same mount point).
    real="$(realpath -m -- "$path" 2>/dev/null || printf '%s' "$path")"
    opts="$(awk -v p="$real" '
      { mp = $5
        if (mp == "/" || p == mp || index(p, mp "/") == 1) {
          if (length(mp) >= best) { best = length(mp); o = $6 }
        } }
      END { print o }' /proc/self/mountinfo 2>/dev/null)"
  fi
  [[ ",${opts}," != *,noatime,* ]]
}

# _atime_skip <path> — the shared refusal line. Goes to stderr because
# prune_stale's stdout is a byte count that callers capture.
_atime_skip() {
  ui_warn "SKIPPED ${1/#$HOME/\~} — its filesystem is mounted noatime, so last-use times are not recorded and an idle cache cannot be told from one in use. (--purge-all ignores idle time.)" >&2
}

# prune_stale <root> <days>
#
# Walks <root> and deletes only files where BOTH atime and mtime are older
# than <days> days. Then removes any directories left empty as a result.
# Refuses if <root> is in the protected list. Echoes bytes freed.
#
# This is the surgical alternative to safe_rm <dir>: instead of nuking the
# whole cache (which destroys e.g. Gradle wrapper distros the user opens
# every 1-2 months), it only takes content the user genuinely hasn't touched
# in the cooling-off window. Defaults align with $DAYS (default 100).
prune_stale() {
  local root="$1" days="${2:-${DAYS:-100}}"
  [[ -e "$root" ]] || { printf '0'; return 0; }
  if is_protected "$root"; then
    ui_err "REFUSE: protected path: $root"
    printf '0'; return 1
  fi
  if ! atime_reliable "$root"; then
    _atime_skip "$root"
    printf '0'; return 1
  fi
  local before after freed
  before=$(dir_bytes "$root")
  # Only delete a file if it's untouched (atime) AND unmodified (mtime) for >days.
  # -depth ensures we process contents before parents; -delete then nukes file/symlink.
  find "$root" -depth -mindepth 1 \
       \( -type f -o -type l \) \
       -atime +"$days" -mtime +"$days" \
       -delete 2>/dev/null || true
  # Sweep up directories that became empty.
  find "$root" -depth -mindepth 1 -type d -empty -delete 2>/dev/null || true
  after=$(dir_bytes "$root")
  freed=$(( before - after ))
  (( freed < 0 )) && freed=0
  printf '%d' "$freed"
}

# newest_access_age_days <path> [ignore-name...]
#
# For a file: prints the smaller of (now - atime) and (now - mtime), in days.
# For a directory: walks recursively and prints the freshest atime/mtime
# anywhere inside, in days. "How many days since this asset was last
# touched in any way." Echoes a very large number if the path is missing
# so callers can treat it as "definitely stale" without special-casing.
#
# Optional ignore-names skip marker files that other software reads without
# using the asset — e.g. Android Studio reads every old version's `.home` at
# startup, which would otherwise make a long-dead IDE cache look fresh.
newest_access_age_days() {
  local path="$1"; shift
  [[ -e "$path" ]] || { printf '999999'; return; }
  local now newest
  now=$(date +%s)
  if [[ -f "$path" || -L "$path" ]]; then
    local at mt
    at=$(stat -c %X -- "$path" 2>/dev/null || echo 0)
    mt=$(stat -c %Y -- "$path" 2>/dev/null || echo 0)
    newest=$(( at > mt ? at : mt ))
  else
    local ignore=() name
    for name in "$@"; do ignore+=( ! -name "$name" ); done
    # Look at FILES only — directory atimes/mtimes get bumped by routine
    # operations (creating, renaming, listing in some FS configs) and don't
    # reflect actual usage of the underlying asset. Files are the truth.
    newest=$(find "$path" \( -type f -o -type l \) ${ignore[@]+"${ignore[@]}"} \
             -printf '%A@\n%T@\n' 2>/dev/null \
             | awk -F. '{print $1}' | sort -n | tail -1)
    if [[ -z "$newest" || "$newest" == "0" ]]; then
      # Empty dir or unreadable — fall back to dir's own mtime as last resort.
      newest=$(stat -c %Y -- "$path" 2>/dev/null || echo 0)
    fi
  fi
  printf '%d' $(( (now - newest) / 86400 ))
}

# Whole-unit removal tallies. Callers that need totals zero them first; unit
# helpers print their own progress lines, so they cannot also return a byte
# count on stdout. UNITS_VERBOSE=0 silences the per-unit lines for caches with
# thousands of entries (package caches); callers then print a summary.
UNITS_FREED=0
UNITS_REMOVED=0
UNITS_KEPT=0
UNITS_VERBOSE=1

# remove_unit <path> <label> — delete one whole unit and add its size to UNITS_FREED.
remove_unit() {
  local path="$1" label="$2" b
  b=$(dir_bytes "$path")
  if safe_rm "$path"; then
    UNITS_FREED=$(( UNITS_FREED + b ))
    UNITS_REMOVED=$(( UNITS_REMOVED + 1 ))
    (( UNITS_VERBOSE )) && ui_ok "  removed ${label} ($(bytes_pretty "$b"))"
  fi
  return 0
}

# prune_stale_units <root> <days> <glob> [ignore-name...]
#
# Treats each directory matching <root>/<glob> as one indivisible unit (a
# Gradle per-version cache, an old IDE version, one extracted package in a
# package cache, one npx install tree, one browser build). A unit is
# deleted whole only when nothing inside it — ignoring the named marker
# files — has been read or written for more than <days> days. Recently-used
# units survive intact. Never deletes part of a unit: for caches like these a
# half-deleted unit is corrupt, not smaller. Adds bytes freed to UNITS_FREED.
prune_stale_units() {
  local root="$1" days="$2" pattern="$3"; shift 3
  [[ -d "$root" ]] || return 0
  if is_protected "$root"; then
    ui_err "REFUSE: protected path: $root"
    return 1
  fi
  if ! atime_reliable "$root"; then
    _atime_skip "$root"
    return 1
  fi
  local entry age
  shopt -s nullglob dotglob
  for entry in "$root"/$pattern; do
    [[ -d "$entry" ]] || continue
    age=$(newest_access_age_days "$entry" "$@")
    if (( age > days )); then
      remove_unit "$entry" "${entry/#$HOME/\~} — ${age}d idle"
    else
      UNITS_KEPT=$(( UNITS_KEPT + 1 ))
      (( UNITS_VERBOSE )) && ui_info "  kept ${entry/#$HOME/\~} (${age}d idle — within ${days}d window)"
    fi
  done
  shopt -u nullglob dotglob
}

# prune_package_cache <root> <glob> — quiet whole-entry pruning for a cache
# made of extracted package DIRECTORIES (yarn v1, npx trees, pub, bun,
# Cypress/Playwright builds, TypeScript typings). File-level pruning there
# leaves packages that look installed but are missing files — a tool breaks on
# the first code path it had not used in the window. Prints one summary line;
# adds bytes freed to UNITS_FREED. No prompt: callers confirm.
prune_package_cache() {
  local root="$1" glob="$2" before_freed=$UNITS_FREED
  [[ -d "$root" ]] || return 0
  UNITS_REMOVED=0; UNITS_KEPT=0; UNITS_VERBOSE=0
  prune_stale_units "$root" "${DAYS:-100}" "$glob"
  UNITS_VERBOSE=1
  if (( UNITS_REMOVED > 0 )); then
    ui_ok "pruned ${root/#$HOME/\~}: ${UNITS_REMOVED} idle entries, $(bytes_pretty $(( UNITS_FREED - before_freed ))) freed (kept ${UNITS_KEPT} in use, whole)"
  else
    ui_info "nothing idle ≥${DAYS:-100}d in ${root/#$HOME/\~} (${UNITS_KEPT} entries in use)"
  fi
}

# clean_target_units <label> <root> <glob> [desc] — interactive wrapper around
# prune_package_cache; --purge-all keeps the legacy whole-directory wipe.
clean_target_units() {
  local label="$1" root="$2" glob="$3" desc="${4:-}"
  if [[ ! -e "$root" ]]; then
    ui_info "$label — already absent"
    return 0
  fi
  if (( ${PURGE_ALL:-0} == 1 )); then
    clean_target "$label" "$root" "$desc"
    return
  fi
  local prompt="Remove $label entries unused ≥${DAYS}d ($(dir_size "$root") in total; whole entries only)?"
  [[ -n "$desc" ]] && prompt+=" — $desc"
  if ui_confirm "$prompt" n; then
    UNITS_FREED=0
    prune_package_cache "$root" "$glob"
  else
    ui_info "$label — skipped"
  fi
}

# prune_matching_files <root> <days> <name-glob> — delete only files matching
# <name-glob> whose atime AND mtime are older than <days>. Adds bytes freed to
# UNITS_FREED. For self-contained leftovers such as old daemon logs.
prune_matching_files() {
  local root="$1" days="$2" glob="$3" b
  [[ -d "$root" ]] || return 0
  atime_reliable "$root" || { _atime_skip "$root"; return 0; }
  b=$(find "$root" -type f -name "$glob" -atime +"$days" -mtime +"$days" -printf '%s\n' 2>/dev/null \
      | awk '{s+=$1} END{printf "%d", s}')
  (( b > 0 )) || return 0
  find "$root" -type f -name "$glob" -atime +"$days" -mtime +"$days" -delete 2>/dev/null || true
  UNITS_FREED=$(( UNITS_FREED + b ))
  ui_ok "  removed old ${glob} files under ${root/#$HOME/\~} ($(bytes_pretty "$b"))"
}

# Generic interactive cleaner.
#
# Default mode (PURGE_ALL=0): prune only files unused for ≥${DAYS}d
# (both atime and mtime older than threshold). Recently-used items survive.
# This protects rarely-used-but-valuable assets like Gradle wrapper distros,
# Playwright browsers for an old release branch, etc.
#
# Full-purge mode (PURGE_ALL=1, via --purge-all): wipe the entire target.
# Use this when you genuinely want pre-1.2.0 behavior.
clean_target() {
  local label="$1" target="$2" desc="${3:-}"
  if [[ ! -e "$target" ]]; then
    ui_info "$label — already absent"
    return 0
  fi
  local size
  size="$(dir_size "$target")"

  if (( ${PURGE_ALL:-0} == 1 )); then
    local prompt="Delete $label ($size, FULL PURGE)?"
    [[ -n "$desc" ]] && prompt+=" — $desc"
    if ui_confirm "$prompt" n; then
      safe_rm "$target" && ui_ok "$label cleared ($size freed)"
    else
      ui_info "$label — skipped"
    fi
    return
  fi

  local prompt="Prune $label files unused ≥${DAYS}d ($size in total)?"
  [[ -n "$desc" ]] && prompt+=" — $desc"
  if ui_confirm "$prompt" n; then
    if is_protected "$target"; then
      ui_err "REFUSE: protected path: $target"
      return 1
    fi
    local freed
    freed=$(prune_stale "$target" "${DAYS:-100}")
    if (( freed > 0 )); then
      ui_ok "$label pruned — $(bytes_pretty "$freed") freed; $(dir_size "$target") remains (recently-used kept)"
    else
      ui_info "$label — nothing older than ${DAYS}d; nothing pruned"
    fi
  else
    ui_info "$label — skipped"
  fi
}
