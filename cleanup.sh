#!/usr/bin/env bash
# linux-cleanup — modular, safe, interactive disk + cache cleanup tool.
# Run: ./cleanup.sh           (interactive menu)
#      ./cleanup.sh --help    (full options)

set -u
set -o pipefail

CLEANUP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CLEANUP_ROOT

ASSUME_YES=0
DAYS=100
NO_REPORT=0
CLEANUP_LOGS_ON_FINISH=0

# Persistent data dirs. The Node launcher (bin/linux-cleanup.js) sets these
# to ~/.linux-cleanup/{logs,reports}/ when run via npx so reports/logs survive
# npm cache eviction. Falls back to in-package dirs for direct git-clone use.
LOG_DIR="${LINUX_CLEANUP_LOG_DIR:-$CLEANUP_ROOT/logs}"
REPORTS_DIR="${LINUX_CLEANUP_REPORTS_DIR:-$CLEANUP_ROOT/reports}"
LOG_FILE="$LOG_DIR/cleanup-$(date +%Y-%m-%d_%H%M%S).log"
mkdir -p "$LOG_DIR" "$REPORTS_DIR"
export LOG_DIR REPORTS_DIR LOG_FILE NO_REPORT

# shellcheck source=lib/common.sh
source "$CLEANUP_ROOT/lib/common.sh"
# shellcheck source=lib/scan.sh
source "$CLEANUP_ROOT/lib/scan.sh"
# shellcheck source=modules/pkg_managers.sh
source "$CLEANUP_ROOT/modules/pkg_managers.sh"
# shellcheck source=modules/app_caches.sh
source "$CLEANUP_ROOT/modules/app_caches.sh"
# shellcheck source=modules/dev_tools.sh
source "$CLEANUP_ROOT/modules/dev_tools.sh"
# shellcheck source=modules/system_sudo.sh
source "$CLEANUP_ROOT/modules/system_sudo.sh"
# shellcheck source=modules/personal_stale.sh
source "$CLEANUP_ROOT/modules/personal_stale.sh"
# shellcheck source=modules/all_safe.sh
source "$CLEANUP_ROOT/modules/all_safe.sh"
# shellcheck source=modules/node_modules_finder.sh
source "$CLEANUP_ROOT/modules/node_modules_finder.sh"
# shellcheck source=modules/editor_extensions.sh
source "$CLEANUP_ROOT/modules/editor_extensions.sh"
# shellcheck source=modules/reports.sh
source "$CLEANUP_ROOT/modules/reports.sh"
# shellcheck source=modules/walkthrough.sh
source "$CLEANUP_ROOT/modules/walkthrough.sh"
# shellcheck source=modules/release_helpers.sh
source "$CLEANUP_ROOT/modules/release_helpers.sh"

