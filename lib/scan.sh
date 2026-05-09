#!/usr/bin/env bash
# scan.sh — read-only scanners. No deletes here.

scan_caches_table() {
  ui_section "Reclaimable caches & build artifacts"
  printf "  ${C_BLD}%-44s %10s  %s${C_RST}\n" "ITEM" "SIZE" "PATH"
  ui_target_row "Yarn v1 cache"            "$HOME/.cache/yarn"
  ui_target_row "Yarn berry global cache"  "$HOME/.yarn/berry/cache"
  ui_target_row "npm cache (_cacache)"     "$HOME/.npm/_cacache"
  ui_target_row "npx cache (_npx)"         "$HOME/.npm/_npx"
  ui_target_row "pnpm store"               "$HOME/.local/share/pnpm"
  ui_target_row "pnpm cache"               "$HOME/.cache/pnpm"
  ui_target_row "Composer cache"           "$HOME/.cache/composer"
  ui_target_row "pip cache"                "$HOME/.cache/pip"
  ui_target_row "Chrome cache"             "$HOME/.cache/google-chrome"
  ui_target_row "Chrome ancillary cache"   "$HOME/.cache/Google"
  ui_target_row "Gradle build caches"      "$HOME/.gradle/caches"
  ui_target_row "Gradle wrapper distros"   "$HOME/.gradle/wrapper"
  ui_target_row "Cypress binary cache"     "$HOME/.cache/Cypress"
  ui_target_row "Playwright browsers"      "$HOME/.cache/ms-playwright"
  ui_target_row "Playwright-Go"            "$HOME/.cache/ms-playwright-go"
  ui_target_row "TypeScript watcher cache" "$HOME/.cache/typescript"
  ui_target_row "Android AVDs"             "$HOME/.android/avd"
  ui_target_row "Flutter pub-cache"        "$HOME/.pub-cache"
  ui_target_row "Dart analysis server"     "$HOME/.dartServer"
  ui_target_row "Flatpak runtimes"         "$HOME/.local/share/flatpak"
  ui_target_row "Zoom data"                "$HOME/.zoom/data"
  ui_target_row "/tmp"                     "/tmp"
}

scan_partial_downloads() {
  ui_section "Partial / orphan downloads"
  local found=0 f sz
  while IFS= read -r f; do
    found=1
    sz=$(du -h -- "$f" 2>/dev/null | cut -f1)
    printf "  %10s  %s\n" "$sz" "$f"
  done < <(find "$HOME/Downloads" -maxdepth 4 -type f \
    \( -name "*.fdmdownload" -o -name "*.crdownload" -o -name "*.part" -o -name "*.aria2" \) 2>/dev/null)
  (( found )) || ui_info "None found."
}

scan_duplicates() {
  ui_section "Likely duplicate downloads (with ' (1).ext' style suffix)"
  local found=0 f sz
  while IFS= read -r f; do
    found=1
    sz=$(du -h -- "$f" 2>/dev/null | cut -f1)
    printf "  %10s  %s\n" "$sz" "$f"
  done < <(find "$HOME/Downloads" -maxdepth 3 -type f -regextype posix-extended \
    -regex '.* \([0-9]+\)\.[A-Za-z0-9]+$' 2>/dev/null | head -30)
  (( found )) || ui_info "None found."
}

scan_stale_personal_data() {
  local days="${1:-${DAYS:-100}}"
  ui_section "Personal files >${days}d unused (>10MB) in Downloads/Desktop"
  ui_warn "Read-only — use menu option 7 to interactively delete."
  local found=0 f sz la
  while IFS= read -r f; do
    found=1
    sz=$(du -h -- "$f" 2>/dev/null | cut -f1)
    la=$(stat -c '%x' -- "$f" 2>/dev/null | cut -d' ' -f1)
    printf "  %8s  last-access %-12s  %s\n" "$sz" "$la" "$f"
  done < <(find "$HOME/Downloads" "$HOME/Desktop" -maxdepth 4 -type f \
    -atime +"$days" -size +10M 2>/dev/null | head -50)
  (( found )) || ui_info "None found."
}

scan_system() {
  ui_section "System (sudo) reclaimables"
  ui_target_row "apt archive (.deb cache)" "/var/cache/apt/archives"
  local cur kernels
  cur="$(uname -r)"
  kernels=$(dpkg --list 2>/dev/null | awk '/^ii  linux-image-[0-9]/ {print $2}' | grep -v "$cur" | wc -l)
  echo "  Old kernels (not running):           $kernels"
  echo "  Journal disk usage:                  $(journalctl --disk-usage 2>/dev/null | grep -oE '[0-9.]+[GMK]' | head -1 || echo '?')"
  echo "  Disabled snap revisions:             $(snap list --all 2>/dev/null | grep -c disabled || echo 0)"
}

run_scan_all() {
  scan_caches_table
  scan_partial_downloads
  scan_duplicates
  scan_stale_personal_data "${DAYS:-100}"
  scan_system
}
