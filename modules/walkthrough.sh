#!/usr/bin/env bash
# walkthrough.sh — guided full walkthrough (default no-args mode).
# Canonical session report: JSON. Optional MD/HTML produced on demand.
# All output stays inside $CLEANUP_ROOT.

REPORT_FINALIZED=0

session_report_init() {
  # Honor --no-report: skip everything, leave no JSON behind.
  if [[ "${NO_REPORT:-0}" == 1 ]]; then
    REPORT_JSON="(disabled via --no-report)"
    REPORT_FINALIZED=1
    return
  fi
  # REPORTS_DIR is set by cleanup.sh (env-overridable for npx persistence).
  mkdir -p "$REPORTS_DIR"
  REPORT_BASE="report-$(date +%Y-%m-%d_%H%M%S)"
  REPORT_JSON="$REPORTS_DIR/$REPORT_BASE.json"
  REPORT_STARTED_AT="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  REPORT_STARTED_TS="$(date +%s)"

  # Capture starting state (parsed)
  REPORT_DISK_BEFORE="$(df -h / 2>/dev/null | tail -1)"
  REPORT_MEM_BEFORE="$(free -b | awk '/^Mem:/ {print $2,$3,$4,$7}')"

  REPORT_STEPS_JSON=()
  REPORT_FINALIZED=0
}