usage() {
  cat <<EOF
${C_BLD}linux-cleanup${C_RST} — disk & cache cleanup utility

${C_BLD}USAGE${C_RST}
  $(basename "$0") [mode] [options]

${C_BLD}MODES${C_RST} (pick one; default = guided walkthrough through every category)
  -w, --walkthrough    Guided walkthrough (default if no args given)
  -m, --menu           Jump-to menu (pick a single category to run)
  -a, --all-safe       One-shot clean of every regenerable cache (no per-step prompts)
  -s, --scan           Read-only — show what's reclaimable, no deletes
  -p, --stale          Find personal files unused N days (interactive only)
      --system         Run sudo cleanup (apt, journal, kernels, snap, /tmp, page-cache)
      --partials       Find partial / orphan downloads (.fdmdownload, .crdownload, .part)
      --audit          Show top 20 largest entries in \$HOME
      --node-modules   Find stale node_modules in projects untouched N+ days
      --editor-ext     Clean superseded VS Code / Cursor extension versions
      --reports        Reports manager — list / convert (MD/HTML) / view past reports
      --export FMT ID  Non-interactive: export report to MD/HTML/both
                       FMT = md | html | both     ID = N | latest | all
      --feedback       How to report bugs / send feedback to the author
      --debug-bundle   Bundle latest log + report into a tar.gz for emailing
      --list-targets   Print every path the script can touch
      --self-test      Verify dependencies, syntax, safety guards
  -V, --version        Show version + author info
      --no-color       Disable colored output (also via NO_COLOR env)
      --install-alias  Add 'cleanup' alias to your shell rc
      --install-cron   Schedule weekly all-safe run (Sunday 3 AM)
      --uninstall-alias  Remove the shell alias
      --uninstall-cron   Remove the cron entry

${C_BLD}OPTIONS${C_RST}
  -d, --days N         Threshold for "stale" (default: 100)
  -y, --yes            Auto-confirm regenerable-cache deletions (with --all-safe only)
      --no-report      Skip JSON session report generation (logs still kept)
      --cleanup-logs   Delete this run's log files at finish (reports always kept)
  -h, --help           Show this help

${C_BLD}EXAMPLES${C_RST}
  $(basename "$0")                       # guided walkthrough through every category
  $(basename "$0") -m                    # jump-to menu
  $(basename "$0") -a -y                 # wipe all regenerable caches, no prompts
  $(basename "$0") -s                    # scan & report
  $(basename "$0") -p -d 60              # find personal files untouched 60+ days
  $(basename "$0") --system              # sudo system cleanup
  $(basename "$0") --partials            # cleanup orphan partial downloads

${C_BLD}SAFETY${C_RST}
  • Allowlist-based: refuses to delete inside ~/Documents, ~/Pictures, ~/Music,
    ~/Videos, ~/Desktop, ~/.ssh, ~/.gnupg, ~/.claude, ~/.config, ~/Public, etc.
  • Personal-data scans are interactive only — no batch / no --yes for personal files.

${C_BLD}OUTPUT${C_RST}  (everything stays inside the project folder)
  • Logs:    $LOG_DIR/
  • Reports: $REPORTS_DIR/
  • Cron log: $LOG_DIR/cron.log (when --install-cron is used)

${C_BLD}ABOUT${C_RST}
  linux-cleanup v${LINUX_CLEANUP_VERSION}  ·  by ${LINUX_CLEANUP_AUTHOR} <${LINUX_CLEANUP_EMAIL}>
  ${LINUX_CLEANUP_WEB}  ·  ${LINUX_CLEANUP_LINKEDIN}
  Licensed under: ${LINUX_CLEANUP_LICENSE}  (see LICENSE)
EOF
}

MODE="walkthrough"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -w|--walkthrough) MODE=walkthrough ;;
    -m|--menu|-i|--interactive) MODE=menu ;;
    -a|--all-safe)    MODE=allsafe ;;
    -s|--scan)        MODE=scan ;;
    -p|--stale)       MODE=stale ;;
    --system)         MODE=system ;;
    --partials)       MODE=partials ;;
    --audit)          MODE=audit ;;
    --node-modules)   MODE=nodemod ;;
    --editor-ext)     MODE=editorext ;;
    --reports)        MODE=reports ;;
    --export)         MODE=export; EXPORT_FMT="${2:-both}"; EXPORT_ID="${3:-latest}"; shift 2 || true ;;
    --feedback)       MODE=feedback ;;
    --debug-bundle)   MODE=debug_bundle ;;
    --list-targets)   MODE=list_targets ;;
    --self-test)      MODE=self_test ;;
    -V|--version)     MODE=version ;;
    --no-color)       export CLEANUP_NO_COLOR=1 ;;
    --install-alias)  MODE=install_alias ;;
    --install-cron)   MODE=install_cron ;;
    --uninstall-alias) MODE=uninstall_alias ;;
    --uninstall-cron)  MODE=uninstall_cron ;;
    -d|--days)        DAYS="${2:?missing days value}"; shift ;;
    -y|--yes)         ASSUME_YES=1 ;;
    --no-report)      NO_REPORT=1 ;;
    --cleanup-logs)   CLEANUP_LOGS_ON_FINISH=1 ;;
    -h|--help)        usage; exit 0 ;;
    *) printf '%s\n' "Unknown arg: $1"; usage; exit 2 ;;
  esac
  shift
done
export ASSUME_YES DAYS

