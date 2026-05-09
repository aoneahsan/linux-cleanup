#!/usr/bin/env bash
# release_helpers.sh — version, list-targets, self-test, uninstall, non-interactive export.

show_version() {
  cat <<EOF

  ${C_BLU}${C_BLD}linux-cleanup${C_RST} ${C_DIM}v${LINUX_CLEANUP_VERSION}${C_RST}
  Safe, modular disk + cache cleanup utility for Linux

  ${C_DIM}Author:${C_RST}    $LINUX_CLEANUP_AUTHOR
  ${C_DIM}Email:${C_RST}     $LINUX_CLEANUP_EMAIL
  ${C_DIM}Web:${C_RST}       $LINUX_CLEANUP_WEB
  ${C_DIM}LinkedIn:${C_RST}  $LINUX_CLEANUP_LINKEDIN
  ${C_DIM}License:${C_RST}   $LINUX_CLEANUP_LICENSE

  ${C_DIM}Project root:${C_RST}  $CLEANUP_ROOT

EOF
}

list_targets() {
  ui_box "Cleanup targets" "Every path this tool can touch, grouped by category"

  printf '\n%bPackage-manager caches (regenerable)%b\n' "${C_BLD}" "${C_RST}"
  ui_target_row "Yarn v1 cache"           "$HOME/.cache/yarn"
  ui_target_row "Yarn berry global cache" "$HOME/.yarn/berry/cache"
  ui_target_row "npm cache"               "$HOME/.npm/_cacache"
  ui_target_row "npx cache"               "$HOME/.npm/_npx"
  ui_target_row "pnpm content store"      "$HOME/.local/share/pnpm/store"
  ui_target_row "pnpm cache"              "$HOME/.cache/pnpm"
  ui_target_row "bun install cache"       "$HOME/.bun/install/cache"
  ui_target_row "deno cache"              "$HOME/.cache/deno"
  ui_target_row "Composer cache"          "$HOME/.cache/composer"
  ui_target_row "pip cache"               "$HOME/.cache/pip"

  printf '\n%bApplication caches (regenerable)%b\n' "${C_BLD}" "${C_RST}"
  ui_target_row "Chrome cache"            "$HOME/.cache/google-chrome"
  ui_target_row "Chrome ancillary"        "$HOME/.cache/Google"
  ui_target_row "Firefox/Mozilla cache"   "$HOME/.cache/mozilla"
  ui_target_row "Brave cache"             "$HOME/.cache/BraveSoftware"
  ui_target_row "Chromium cache"          "$HOME/.cache/chromium"
  ui_target_row "Microsoft Edge cache"    "$HOME/.cache/microsoft-edge"
  ui_target_row "Vivaldi cache"           "$HOME/.cache/vivaldi"
  ui_target_row "Gradle build caches"     "$HOME/.gradle/caches"
  ui_target_row "Gradle wrapper distros"  "$HOME/.gradle/wrapper"
  ui_target_row "Cypress binaries"        "$HOME/.cache/Cypress"
  ui_target_row "Playwright browsers"     "$HOME/.cache/ms-playwright"
  ui_target_row "Playwright-Go"           "$HOME/.cache/ms-playwright-go"
  ui_target_row "TypeScript watcher"      "$HOME/.cache/typescript"
  ui_target_row "Zoom data"               "$HOME/.zoom/data"

  printf '\n%bDeveloper tools (slower to recreate)%b\n' "${C_BLD}" "${C_RST}"
  ui_target_row "Android AVDs"            "$HOME/.android/avd"
  ui_target_row "Flutter pub-cache"       "$HOME/.pub-cache"
  ui_target_row "Dart analysis server"    "$HOME/.dartServer"
  ui_target_row "Flatpak runtimes"        "$HOME/.local/share/flatpak"
  ui_target_row "VS Code old extensions"  "$HOME/.vscode/extensions"
  ui_target_row "Cursor old extensions"   "$HOME/.cursor/extensions"

  printf '\n%bProject node_modules%b (interactive only)\n' "${C_BLD}" "${C_RST}"
  printf '  %bsearched roots:%b\n' "${C_DIM}" "${C_RST}"
  printf '    · %s\n' "$HOME/Documents/01-code/projects" "$HOME/Documents/01-code/02-apps" "$HOME/Documents/01-code"

  printf '\n%bPersonal data%b (interactive only — never auto-deleted)\n' "${C_BLD}" "${C_RST}"
  printf '  %bsearched roots:%b\n' "${C_DIM}" "${C_RST}"
  printf '    · %s\n' "$HOME/Downloads" "$HOME/Desktop"

  printf '\n%bSystem (sudo required)%b\n' "${C_BLD}" "${C_RST}"
  ui_target_row "apt archives"            "/var/cache/apt/archives"
  printf '  %s\n' "  · journal logs (vacuum to 100M)"
  printf '  %s\n' "  · disabled snap revisions"
  printf '  %s\n' "  · superseded kernel packages"
  printf '  %s\n' "  · /tmp files older than 7 days"
  printf '  %s\n' "  · kernel page cache (sysctl drop_caches)"

  printf '\n%bPROTECTED — script refuses to delete inside any of these:%b\n' "${C_RED}${C_BLD}" "${C_RST}"
  local p
  for p in "${PROTECTED_PATHS[@]}"; do printf '  · %s\n' "$p"; done
  printf '  · / · /etc · /boot · /usr · /var · /lib · /sbin · /bin\n'
  printf '\n'
}