session_report_step() {
  [[ "${NO_REPORT:-0}" == 1 ]] && return 0
  local title="$1" status="$2" freed_bytes="${3:-0}"
  local n=$(( ${#REPORT_STEPS_JSON[@]} + 1 ))
  REPORT_STEPS_JSON+=("$(printf '{"n":%d,"title":%s,"status":%s,"freed_bytes":%d}' \
    "$n" "$(json_str "$title")" "$(json_str "$status")" "$freed_bytes")")
}

# Build a JSON object from a `df` line ("fs size used avail use_pct mount")
_disk_line_to_json() {
  local line="$1" fs size used avail use_pct rest
  read -r fs size used avail use_pct rest <<<"$line"
  printf '{"filesystem":%s,"size":%s,"used":%s,"avail":%s,"use_pct":%s}' \
    "$(json_str "$fs")" "$(json_str "$size")" "$(json_str "$used")" \
    "$(json_str "$avail")" "$(json_str "$use_pct")"
}

# Build a JSON object from a `free -b` Mem: line ("total used free available")
_mem_line_to_json() {
  local line="$1" mt mu mf ma
  read -r mt mu mf ma <<<"$line"
  printf '{"total_bytes":%d,"used_bytes":%d,"free_bytes":%d,"available_bytes":%d}' \
    "${mt:-0}" "${mu:-0}" "${mf:-0}" "${ma:-0}"
}

session_report_finalize() {
  [[ "${NO_REPORT:-0}" == 1 ]] && { REPORT_FINALIZED=1; return 0; }
  (( REPORT_FINALIZED )) && return 0
  local total_freed="${1:-0}"

  local finished_at finished_ts duration disk_after mem_after
  finished_at="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  finished_ts="$(date +%s)"
  duration=$(( finished_ts - REPORT_STARTED_TS ))
  disk_after="$(df -h / 2>/dev/null | tail -1)"
  mem_after="$(free -b | awk '/^Mem:/ {print $2,$3,$4,$7}')"

  local disk_before_json disk_after_json mem_before_json mem_after_json
  disk_before_json="$(_disk_line_to_json "$REPORT_DISK_BEFORE")"
  disk_after_json="$(_disk_line_to_json "$disk_after")"
  mem_before_json="$(_mem_line_to_json  "$REPORT_MEM_BEFORE")"
  mem_after_json="$(_mem_line_to_json  "$mem_after")"

  # Join steps into a JSON array
  local steps_json="[" first=1 s
  for s in "${REPORT_STEPS_JSON[@]}"; do
    [[ $first -eq 0 ]] && steps_json+=","
    steps_json+="$s"
    first=0
  done
  steps_json+="]"

  # Count run vs skipped from accumulated steps
  local steps_run=0 steps_skipped=0
  for s in "${REPORT_STEPS_JSON[@]}"; do
    case "$s" in
      *'"status":"ran"'*)            ((steps_run++)) ;;
      *'"status":"skipped'*|*'"status":"skipped (quit)"'*) ((steps_skipped++)) ;;
    esac
  done

  cat >"$REPORT_JSON" <<JSON
{
  "schema_version": 1,
  "credits": {
    "tool": "linux-cleanup",
    "tool_version": $(json_str "$LINUX_CLEANUP_VERSION"),
    "tool_homepage": $(json_str "$LINUX_CLEANUP_WEB"),
    "tool_license": $(json_str "$LINUX_CLEANUP_LICENSE"),
    "author": {
      "name":     $(json_str "$LINUX_CLEANUP_AUTHOR"),
      "email":    $(json_str "$LINUX_CLEANUP_EMAIL"),
      "website":  $(json_str "$LINUX_CLEANUP_WEB"),
      "linkedin": $(json_str "$LINUX_CLEANUP_LINKEDIN")
    }
  },
  "meta": {
    "tool": "linux-cleanup",
    "tool_version": $(json_str "$LINUX_CLEANUP_VERSION"),
    "started_at":  $(json_str "$REPORT_STARTED_AT"),
    "finished_at": $(json_str "$finished_at"),
    "duration_seconds": $duration,
    "host": $(json_str "$(hostname)"),
    "user": $(json_str "$USER"),
    "mode": $(json_str "$MODE"),
    "stale_days": $DAYS,
    "log_file": $(json_str "$LOG_FILE"),
    "launcher": $(json_str "${LINUX_CLEANUP_LAUNCHER:-bash}"),
    "via_npx":  ${LINUX_CLEANUP_NPX:-0}
  },
  "disk": {
    "before": $disk_before_json,
    "after":  $disk_after_json
  },
  "memory": {
    "before": $mem_before_json,
    "after":  $mem_after_json
  },
  "steps": $steps_json,
  "totals": {
    "total_reclaimed_bytes": $total_freed,
    "total_reclaimed_human": $(json_str "$(bytes_pretty "$total_freed")"),
    "steps_run": $steps_run,
    "steps_skipped": $steps_skipped
  }
}
JSON
  REPORT_FINALIZED=1
  REPORT_FILE="$REPORT_JSON"  # back-compat name used elsewhere
}

# ── Quickstart welcome screen
quickstart_welcome() {
  clear 2>/dev/null || true
  ui_box "linux-cleanup" "Safe, modular disk + cache cleanup utility"
  ui_show_disk
  printf '\n%bThis walkthrough covers every cleanup category step-by-step.%b\n' "${C_BLD}" "${C_RST}"
  printf '%bSkip any step with %bs%b · quit anytime with %bq%b · default action is %ba (run)%b%b\n' \
    "${C_DIM}" "${C_BLD}" "${C_DIM}" "${C_BLD}" "${C_DIM}" "${C_BLD}" "${C_RST}" "${C_DIM}"
  if [[ "${LINUX_CLEANUP_NPX:-0}" == 1 ]]; then
    printf '%bRunning via %bnpx%b%b — your reports + logs persist at: %b%s%b\n' \
      "${C_DIM}" "${C_BLD}${C_GRN}" "${C_RST}" "${C_DIM}" \
      "${C_BLD}" "${LINUX_CLEANUP_DATA_HOME:-$HOME/.linux-cleanup}" "${C_RST}"
  else
    printf '%bAll logs + reports are saved under: %b%s%b\n' \
      "${C_DIM}" "${C_BLD}" "$LOG_DIR" "${C_RST}"
  fi
  printf '%bBy %s · %s%b\n' "${C_DIM}" "$LINUX_CLEANUP_AUTHOR" "$LINUX_CLEANUP_WEB" "${C_RST}"
  printf '\n'
  ui_pause
}

# ── Walkthrough state — total adjusts based on --no-report
WALK_TOTAL=10
[[ "${NO_REPORT:-0}" == 1 ]] && WALK_TOTAL=9
WALK_STEP=0
WALK_FREED_TOTAL=0
WALK_RAN=()
WALK_SKIPPED=()
WALK_QUIT=0
WALK_START_TS=0

walk_duration_str() {
  local now elapsed m s
  now=$(date +%s)
  elapsed=$(( now - WALK_START_TS ))
  m=$(( elapsed / 60 ))
  s=$(( elapsed % 60 ))
  printf '%dm %02ds' "$m" "$s"
}

walk_run_step() {
  local title="$1" fn="$2"
  ((WALK_STEP++))
  ui_step "$WALK_STEP" "$WALK_TOTAL" "$title"

  printf '  %baction:%b  %ba%b run    %bs%b skip    %bq%b quit walkthrough\n' \
    "${C_DIM}" "${C_RST}" "${C_GRN}${C_BLD}" "${C_RST}" \
    "${C_YLW}${C_BLD}" "${C_RST}" "${C_RED}${C_BLD}" "${C_RST}"
  printf '  %b→%b ' "${C_BLD}" "${C_RST}"

  local choice
  read -r choice || choice=q
  choice="${choice:-a}"

  case "$choice" in
    s|S)
      ui_info "skipped"
      WALK_SKIPPED+=("$title")
      session_report_step "$title" "skipped"
      return 0
      ;;
    q|Q)
      ui_warn "ending walkthrough early"
      WALK_QUIT=1
      WALK_SKIPPED+=("$title")
      session_report_step "$title" "skipped (quit)"
      return 0
      ;;
  esac

  local before after delta
  before=$(df --output=avail -B1 / 2>/dev/null | tail -1 | tr -d ' ')
  before=${before:-0}

  "$fn"

  after=$(df --output=avail -B1 / 2>/dev/null | tail -1 | tr -d ' ')
  after=${after:-0}
  delta=$(( after - before ))
  (( delta < 0 )) && delta=0

  WALK_FREED_TOTAL=$(( WALK_FREED_TOTAL + delta ))
  WALK_RAN+=("$title")
  session_report_step "$title" "ran" "$delta"

  if (( delta > 0 )); then
    printf '\n  %b✓ this step freed: %b%s%b   running total: %b%s%b\n' \
      "${C_GRN}" "${C_BLD}" "$(bytes_pretty "$delta")" "${C_RST}" \
      "${C_BLD}" "$(bytes_pretty "$WALK_FREED_TOTAL")" "${C_RST}"
  else
    printf '\n  %b• no measurable change in this step%b\n' "${C_DIM}" "${C_RST}"
  fi
}