# Write a credit header to the log BEFORE tee starts. Every log file is
# self-attributing so it's clear who/what produced it, even years later.
{
  printf '# ============================================================\n'
  printf '# linux-cleanup v%s — session log\n' "$LINUX_CLEANUP_VERSION"
  printf '# Author:  %s <%s>\n' "$LINUX_CLEANUP_AUTHOR" "$LINUX_CLEANUP_EMAIL"
  printf '# Web:     %s\n' "$LINUX_CLEANUP_WEB"
  printf '# License: %s\n' "$LINUX_CLEANUP_LICENSE"
  printf '# Started: %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
  printf '# Mode:    %s\n' "$MODE"
  printf '# Host:    %s\n' "$(hostname)"
  printf '# User:    %s\n' "$USER"
  [[ "${LINUX_CLEANUP_NPX:-0}" == 1 ]] && printf '# Runner:  npx (ephemeral install)\n'
  printf '# ============================================================\n'
} > "$LOG_FILE"

# Tee all subsequent output to log (preserves terminal colors via -t check in common.sh)
exec > >(tee -a "$LOG_FILE") 2>&1

# Suppress banner + log spam for utility modes that have their own output.
case "$MODE" in
  walkthrough|version|list_targets|self_test|export|feedback|debug_bundle) ;;
  *)
    ui_banner
    ui_info "Mode: $MODE   Stale-threshold: ${DAYS}d   Auto-yes: $ASSUME_YES"
    ui_info "Log: $LOG_FILE"
    ;;
esac

DISK_BEFORE_AVAIL=$(df --output=avail -B1 / 2>/dev/null | tail -1 | tr -d ' ')
DISK_BEFORE_AVAIL=${DISK_BEFORE_AVAIL:-0}

run_menu() {
  while true; do
    ui_box "Jump-to menu" "Pick a single category — or press q to quit"
    cat <<MENU
  ${C_BLD}Inspect${C_RST}
    ${C_GRN}1${C_RST})  Scan & report (no deletes)
    ${C_GRN}9${C_RST})  Top 20 largest entries in \$HOME
    ${C_GRN}12${C_RST}) Show disk + memory usage

  ${C_BLD}Clean — safe / regenerable${C_RST}
    ${C_GRN}2${C_RST})  All regenerable caches (batch)
    ${C_GRN}3${C_RST})  Package-manager caches (yarn, npm, pnpm, composer, pip)
    ${C_GRN}4${C_RST})  App caches (Chrome, Gradle, Cypress, Playwright, Zoom, TS)
    ${C_GRN}5${C_RST})  Dev-tool data (Android AVDs, pub, dart, flatpak)
    ${C_GRN}11${C_RST}) Old VS Code / Cursor extension versions

  ${C_BLD}Project + personal (interactive)${C_RST}
    ${C_GRN}10${C_RST}) Stale node_modules in old projects
    ${C_GRN}8${C_RST})  Partial / orphan downloads
    ${C_GRN}7${C_RST})  Personal files unused ${DAYS}+ days

  ${C_BLD}System${C_RST}
    ${C_GRN}6${C_RST})  System cleanup (sudo: apt, journal, kernels, snap, tmp, pagecache)

  ${C_BLD}Reports${C_RST}
    ${C_GRN}15${C_RST}) Reports manager (list / convert / view past reports)

  ${C_BLD}Setup${C_RST}
    ${C_GRN}13${C_RST}) Install 'cleanup' shell alias
    ${C_GRN}14${C_RST}) Install weekly cron (Sunday 3 AM, all-safe)

  ${C_BLD}Help / Feedback${C_RST}
    ${C_GRN}16${C_RST}) Send feedback / report a bug (offline — email)
    ${C_GRN}17${C_RST}) Create debug bundle (latest log + report → tar.gz)

    ${C_GRN}q${C_RST})  Quit
MENU
    printf '\n  %b→%b ' "${C_BLD}" "${C_RST}"
    local choice
    read -r choice || break
    case "$choice" in
      1)  run_scan_all ;;
      2)  run_all_safe ;;
      3)  run_pkg_managers ;;
      4)  run_app_caches ;;
      5)  run_dev_tools ;;
      6)  run_system ;;
      7)  run_stale_personal ;;
      8)  run_partial_downloads ;;
      9)  run_size_audit ;;
      10) run_stale_node_modules ;;
      11) run_editor_extensions ;;
      12) ui_show_disk ;;
      13) install_alias ;;
      14) install_cron ;;
      15) run_reports_manager ;;
      16) show_feedback ;;
      17) make_debug_bundle ;;
      q|Q) break ;;
      *)  ui_warn "unknown choice: $choice" ;;
    esac
  done
}