self_test() {
  ui_box "Self-test" "Verify dependencies, syntax, safety guards"
  local fails=0

  printf '\n%b[ 1 ] Bash version%b\n' "${C_BLD}" "${C_RST}"
  if ((BASH_VERSINFO[0] >= 4)); then
    ui_ok "bash ${BASH_VERSION} (associative arrays supported)"
  else
    ui_err "bash ${BASH_VERSION} — version 4+ required"
    ((fails++))
  fi

  printf '\n%b[ 2 ] Required commands%b\n' "${C_BLD}" "${C_RST}"
  local cmd missing=()
  for cmd in find du df rm awk sort grep sed stat realpath; do
    if command -v "$cmd" >/dev/null 2>&1; then
      ui_ok "$cmd"
    else
      ui_err "$cmd  (REQUIRED)"
      missing+=("$cmd")
      ((fails++))
    fi
  done

  printf '\n%b[ 3 ] Optional commands%b\n' "${C_BLD}" "${C_RST}"
  for cmd in jq numfmt sudo snap crontab xdg-open less; do
    if command -v "$cmd" >/dev/null 2>&1; then
      ui_ok "$cmd"
    else
      ui_warn "$cmd  (optional — features dependent on it will be disabled)"
    fi
  done

  printf '\n%b[ 4 ] Script syntax%b\n' "${C_BLD}" "${C_RST}"
  local f
  for f in "$CLEANUP_ROOT/cleanup.sh" "$CLEANUP_ROOT"/lib/*.sh "$CLEANUP_ROOT"/modules/*.sh; do
    if bash -n "$f" 2>/dev/null; then
      ui_ok "$(basename "$f")"
    else
      ui_err "$(basename "$f") — syntax error"
      bash -n "$f" 2>&1 | sed 's/^/    /'
      ((fails++))
    fi
  done

  printf '\n%b[ 5 ] Safety guard sanity check%b\n' "${C_BLD}" "${C_RST}"
  local guard_paths=("/" "$HOME" "$HOME/Documents" "$HOME/.ssh" "$HOME/.config" "/etc" "/boot")
  for p in "${guard_paths[@]}"; do
    if is_protected "$p"; then
      ui_ok "is_protected '$p' = TRUE"
    else
      ui_err "is_protected '$p' returned FALSE — DANGEROUS"
      ((fails++))
    fi
  done
  # Sanity: a real cache path should NOT be protected
  if ! is_protected "$HOME/.cache/yarn"; then
    ui_ok "is_protected '$HOME/.cache/yarn' = FALSE (correct)"
  else
    ui_err "is_protected '$HOME/.cache/yarn' returned TRUE — would block legitimate cleanup"
    ((fails++))
  fi

  printf '\n%b[ 6 ] Output paths writable%b\n' "${C_BLD}" "${C_RST}"
  for d in "$LOG_DIR" "$REPORTS_DIR"; do
    if [[ -w "$d" ]]; then
      ui_ok "$d"
    else
      ui_err "$d  (not writable)"
      ((fails++))
    fi
  done

  ui_separator
  if (( fails == 0 )); then
    ui_ok "${C_BLD}all checks passed${C_RST} — script is ready."
    return 0
  else
    ui_err "${C_BLD}$fails check(s) failed${C_RST}"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────
# Feedback + debug bundle
# ─────────────────────────────────────────────────────────────────────────

# Resolve a sibling "feedback" dir next to logs/reports.
_feedback_dir() {
  local parent
  if [[ -n "${LINUX_CLEANUP_DATA_HOME:-}" ]]; then
    parent="$LINUX_CLEANUP_DATA_HOME"
  else
    parent="$(dirname "$LOG_DIR")"
  fi
  printf '%s/feedback' "$parent"
}

show_feedback() {
  ui_box "Send feedback / report a bug" "All offline — nothing leaves your machine unless you email it"

  printf '\n%bAuthor contact%b\n' "${C_BLD}" "${C_RST}"
  printf '  Email:    %b%s%b\n'    "${C_BLD}" "$LINUX_CLEANUP_EMAIL"    "${C_RST}"
  printf '  Web:      %s\n'        "$LINUX_CLEANUP_WEB"
  printf '  LinkedIn: %s\n'        "$LINUX_CLEANUP_LINKEDIN"

  printf '\n%bWhat to include in your report%b\n' "${C_BLD}" "${C_RST}"
  printf '  · Linux distribution + version\n'
  printf '  · Bash version (%bbash --version | head -1%b)\n' "${C_DIM}" "${C_RST}"
  printf '  · linux-cleanup version (currently: %bv%s%b)\n' "${C_BLD}" "$LINUX_CLEANUP_VERSION" "${C_RST}"
  printf '  · The exact command you ran\n'
  printf '  · What you expected to happen vs what actually happened\n'
  printf '  · The latest log + report (use --debug-bundle to package them)\n'

  printf '\n%bGenerate a debug bundle%b\n' "${C_BLD}" "${C_RST}"
  printf '  %blinux-cleanup --debug-bundle%b\n' "${C_BLD}" "${C_RST}"
  printf '  %bCreates a single tar.gz at: %s%b\n' \
    "${C_DIM}" "$(_feedback_dir)/" "${C_RST}"
  printf '  %bReview the bundle BEFORE sending — it contains $HOME paths.%b\n' \
    "${C_DIM}" "${C_RST}"

  printf '\n%bPrivacy guarantee%b\n' "${C_BLD}" "${C_RST}"
  printf '  linux-cleanup makes %bno network calls%b. No telemetry. No analytics.\n' \
    "${C_BLD}" "${C_RST}"
  printf '  Logs and reports are written %bonly%b to your local %s/\n' \
    "${C_BLD}" "${C_RST}" "$(dirname "$LOG_DIR")"
  printf '  The only data that leaves your machine is what %byou%b choose to email.\n' \
    "${C_BLD}" "${C_RST}"

  if command -v xdg-open >/dev/null 2>&1; then
    printf '\n'
    if ui_confirm "Open a pre-filled email draft in your default mail client?" n; then
      local distro bashv subj body uri
      distro=$(lsb_release -d 2>/dev/null | cut -f2-; true)
      [[ -z "$distro" ]] && distro="$(uname -sr)"
      bashv=$(bash --version 2>/dev/null | head -1)
      subj="linux-cleanup v${LINUX_CLEANUP_VERSION} — feedback / bug report"
      body=$(printf '\n\n— system info (auto-filled) —\nTool version: %s\nLinux:        %s\nKernel:       %s\nBash:         %s\n\n[describe what happened above this line]\n' \
        "$LINUX_CLEANUP_VERSION" "$distro" "$(uname -r)" "$bashv")
      # Minimal URL-encoding for mailto: body and subject
      uri="mailto:${LINUX_CLEANUP_EMAIL}?subject=$(printf '%s' "$subj" | sed 's/ /%20/g; s/&/%26/g')&body=$(printf '%s' "$body" | sed -e 's/%/%25/g' -e 's/ /%20/g' -e 's/$/%0A/g' -e 's/$/%0A/g' -e ':a;N;$!ba;s/\n/%0A/g')"
      xdg-open "$uri" >/dev/null 2>&1 &
      ui_ok "Opened in your mail client. Review the draft before sending."
    fi
  fi
  printf '\n'
}

make_debug_bundle() {
  ui_box "Creating debug bundle" "Latest log + latest report + system manifest"

  local feedback_dir; feedback_dir="$(_feedback_dir)"
  mkdir -p "$feedback_dir"

  local stamp; stamp="$(date +%Y-%m-%d_%H%M%S)"
  local out="$feedback_dir/debug-bundle-$stamp.tar.gz"

  local latest_log latest_report
  latest_log="$(ls -t "$LOG_DIR"/cleanup-*.log 2>/dev/null | head -1 || true)"
  latest_report="$(ls -t "$REPORTS_DIR"/report-*.json 2>/dev/null | head -1 || true)"

  local tmpdir; tmpdir="$(mktemp -d)"
  trap "rm -rf '$tmpdir'" RETURN

  # Manifest with non-sensitive system info only
  {
    printf 'linux-cleanup v%s — debug bundle\n'   "$LINUX_CLEANUP_VERSION"
    printf 'Generated:  %s\n'                      "$(date '+%Y-%m-%d %H:%M:%S %z')"
    printf '\n=== System info ===\n'
    printf 'Distro:     %s\n' "$(lsb_release -d 2>/dev/null | cut -f2- || uname -sr)"
    printf 'Kernel:     %s\n' "$(uname -srm)"
    printf 'Bash:       %s\n' "$(bash --version 2>/dev/null | head -1)"
    printf 'Node:       %s\n' "$(node --version 2>/dev/null || echo 'not installed')"
    printf 'jq:         %s\n' "$(jq --version 2>/dev/null || echo 'not installed')"
    printf '\n=== linux-cleanup self-test ===\n'
    "$CLEANUP_ROOT/cleanup.sh" --self-test 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
    printf '\n=== Bundle contents ===\n'
    [[ -n "$latest_log"    ]] && printf '· %s\n' "$(basename "$latest_log")"
    [[ -n "$latest_report" ]] && printf '· %s\n' "$(basename "$latest_report")"
    [[ -z "$latest_log$latest_report" ]] && printf '(no logs or reports yet)\n'
    printf '\n=== Privacy note ===\n'
    printf 'This bundle was generated locally and was NOT sent anywhere.\n'
    printf 'Review every file before emailing. Logs/reports include $HOME paths\n'
    printf 'and a snapshot of cache sizes from your machine.\n'
    printf '\nSend to: %s\n' "$LINUX_CLEANUP_EMAIL"
  } > "$tmpdir/MANIFEST.txt"

  [[ -n "$latest_log"    ]] && cp "$latest_log"    "$tmpdir/"
  [[ -n "$latest_report" ]] && cp "$latest_report" "$tmpdir/"

  tar -czf "$out" -C "$tmpdir" . 2>/dev/null

  ui_ok "Bundle created: $out"
  printf '  %bSize:%b   %s\n' "${C_DIM}" "${C_RST}" "$(du -h -- "$out" | cut -f1)"
  ui_warn "Review the bundle before sending — it contains \$HOME paths + cache inventory."
  printf '  %bExtract to inspect:%b   tar -tzf %s\n' "${C_DIM}" "${C_RST}" "$out"
  printf '  %bSend to:%b              %b%s%b\n\n' "${C_DIM}" "${C_RST}" \
    "${C_BLD}" "$LINUX_CLEANUP_EMAIL" "${C_RST}"
}

uninstall_alias() {
  ui_section "Uninstall shell alias"
  local found=0 file
  for file in "$HOME/.bash_aliases" "$HOME/.zshrc" "$HOME/.bashrc"; do
    [[ -f "$file" ]] || continue
    if grep -qsF "$CLEANUP_ROOT/cleanup.sh" "$file"; then
      found=1
      if ui_confirm "Remove cleanup-related lines from $file ?" y; then
        # Remove the comment line + alias line
        sed -i.bak '/# linux-cleanup tool/d; \|alias cleanup=.*'"${CLEANUP_ROOT//\//\\/}"'.*|d' "$file"
        ui_ok "removed (backup at ${file}.bak)"
      fi
    fi
  done
  (( found == 0 )) && ui_info "no cleanup alias found"
}

uninstall_cron() {
  ui_section "Uninstall cron entry"
  if ! command -v crontab >/dev/null 2>&1; then
    ui_info "crontab not installed"
    return
  fi
  if ! crontab -l 2>/dev/null | grep -qsF "$CLEANUP_ROOT/cleanup.sh"; then
    ui_info "no cleanup cron entry found"
    return
  fi
  if ui_confirm "Remove cleanup cron entry?" y; then
    ( crontab -l 2>/dev/null | grep -vF "$CLEANUP_ROOT/cleanup.sh" ) | crontab -
    ui_ok "cron entry removed"
  fi
}

# Non-interactive export: cleanup.sh --export <md|html|both> <id|all|latest>
# Returns 0 on success, 1 on error.
export_reports() {
  local fmt="${1:-both}" target="${2:-latest}"
  REPORTS_DIR="$CLEANUP_ROOT/reports"
  mkdir -p "$REPORTS_DIR"

  if ! command -v jq >/dev/null 2>&1; then
    ui_err "export requires 'jq'.  Install:  sudo apt install jq"
    return 1
  fi

  case "$fmt" in md|html|both) ;; *) ui_err "format must be md, html, or both"; return 1 ;; esac

  local files=() f
  while IFS= read -r f; do [[ -n "$f" ]] && files+=("$f"); done < <(
    find "$REPORTS_DIR" -maxdepth 1 -type f -name 'report-*.json' 2>/dev/null | sort -r
  )
  if (( ${#files[@]} == 0 )); then
    ui_err "no JSON reports found in $REPORTS_DIR"
    return 1
  fi

  local picked=()
  case "$target" in
    all)    picked=("${files[@]}") ;;
    latest) picked=("${files[0]}") ;;
    *[!0-9]*|"")
      ui_err "target must be: all | latest | <number>"
      return 1
      ;;
    *)
      local idx=$((target-1))
      if (( idx < 0 || idx >= ${#files[@]} )); then
        ui_err "index $target out of range (have ${#files[@]} reports)"
        return 1
      fi
      picked=("${files[$idx]}")
      ;;
  esac

  for f in "${picked[@]}"; do
    case "$fmt" in
      md)   reports_to_md   "$f" ;;
      html) reports_to_html "$f" ;;
      both) reports_to_md   "$f"; reports_to_html "$f" ;;
    esac
  done
}