# Step 10: write JSON report (always unless --no-report) + offer MD/HTML
walk_step_generate_report() {
  if [[ "${NO_REPORT:-0}" == 1 ]]; then
    ui_info "Report generation disabled via --no-report"
    return
  fi
  # Finalize JSON now so step 10 has a file to convert
  session_report_finalize "$WALK_FREED_TOTAL"
  ui_ok "JSON report written: $REPORT_JSON"

  if ! command -v jq >/dev/null 2>&1; then
    ui_warn "'jq' not installed — Markdown/HTML conversion unavailable."
    ui_info "Install with: sudo apt install jq   (then run cleanup --reports)"
    session_report_step "Generate readable report" "skipped (jq missing)"
    return
  fi

  printf '\n  %bGenerate human-readable formats?%b\n' "${C_BLD}" "${C_RST}"
  printf '    %bm%b markdown    %bh%b html    %bb%b both (default)    %bs%b skip\n' \
    "${C_GRN}${C_BLD}" "${C_RST}" "${C_GRN}${C_BLD}" "${C_RST}" \
    "${C_GRN}${C_BLD}" "${C_RST}" "${C_YLW}${C_BLD}" "${C_RST}"
  printf '  %b→%b ' "${C_BLD}" "${C_RST}"
  local choice
  read -r choice || choice=s
  choice="${choice:-b}"

  case "$choice" in
    m|M) reports_to_md   "$REPORT_JSON" ;;
    h|H) reports_to_html "$REPORT_JSON" ;;
    b|B) reports_to_md   "$REPORT_JSON"; reports_to_html "$REPORT_JSON" ;;
    s|S|*) ui_info "skipped" ;;
  esac
  session_report_step "Generate readable report" "ran"
}

