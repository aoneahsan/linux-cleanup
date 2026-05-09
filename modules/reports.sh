#!/usr/bin/env bash
# reports.sh — list, convert, view session reports.
# Canonical format: JSON. On-demand exports: Markdown, HTML.
# Outputs stay inside $REPORTS_DIR (i.e. $CLEANUP_ROOT/reports).

REPORTS_LIST=()

_reports_require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    ui_err "Conversion needs 'jq'. Install with:  sudo apt install jq"
    return 1
  fi
}

reports_list() {
  ui_section "Available reports in $REPORTS_DIR"
  REPORTS_LIST=()
  local f
  while IFS= read -r f; do
    [[ -n "$f" ]] && REPORTS_LIST+=("$f")
  done < <(
    find "$REPORTS_DIR" -maxdepth 1 -type f -name 'report-*.json' 2>/dev/null | sort -r
  )

  if (( ${#REPORTS_LIST[@]} == 0 )); then
    ui_info "No JSON reports found yet — run a walkthrough first."
    return 1
  fi

  printf "${C_BLD}%4s  %-32s  %8s  %-22s  %-16s${C_RST}\n" \
    "#" "REPORT" "SIZE" "DATE" "RECLAIMED"

  local i=1 base sz date_str totals
  for f in "${REPORTS_LIST[@]}"; do
    base=$(basename "$f")
    sz=$(du -h -- "$f" 2>/dev/null | cut -f1)
    if command -v jq >/dev/null 2>&1; then
      date_str=$(jq -r '.meta.started_at // "?"' "$f" 2>/dev/null | cut -dT -f1,2 | tr T ' ' | cut -d+ -f1)
      totals=$(jq -r '"\(.totals.total_reclaimed_human // "?") · \(.totals.steps_run // 0)/\(.steps | length // 0) ran"' "$f" 2>/dev/null)
    else
      date_str=$(printf '%s' "$base" | sed -E 's/^report-([0-9-]+)_([0-9]{2})([0-9]{2}).*/\1 \2:\3/')
      totals="(install jq for details)"
    fi
    printf '%4d  %-32s  %8s  %-22s  %-16s\n' "$i" "$base" "$sz" "$date_str" "$totals"
    ((i++))
  done
  return 0
}

reports_to_md() {
  local json="$1"
  local out="${2:-${json%.json}.md}"
  _reports_require_jq || return 1
  if [[ ! -r "$json" ]]; then ui_err "cannot read $json"; return 1; fi

  jq -r '
    "# linux-cleanup session report",
    "",
    "_Generated from `\(input_filename | sub(".*/"; ""))`_",
    "",
    "## Overview",
    "",
    "| Field | Value |",
    "|---|---|",
    "| Started  | \(.meta.started_at) |",
    "| Finished | \(.meta.finished_at) |",
    "| Duration | \(.meta.duration_seconds) seconds |",
    "| Host     | \(.meta.host) |",
    "| User     | \(.meta.user) |",
    "| Mode     | \(.meta.mode) |",
    "| Stale threshold | \(.meta.stale_days) days |",
    "| Log file | \(.meta.log_file) |",
    "",
    "## Result",
    "",
    "**Reclaimed: \(.totals.total_reclaimed_human)** (\(.totals.total_reclaimed_bytes) bytes)  ",
    "Steps run: \(.totals.steps_run) · skipped: \(.totals.steps_skipped)",
    "",
    "## Disk",
    "",
    "| State | Filesystem | Size | Used | Available | Use% |",
    "|---|---|---|---|---|---|",
    "| before | \(.disk.before.filesystem) | \(.disk.before.size) | \(.disk.before.used) | \(.disk.before.avail) | \(.disk.before.use_pct) |",
    "| after  | \(.disk.after.filesystem)  | \(.disk.after.size)  | \(.disk.after.used)  | \(.disk.after.avail)  | \(.disk.after.use_pct) |",
    "",
    "## Memory (bytes)",
    "",
    "| State | Total | Used | Free | Available |",
    "|---|---|---|---|---|",
    "| before | \(.memory.before.total_bytes) | \(.memory.before.used_bytes) | \(.memory.before.free_bytes) | \(.memory.before.available_bytes) |",
    "| after  | \(.memory.after.total_bytes)  | \(.memory.after.used_bytes)  | \(.memory.after.free_bytes)  | \(.memory.after.available_bytes) |",
    "",
    "## Steps",
    "",
    "| # | Title | Status | Freed (bytes) |",
    "|---:|---|---|---:|",
    (.steps[] | "| \(.n) | \(.title) | \(.status) | \(.freed_bytes) |")
  ' "$json" >"$out"

  ui_ok "wrote $out"
}

reports_to_html() {
  local json="$1"
  local out="${2:-${json%.json}.html}"
  _reports_require_jq || return 1
  if [[ ! -r "$json" ]]; then ui_err "cannot read $json"; return 1; fi

  # All scalar values are pulled through jq's @html filter to escape
  # <, >, &, ", ' — protecting the HTML against malformed JSON content.
  local meta_started meta_finished meta_dur meta_host meta_user meta_mode meta_days meta_log
  local total_human total_bytes steps_run steps_skipped report_basename
  meta_started=$(jq -r '.meta.started_at  // ""    | @html' "$json")
  meta_finished=$(jq -r '.meta.finished_at // ""    | @html' "$json")
  meta_dur=$(jq -r     '.meta.duration_seconds // 0 | @html' "$json")
  meta_host=$(jq -r    '.meta.host         // ""    | @html' "$json")
  meta_user=$(jq -r    '.meta.user         // ""    | @html' "$json")
  meta_mode=$(jq -r    '.meta.mode         // ""    | @html' "$json")
  meta_days=$(jq -r    '.meta.stale_days   // 0     | @html' "$json")
  meta_log=$(jq -r     '.meta.log_file     // ""    | @html' "$json")
  total_human=$(jq -r  '.totals.total_reclaimed_human // "" | @html' "$json")
  total_bytes=$(jq -r  '.totals.total_reclaimed_bytes // 0  | @html' "$json")
  steps_run=$(jq -r    '.totals.steps_run            // 0  | @html' "$json")
  steps_skipped=$(jq -r '.totals.steps_skipped       // 0  | @html' "$json")
  report_basename=$(basename "$json")

  local steps_rows disk_rows mem_rows
  steps_rows=$(jq -r '
    .steps[] |
    "<tr class=\"row-\(.status | gsub("[^a-zA-Z0-9]"; "-"))\">" +
    "<td>\(.n)</td><td>\(.title | @html)</td>" +
    "<td><span class=\"badge \(.status | gsub("[^a-zA-Z0-9]"; "-"))\">\(.status | @html)</span></td>" +
    "<td class=\"num\">\(.freed_bytes)</td></tr>"
  ' "$json")

  disk_rows=$(jq -r '
    "<tr><td>before</td><td>\(.disk.before.size | @html)</td><td>\(.disk.before.used | @html)</td><td>\(.disk.before.avail | @html)</td><td>\(.disk.before.use_pct | @html)</td></tr>",
    "<tr><td>after</td><td>\(.disk.after.size | @html)</td><td>\(.disk.after.used | @html)</td><td>\(.disk.after.avail | @html)</td><td>\(.disk.after.use_pct | @html)</td></tr>"
  ' "$json")

  mem_rows=$(jq -r '
    "<tr><td>before</td><td class=\"num\">\(.memory.before.total_bytes)</td><td class=\"num\">\(.memory.before.used_bytes)</td><td class=\"num\">\(.memory.before.free_bytes)</td><td class=\"num\">\(.memory.before.available_bytes)</td></tr>",
    "<tr><td>after</td><td class=\"num\">\(.memory.after.total_bytes)</td><td class=\"num\">\(.memory.after.used_bytes)</td><td class=\"num\">\(.memory.after.free_bytes)</td><td class=\"num\">\(.memory.after.available_bytes)</td></tr>"
  ' "$json")

  cat >"$out" <<HTML
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>linux-cleanup report — $meta_started</title>
<style>
  :root{--fg:#1c1c1f;--bg:#fafafa;--muted:#7a7a85;--ok:#0a7d54;--warn:#b8860b;--danger:#c0392b;--line:#e6e6ea;--card:#fff;}
  @media (prefers-color-scheme:dark){
    :root{--fg:#eaeaea;--bg:#16161a;--muted:#9d9da8;--line:#2a2a30;--card:#1f1f25;}
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:960px;margin:2rem auto;padding:0 1.25rem}
  h1{font-size:1.6rem;margin:0 0 0.3rem;letter-spacing:-0.01em}
  h2{font-size:1.05rem;margin:2.2rem 0 0.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
  .subtitle{color:var(--muted);margin:0 0 1.5rem}
  .totals{display:flex;align-items:baseline;gap:1rem;padding:1.5rem 1.75rem;border:1px solid var(--line);border-radius:12px;background:var(--card);margin:1rem 0}
  .totals .big{font-size:2.5rem;font-weight:800;color:var(--ok);line-height:1;letter-spacing:-0.02em}
  .totals .label{color:var(--muted);text-transform:uppercase;font-size:0.75rem;letter-spacing:0.08em}
  .totals .meta{margin-left:auto;text-align:right;color:var(--muted);font-size:0.9rem}
  dl.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.6rem 1.5rem;margin:0;padding:1rem 1.25rem;border:1px solid var(--line);border-radius:10px;background:var(--card)}
  dl.meta div{display:flex;flex-direction:column}
  dl.meta dt{color:var(--muted);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em}
  dl.meta dd{margin:0.1rem 0 0;font-weight:600;word-break:break-all}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:0.55rem 0.85rem;border-bottom:1px solid var(--line)}
  tr:last-child td{border-bottom:none}
  th{font-size:0.72rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.07em;background:var(--bg)}
  td.num{font-variant-numeric:tabular-nums;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.92em}
  .badge{display:inline-block;padding:0.12em 0.5em;border-radius:999px;font-size:0.75em;font-weight:600;text-transform:uppercase;letter-spacing:0.04em}
  .badge.ran{background:rgba(10,125,84,.12);color:var(--ok)}
  .badge.skipped,.badge.skipped--quit-{background:rgba(184,134,11,.12);color:var(--warn)}
  .row-ran{background:rgba(10,125,84,0.025)}
  code{background:rgba(120,120,140,0.12);padding:0.1em 0.35em;border-radius:4px;font-size:0.9em}
  footer{margin:3rem 0 1rem;color:var(--muted);font-size:0.85rem;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <h1>linux-cleanup session report</h1>
  <p class="subtitle">$meta_started → $meta_finished &middot; ${meta_dur}s</p>

  <div class="totals">
    <div>
      <div class="label">Reclaimed</div>
      <div class="big">$total_human</div>
      <div class="label" style="margin-top:0.4rem">$total_bytes bytes</div>
    </div>
    <div class="meta">
      <div><strong>$steps_run</strong> steps run</div>
      <div><strong>$steps_skipped</strong> skipped</div>
    </div>
  </div>

  <h2>Run metadata</h2>
  <dl class="meta">
    <div><dt>Host</dt><dd>$meta_host</dd></div>
    <div><dt>User</dt><dd>$meta_user</dd></div>
    <div><dt>Mode</dt><dd>$meta_mode</dd></div>
    <div><dt>Stale threshold</dt><dd>${meta_days} days</dd></div>
    <div><dt>Log file</dt><dd><code>$meta_log</code></dd></div>
  </dl>

  <h2>Steps</h2>
  <table>
    <thead><tr><th style="width:3em">#</th><th>Title</th><th style="width:7em">Status</th><th style="width:11em" class="num">Freed (bytes)</th></tr></thead>
    <tbody>
$steps_rows
    </tbody>
  </table>

  <h2>Disk</h2>
  <table>
    <thead><tr><th>State</th><th>Size</th><th>Used</th><th>Available</th><th>Use%</th></tr></thead>
    <tbody>
$disk_rows
    </tbody>
  </table>

  <h2>Memory (bytes)</h2>
  <table>
    <thead><tr><th>State</th><th class="num">Total</th><th class="num">Used</th><th class="num">Free</th><th class="num">Available</th></tr></thead>
    <tbody>
$mem_rows
    </tbody>
  </table>

  <footer>Generated from <code>$report_basename</code> by linux-cleanup</footer>
</div>
</body>
</html>
HTML
  ui_ok "wrote $out"
}

# Convert ALL existing JSON reports to MD + HTML
reports_convert_all() {
  reports_list >/dev/null || return 1
  if (( ${#REPORTS_LIST[@]} == 0 )); then
    ui_info "No reports to convert."
    return
  fi
  ui_info "Converting ${#REPORTS_LIST[@]} reports to Markdown + HTML..."
  local f
  for f in "${REPORTS_LIST[@]}"; do
    reports_to_md   "$f"
    reports_to_html "$f"
  done
  ui_ok "all done — see $REPORTS_DIR"
}

run_reports_manager() {
  ui_box "Reports manager" "Browse / convert / view session reports"
  if ! reports_list; then return; fi

  printf '\n  %bActions:%b\n' "${C_BLD}" "${C_RST}"
  printf '    %bcm <#>%b      convert one report to Markdown\n' "${C_BLD}" "${C_RST}"
  printf '    %bch <#>%b      convert one report to HTML\n'     "${C_BLD}" "${C_RST}"
  printf '    %bcb <#>%b      convert one report to BOTH\n'     "${C_BLD}" "${C_RST}"
  printf '    %ball%b         convert ALL reports to MD + HTML\n' "${C_BLD}" "${C_RST}"
  printf '    %bv <#>%b       view JSON in less\n'              "${C_BLD}" "${C_RST}"
  printf '    %bo <#>%b       open HTML in default browser (xdg-open)\n' "${C_BLD}" "${C_RST}"
  printf '    %bd <#>%b       delete one report (JSON + .md + .html)\n'  "${C_BLD}" "${C_RST}"
  printf '    %bq%b           quit\n' "${C_BLD}" "${C_RST}"
  printf '\n  %b→%b ' "${C_BLD}" "${C_RST}"

  local input cmd arg target html
  read -r input || return
  cmd="${input%% *}"
  arg="${input#"$cmd"}"; arg="${arg# }"

  case "$cmd" in
    cm)
      target="${REPORTS_LIST[$((arg-1))]:-}"
      [[ -n "$target" ]] && reports_to_md "$target" || ui_err "invalid index"
      ;;
    ch)
      target="${REPORTS_LIST[$((arg-1))]:-}"
      [[ -n "$target" ]] && reports_to_html "$target" || ui_err "invalid index"
      ;;
    cb)
      target="${REPORTS_LIST[$((arg-1))]:-}"
      if [[ -n "$target" ]]; then reports_to_md "$target"; reports_to_html "$target"
      else ui_err "invalid index"; fi
      ;;
    all)
      reports_convert_all
      ;;
    v)
      target="${REPORTS_LIST[$((arg-1))]:-}"
      if [[ -n "$target" ]]; then
        if command -v jq >/dev/null 2>&1; then jq . "$target" | ${PAGER:-less}
        else ${PAGER:-less} "$target"; fi
      else ui_err "invalid index"; fi
      ;;
    o)
      target="${REPORTS_LIST[$((arg-1))]:-}"
      if [[ -n "$target" ]]; then
        html="${target%.json}.html"
        if [[ ! -f "$html" ]]; then
          ui_info "HTML missing — generating first..."
          reports_to_html "$target" || return
        fi
        if command -v xdg-open >/dev/null 2>&1; then
          xdg-open "$html" >/dev/null 2>&1 &
          ui_ok "opened $html"
        else
          ui_warn "xdg-open unavailable. File: $html"
        fi
      else ui_err "invalid index"; fi
      ;;
    d)
      target="${REPORTS_LIST[$((arg-1))]:-}"
      if [[ -n "$target" ]]; then
        if ui_confirm "Delete $target (and any .md / .html siblings)?" n; then
          rm -f -- "$target" "${target%.json}.md" "${target%.json}.html"
          ui_ok "deleted"
        fi
      else ui_err "invalid index"; fi
      ;;
    q|Q|"") ui_info "bye" ;;
    *) ui_warn "unknown action: $cmd" ;;
  esac
}
