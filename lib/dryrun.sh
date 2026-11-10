#!/usr/bin/env bash
# dryrun.sh — the --dry-run switch. Every command that deletes or changes
# anything goes through lclean_do or checks DRY_RUN itself, so a dry run
# walks the same steps, asks the same questions and prints what a real run
# would do, without touching a file, a package, a service or a setting.

DRY_RUN="${DRY_RUN:-0}"

# lclean_do <what> <command...> — run <command>, or under --dry-run print
# "would <what>" and succeed without running it.
lclean_do() {
  local what="$1"; shift
  if (( DRY_RUN )); then
    printf '%s\n' "${C_DIM}[dry-run] would ${what}${C_RST}"
    return 0
  fi
  "$@"
}

# dry_run_refuse <mode> — for modes that only change settings (shell rc,
# cron, saved reports). They have nothing to preview, so under --dry-run they
# say so and return 1; callers return early.
dry_run_refuse() {
  (( DRY_RUN )) || return 1
  ui_warn "$1 changes settings only, so it does nothing under --dry-run."
  return 0
}