# ── Final summary screen + tips
walkthrough_summary() {
  # Belt-and-suspenders: ensure JSON is written even if step 10 never ran.
  session_report_finalize "$WALK_FREED_TOTAL"

  ui_box "Cleanup complete" "Session summary"

  ui_kv "Total reclaimed:"  "${C_BLD}${C_GRN}$(bytes_pretty "$WALK_FREED_TOTAL")${C_RST}"
  ui_kv "Duration:"         "$(walk_duration_str)"
  ui_kv "Steps run:"        "${#WALK_RAN[@]} / $WALK_TOTAL"
  if (( ${#WALK_SKIPPED[@]} > 0 )); then
    ui_kv "Skipped:"        "${#WALK_SKIPPED[@]}"
    local s
    for s in "${WALK_SKIPPED[@]}"; do printf '    %b·%b %s\n' "${C_DIM}" "${C_RST}" "$s"; done
  fi
  ui_kv "Log:"              "$LOG_FILE"
  if [[ "${NO_REPORT:-0}" == 1 ]]; then
    ui_kv "Report:"         "${C_DIM}(disabled via --no-report)${C_RST}"
  else
    ui_kv "Report (JSON):"  "$REPORT_JSON"
  fi

  ui_separator
  ui_show_disk

  local has_alias=0 has_cron=0 has_jq=1
  grep -qsF "$CLEANUP_ROOT/cleanup.sh" "$HOME/.bash_aliases" "$HOME/.zshrc" 2>/dev/null && has_alias=1
  crontab -l 2>/dev/null | grep -qsF "$CLEANUP_ROOT/cleanup.sh" && has_cron=1
  command -v jq >/dev/null 2>&1 || has_jq=0

  if (( has_alias == 0 || has_cron == 0 || has_jq == 0 )); then
    printf '\n%bNext steps you can take:%b\n' "${C_BLD}" "${C_RST}"
    if (( has_alias == 0 )); then
      printf '  %b•%b Install shell alias    →  %b%s --install-alias%b\n' \
        "${C_CYN}" "${C_RST}" "${C_BLD}" "$(basename "$0")" "${C_RST}"
    fi
    if (( has_cron == 0 )); then
      printf '  %b•%b Schedule weekly clean  →  %b%s --install-cron%b\n' \
        "${C_CYN}" "${C_RST}" "${C_BLD}" "$(basename "$0")" "${C_RST}"
    fi
    if (( has_jq == 0 )); then
      printf '  %b•%b Install jq for report conversion  →  %bsudo apt install jq%b\n' \
        "${C_CYN}" "${C_RST}" "${C_BLD}" "${C_RST}"
    fi
    printf '  %b•%b Browse / convert past reports  →  %b%s --reports%b\n' \
      "${C_CYN}" "${C_RST}" "${C_BLD}" "$(basename "$0")" "${C_RST}"
  fi
  printf '\n'
}

# ── Main walkthrough
guided_walkthrough() {
  WALK_START_TS=$(date +%s)
  session_report_init
  quickstart_welcome

  ui_box "Pre-scan" "Quick read-only audit (no deletes)"
  scan_caches_table
  ui_pause

  WALK_QUIT=0
  walk_run_step "Package-manager caches"     run_pkg_managers       ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  walk_run_step "Application caches"         run_app_caches         ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  walk_run_step "Developer-tool data"        run_dev_tools          ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  walk_run_step "Editor old extensions"      run_editor_extensions  ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  walk_run_step "Stale node_modules"         run_stale_node_modules ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  walk_run_step "Partial / orphan downloads" run_partial_downloads  ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  walk_run_step "Personal stale files"       run_stale_personal     ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  walk_run_step "System cleanup (sudo)"      run_system             ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  walk_run_step "Final size audit"           run_size_audit         ; (( WALK_QUIT )) && { walkthrough_summary; return; }
  if [[ "${NO_REPORT:-0}" != 1 ]]; then
    walk_run_step "Generate readable report" walk_step_generate_report
  fi

  walkthrough_summary
}