install_alias() {
  ui_section "Install shell alias"
  local target_file="$HOME/.bash_aliases"
  if [[ -f "$HOME/.zshrc" && ! -f "$HOME/.bash_aliases" ]]; then
    target_file="$HOME/.zshrc"
  fi
  local line="alias cleanup='$CLEANUP_ROOT/cleanup.sh'"
  if grep -qsF "$line" "$target_file" 2>/dev/null; then
    ui_info "alias already present in $target_file"
    return
  fi
  if ui_confirm "Add 'cleanup' alias to $target_file ?" y; then
    {
      printf '\n'
      printf '# linux-cleanup tool\n'
      printf '%s\n' "$line"
    } >> "$target_file"
    ui_ok "added. Run: source $target_file  (or open a new terminal), then 'cleanup'"
  fi
}

install_cron() {
  ui_section "Install weekly cron"
  local cron_line="0 3 * * 0 $CLEANUP_ROOT/cleanup.sh --all-safe -y >>$CLEANUP_ROOT/logs/cron.log 2>&1"
  if crontab -l 2>/dev/null | grep -qF "$CLEANUP_ROOT/cleanup.sh"; then
    ui_info "cron entry already present:"
    crontab -l 2>/dev/null | grep -F "$CLEANUP_ROOT/cleanup.sh" | sed 's/^/  /'
    return
  fi
  ui_info "Will add: $cron_line"
  if ui_confirm "Add this entry to crontab?" y; then
    ( crontab -l 2>/dev/null; printf '%s\n' "$cron_line" ) | crontab -
    ui_ok "cron installed (runs every Sunday 03:00, logs to logs/cron.log)"
  fi
}

case "$MODE" in
  walkthrough)   guided_walkthrough ;;
  scan)          run_scan_all ;;
  allsafe)       run_all_safe ;;
  stale)         run_stale_personal ;;
  system)        run_system ;;
  partials)      run_partial_downloads ;;
  audit)         run_size_audit ;;
  nodemod)       run_stale_node_modules ;;
  editorext)     run_editor_extensions ;;
  reports)       run_reports_manager ;;
  export)        export_reports "$EXPORT_FMT" "$EXPORT_ID" ;;
  feedback)      show_feedback ;;
  debug_bundle)  make_debug_bundle ;;
  list_targets)  list_targets ;;
  self_test)     self_test ;;
  version)       show_version ;;
  install_alias) install_alias ;;
  install_cron)  install_cron ;;
  uninstall_alias) uninstall_alias ;;
  uninstall_cron)  uninstall_cron ;;
  menu)          run_menu ;;
  *) ui_err "unknown mode: $MODE"; exit 2 ;;
esac

DISK_AFTER_AVAIL=$(df --output=avail -B1 / 2>/dev/null | tail -1 | tr -d ' ')
DISK_AFTER_AVAIL=${DISK_AFTER_AVAIL:-0}
RECOVERED=$(( DISK_AFTER_AVAIL - DISK_BEFORE_AVAIL ))

# Walkthrough prints its own polished summary; utility modes don't need one.
case "$MODE" in
  walkthrough|version|list_targets|self_test|export|feedback|debug_bundle|uninstall_alias|uninstall_cron|install_alias|install_cron) ;;
  *)
  ui_section "Session summary"
  if (( RECOVERED > 0 )); then
    ui_ok "Recovered: $(bytes_pretty "$RECOVERED")"
  elif (( RECOVERED < 0 )); then
    ui_warn "Disk usage grew during session: $(bytes_pretty $(( -RECOVERED )))"
  else
    ui_info "No measurable change."
  fi
  ui_show_disk
  ui_info "Log saved: $LOG_FILE"
  ;;
esac

# ── Optional: clean up log files on finish (reports are NEVER auto-deleted) ──
if (( CLEANUP_LOGS_ON_FINISH )); then
  # Sleep briefly so any deferred tee writes flush, then unlink all .log files.
  # On Linux, deleting a file with an open fd is safe — fd stays valid until close.
  sleep 0.2 2>/dev/null || true
  find "$LOG_DIR" -maxdepth 1 -type f -name 'cleanup-*.log' -delete 2>/dev/null
  printf '%bℹ logs cleaned (--cleanup-logs)%b  reports preserved at: %s\n' \
    "${C_DIM}" "${C_RST}" "$REPORTS_DIR" >&2
fi
