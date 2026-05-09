#!/usr/bin/env bash
# crash_trap.sh — auto-bundle on unexpected script termination.
#
# linux-cleanup intentionally does NOT use `set -e` (many checks let commands
# return non-zero without aborting). So instead of an ERR trap (which would
# fire on every benign non-zero), we install an EXIT trap and only treat
# the exit as a crash when:
#   1. exit code is non-zero, AND
#   2. the main script never set the LCLEAN_FINISHED sentinel,
# meaning we exited unexpectedly (signal, syntax error, unset var under
# `set -u`, kill, etc.) instead of running off the end normally.
#
# On crash: write a minimal manifest + bundle the active log/report into
# ~/.linux-cleanup/feedback/crash-<stamp>.tar.gz and print a one-liner the
# user can email. No network calls — ever.

LCLEAN_FINISHED=${LCLEAN_FINISHED:-0}

_lclean_crash_dir() {
  local parent
  if [[ -n "${LINUX_CLEANUP_DATA_HOME:-}" ]]; then
    parent="$LINUX_CLEANUP_DATA_HOME"
  else
    parent="$(dirname "${LOG_DIR:-/tmp}")"
  fi
  printf '%s/feedback' "$parent"
}

_lclean_on_exit() {
  local exit_code=$?
  # Clean exit OR sentinel set → nothing to do.
  if (( LCLEAN_FINISHED == 1 )) || (( exit_code == 0 )); then
    return 0
  fi
  # User-initiated interrupt (Ctrl-C = 130, SIGTERM = 143) is not a crash.
  if (( exit_code == 130 )) || (( exit_code == 143 )); then
    return 0
  fi
  # `usage; exit 2` from arg parsing is not a crash — script printed help & bailed.
  if (( exit_code == 2 )); then
    return 0
  fi

  # Disarm so a failure inside the handler doesn't recurse.
  trap - EXIT
  set +u +o pipefail 2>/dev/null || true

  # Soft-fail: never let the handler itself produce its own error.
  {
    local crash_dir; crash_dir="$(_lclean_crash_dir)"
    mkdir -p "$crash_dir" 2>/dev/null || true
    local stamp; stamp="$(date +%Y-%m-%d_%H%M%S)"
    local out="$crash_dir/crash-$stamp.tar.gz"
    local tmp; tmp="$(mktemp -d 2>/dev/null)" || tmp="/tmp/lclean-crash-$$"
    mkdir -p "$tmp" 2>/dev/null || true

    {
      printf 'linux-cleanup v%s — CRASH REPORT\n' "${LINUX_CLEANUP_VERSION:-?}"
      printf 'Generated:  %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
      printf 'Exit code:  %s\n' "$exit_code"
      printf 'Mode:       %s\n' "${MODE:-unknown}"
      printf '\n=== System info ===\n'
      printf 'Distro:     %s\n' "$(lsb_release -d 2>/dev/null | cut -f2- || uname -sr)"
      printf 'Kernel:     %s\n' "$(uname -srm)"
      printf 'Bash:       %s\n' "$(bash --version 2>/dev/null | head -1)"
      printf '\n=== Privacy note ===\n'
      printf 'This bundle was generated locally. Nothing has been sent.\n'
      printf 'Review every file before emailing — logs/reports include $HOME paths.\n'
      printf '\nSend to: %s\n' "${LINUX_CLEANUP_EMAIL:-aoneahsan@gmail.com}"
    } > "$tmp/CRASH_MANIFEST.txt" 2>/dev/null

    [[ -n "${LOG_FILE:-}" && -f "${LOG_FILE:-}" ]] && cp "$LOG_FILE" "$tmp/" 2>/dev/null
    local latest_report
    latest_report="$(ls -t "${REPORTS_DIR:-/dev/null}"/report-*.json 2>/dev/null | head -1 || true)"
    [[ -n "$latest_report" ]] && cp "$latest_report" "$tmp/" 2>/dev/null

    tar -czf "$out" -C "$tmp" . 2>/dev/null && rm -rf "$tmp" 2>/dev/null

    printf '\n'
    printf '%s\n' "${C_RED:-}${C_BLD:-}══════════════════════════════════════════════════════════════════════════════${C_RST:-}"
    printf '  %slinux-cleanup exited unexpectedly (exit %s).%s\n' "${C_RED:-}${C_BLD:-}" "$exit_code" "${C_RST:-}"
    printf '%s\n' "${C_RED:-}${C_BLD:-}══════════════════════════════════════════════════════════════════════════════${C_RST:-}"
    if [[ -f "$out" ]]; then
      printf '\n  %sCrash bundle:%s %s\n' "${C_BLD:-}" "${C_RST:-}" "$out"
      printf '  %sSize:%s         %s\n' "${C_DIM:-}" "${C_RST:-}" "$(du -h -- "$out" 2>/dev/null | cut -f1)"
    fi
    printf '\n  %sHelp the author fix this:%s\n' "${C_BLD:-}" "${C_RST:-}"
    printf '    1. Review the bundle (it contains $HOME paths from your machine).\n'
    printf '       %star -tzf %s%s\n' "${C_DIM:-}" "${out}" "${C_RST:-}"
    printf '    2. Email it to %s%s%s\n' \
      "${C_BLD:-}" "${LINUX_CLEANUP_EMAIL:-aoneahsan@gmail.com}" "${C_RST:-}"
    printf '    3. Or run %slinux-cleanup --feedback%s for a pre-filled draft.\n' \
      "${C_BLD:-}" "${C_RST:-}"
    printf '\n  %sNothing was sent. linux-cleanup makes no network calls.%s\n\n' \
      "${C_DIM:-}" "${C_RST:-}"
  } >&2 2>/dev/null

  exit "$exit_code"
}

lclean_arm_crash_trap() {
  trap '_lclean_on_exit' EXIT
}

# Call this just before normal script end so the EXIT trap stays quiet.
lclean_mark_finished() {
  LCLEAN_FINISHED=1
}
