#!/usr/bin/env bash
# update_check.sh — the release record, read once at the start of a run.
#
# The record lives in this repository at release/<channel>.env and is changed
# only when a version is published. It holds three lines:
#   version=2.1.0
#   urgency=normal        (normal | urgent)
#   reason=One sentence shown to the person running an older copy.
#
# What an older copy does with it:
#   urgent  → stops now, says why, and offers to update.
#   normal  → says a newer version exists and carries on; from the NEXT start
#             it stops the same way until updated.
#   offline, no curl/wget, or a record it cannot read → carries on silently.
#
# The request is one anonymous HTTPS GET of a text file. Nothing about the
# machine or the run is sent.

UPDATE_RECORD_BASE="${LINUX_CLEANUP_RELEASE_URL:-https://raw.githubusercontent.com/aoneahsan/linux-cleanup/main/release}"
UPDATE_CHANNEL="${LINUX_CLEANUP_CHANNEL:-stable}"

_update_state_file() { printf '%s/update-seen' "${LINUX_CLEANUP_DATA_HOME:-$HOME/.linux-cleanup}"; }

# _update_fetch — print the record for the current channel, or fail.
_update_fetch() {
  local url="${UPDATE_RECORD_BASE}/${UPDATE_CHANNEL}.env"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 4 -- "$url" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 4 -O - -- "$url" 2>/dev/null
  else
    return 1
  fi
}

# _update_field <record> <key>
_update_field() { printf '%s\n' "$1" | sed -n "s/^$2=//p" | head -1; }

# _update_newer <a> <b> — 0 when version a is newer than b.
_update_newer() {
  [[ "$1" != "$2" ]] && [[ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" == "$1" ]]
}

# _update_how — how this copy is installed: npx | global | persistent | clone
_update_how() {
  if [[ -f "$CLEANUP_ROOT/.persistent" ]]; then printf 'persistent'
  elif [[ "${LINUX_CLEANUP_NPX:-0}" == 1 ]]; then printf 'npx'
  elif [[ "${LINUX_CLEANUP_LAUNCHER:-}" == node ]]; then printf 'global'
  else printf 'clone'
  fi
}

# _update_command <version> — the one command that updates this copy.
_update_command() {
  case "$(_update_how)" in
    npx)        printf 'npx -y linux-cleanup@%s' "$1" ;;
    global)     printf 'npm install -g linux-cleanup@%s' "$1" ;;
    persistent) printf 'npx -y linux-cleanup@%s --refresh-app' "$1" ;;
    clone)      printf 'git -C %q pull' "$CLEANUP_ROOT" ;;
  esac
}

# _update_apply <version> <args...> — update, then start the new copy with
# the same arguments. Returns only when the update could not run.
_update_apply() {
  local ver="$1"; shift
  local how; how="$(_update_how)"
  lclean_mark_finished
  case "$how" in
    npx)
      exec npx -y "linux-cleanup@$ver" "$@" ;;
    global)
      npm install -g "linux-cleanup@$ver" && exec linux-cleanup "$@" ;;
    persistent)
      npx -y "linux-cleanup@$ver" --refresh-app && exec bash "$CLEANUP_ROOT/cleanup.sh" "$@" ;;
    clone)
      git -C "$CLEANUP_ROOT" pull --ff-only && exec bash "$CLEANUP_ROOT/cleanup.sh" "$@" ;;
  esac
  return 1
}

# _update_block <version> <reason> <args...> — stop this run until updated.
_update_block() {
  local ver="$1" reason="$2"; shift 2
  local cmd; cmd="$(_update_command "$ver")"
  printf '\n%s\n' "${C_YLW}${C_BLD}linux-cleanup ${ver} is required to continue.${C_RST}"
  [[ -n "$reason" ]] && printf '  %s\n' "$reason"
  printf '  You have %s.\n\n  Update:  %s\n\n' "$LINUX_CLEANUP_VERSION" "${C_BLD}${cmd}${C_RST}"
  if [[ -t 0 ]] && (( ! ${ASSUME_YES:-0} )); then
    local reply
    read -rp "${C_BLD}?${C_RST} Update now and carry on? [Y/n] " reply || reply=n
    if [[ "${reply:-y}" =~ ^[Yy]$ ]]; then
      _update_apply "$ver" "$@"
      ui_err "The update did not finish. Run it by hand:  $cmd"
    fi
  fi
  lclean_mark_finished
  exit 3
}

# update_check <args...> — read the record and act on it. Called once, before
# any cleanup step, with the run's original arguments.
update_check() {
  local record ver urgency reason state seen
  # The desktop app bundles its own copy of this CLI and runs its own release gate
  # (app_releases, read on start and resume), so its engine never blocks on npm releases.
  [[ "${LINUX_CLEANUP_LAUNCHER:-}" == desktop ]] && return 0
  record="$(_update_fetch)" || return 0
  ver="$(_update_field "$record" version)"
  [[ "$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 0
  _update_newer "$ver" "$LINUX_CLEANUP_VERSION" || return 0
  urgency="$(_update_field "$record" urgency)"
  reason="$(_update_field "$record" reason)"
  if [[ "$urgency" == urgent ]]; then
    _update_block "$ver" "$reason" "$@"
  fi
  state="$(_update_state_file)"
  seen="$(cat -- "$state" 2>/dev/null)"
  if [[ "$seen" == "$ver" ]]; then
    _update_block "$ver" "$reason" "$@"
  fi
  mkdir -p -- "$(dirname -- "$state")" 2>/dev/null && printf '%s\n' "$ver" >"$state" 2>/dev/null
  printf '\n%s\n' "${C_CYN}ℹ${C_RST} linux-cleanup ${ver} is out (you have ${LINUX_CLEANUP_VERSION}).${reason:+ $reason}"
  printf '  This run carries on. From the next start it will ask you to update first:  %s\n\n' \
    "${C_BLD}$(_update_command "$ver")${C_RST}"
}
