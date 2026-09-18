#!/usr/bin/env bash
# Application caches — Chrome, Android Studio, Gradle, test runners, Zoom, TS watcher.
#
# Gradle and Android Studio are NEVER pruned file by file. A Gradle
# distribution that loses one JAR keeps its `.ok` marker, so Gradle never
# re-downloads it and every build that needs the JAR fails; transform
# workspaces, file-hash stores and IDE indexes corrupt the same way. They are
# handled as whole units (one distribution, one per-version cache, one old IDE
# version) that go only when nothing inside has been used for ≥${DAYS}d.

clean_chrome() {
  clean_target "Chrome cache" "$HOME/.cache/google-chrome" "Chrome rebuilds on next launch"
}

# _gradle_dist_age <dists/name> — days since the distribution was last
# launched: the freshest file under its lib/ directories (the JARs a build
# actually loads). Docs, sources and the download zip are read rarely or
# never, so they do not count. Falls back to the whole directory when no
# lib/ exists yet (a download that never finished).
_gradle_dist_age() {
  local dist="$1" lib age best=999999 found=0
  for lib in "$dist"/*/*/lib; do
    [[ -d "$lib" ]] || continue
    found=1
    age=$(newest_access_age_days "$lib")
    (( age < best )) && best=$age
  done
  (( found )) || best=$(newest_access_age_days "$dist")
  printf '%d' "$best"
}

# prune_gradle_home — whole-unit Gradle pruning. No prompt: callers confirm.
# Adds bytes freed to UNITS_FREED.
prune_gradle_home() {
  local root="$HOME/.gradle" days="${DAYS:-100}"
  if [[ ! -d "$root" ]]; then
    ui_info "Gradle — already absent"
    return 0
  fi
  local dist inst zip age b
  shopt -s nullglob

  # Wrapper distributions: wrapper/dists/<name>/<hash>/{gradle-x.y/, <name>.zip, <name>.zip.ok}
  for dist in "$root"/wrapper/dists/*/; do
    dist="${dist%/}"
    age=$(_gradle_dist_age "$dist")
    if (( age > days )); then
      remove_unit "$dist" "Gradle distribution $(basename "$dist") — last launched ${age}d ago"
      continue
    fi
    ui_info "  kept Gradle distribution $(basename "$dist") (launched ${age}d ago)"
    # The download zip is never read again once `.ok` marks the unpack as
    # complete. Without `.ok` the unpack may still be running: leave it.
    for inst in "$dist"/*/; do
      for zip in "$inst"*.zip; do
        [[ -f "$zip.ok" ]] || continue
        age=$(newest_access_age_days "$zip")
        (( age > days )) && remove_unit "$zip" "leftover download $(basename "$zip") — ${age}d idle"
      done
    done
  done

  # Per-version caches (caches/8.13, caches/9.1.0, …) and per-version daemon
  # dirs: each one belongs to a single Gradle version.
  prune_stale_units "$root/caches" "$days" '[0-9]*'
  prune_stale_units "$root/daemon" "$days" '[0-9]*'
  prune_matching_files "$root/daemon" "$days" '*.out.log'

  if [[ -d "$root/.tmp" ]]; then
    b=$(prune_stale "$root/.tmp" "$days")
    UNITS_FREED=$(( UNITS_FREED + b ))
  fi
  shopt -u nullglob

  ui_info "  left to Gradle's own cleanup: modules-2, jars-*, transforms-*, build-cache-*, journal-*, jdks, native"
  ui_info "  (Gradle expires those itself from its access journal; deleting files inside them corrupts the cache)"
}

clean_gradle() {
  if (( ${PURGE_ALL:-0} == 1 )); then
    clean_target "Gradle build caches"    "$HOME/.gradle/caches"  "redownloaded on next Android build"
    clean_target "Gradle wrapper distros" "$HOME/.gradle/wrapper" "redownloaded on next Android build"
    return
  fi
  if [[ ! -d "$HOME/.gradle" ]]; then
    ui_info "Gradle — already absent"
    return 0
  fi
  if ! ui_confirm "Prune Gradle distributions + per-version caches idle ≥${DAYS}d ($(dir_size "$HOME/.gradle") in total; whole units only, in-use ones untouched)?" n; then
    ui_info "Gradle — skipped"
    return
  fi
  UNITS_FREED=0
  prune_gradle_home
  ui_ok "Gradle — $(bytes_pretty "$UNITS_FREED") freed"
}

# prune_ide_caches — Android Studio keeps one cache dir and one plugins dir
# per installed version. The newest version is always kept; an older one goes
# whole once idle ≥${DAYS}d, ignoring `.home` (the current IDE reads every old
# version's `.home` at startup). Other children of ~/.cache/Google are whole
# units under the same idle rule. ~/.config/Google (settings) is protected.
# No prompt: callers confirm. Adds bytes freed to UNITS_FREED.
prune_ide_caches() {
  local days="${DAYS:-100}" base newest d age keep_current
  shopt -s nullglob
  for base in "$HOME/.cache/Google" "$HOME/.local/share/Google"; do
    [[ -d "$base" ]] || continue
    newest=$(printf '%s\n' "$base"/AndroidStudio* | sort -V | tail -1)
    # Full purge may wipe the current version's CACHE, never its plugins
    # (~/.local/share holds installed software, not cache).
    keep_current=1
    [[ ${PURGE_ALL:-0} == 1 && "$base" == "$HOME/.cache/Google" ]] && keep_current=0
    for d in "$base"/AndroidStudio*/; do
      d="${d%/}"
      age=$(newest_access_age_days "$d" .home)
      if [[ "$d" == "$newest" ]] && (( keep_current )); then
        ui_info "  kept ${d/#$HOME/\~} (current Android Studio version)"
      elif (( ${PURGE_ALL:-0} == 1 || age > days )); then
        remove_unit "$d" "${d/#$HOME/\~} — ${age}d idle"
      else
        ui_info "  kept ${d/#$HOME/\~} (${age}d idle — within ${days}d window)"
      fi
    done
  done
  for d in "$HOME/.cache/Google"/*/; do
    d="${d%/}"
    [[ "$(basename "$d")" == AndroidStudio* ]] && continue
    age=$(newest_access_age_days "$d")
    if (( ${PURGE_ALL:-0} == 1 || age > days )); then
      remove_unit "$d" "${d/#$HOME/\~} — ${age}d idle"
    fi
  done
  shopt -u nullglob
}

clean_ide_caches() {
  if [[ ! -d "$HOME/.cache/Google" && ! -d "$HOME/.local/share/Google" ]]; then
    ui_info "Android Studio caches — already absent"
    return 0
  fi
  local prompt="Remove old Android Studio version caches idle ≥${DAYS}d (current version always kept)?"
  (( ${PURGE_ALL:-0} == 1 )) && prompt="Remove ALL Google app caches + old Android Studio versions (FULL PURGE; current plugins kept)?"
  if ! ui_confirm "$prompt" n; then
    ui_info "Android Studio caches — skipped"
    return
  fi
  UNITS_FREED=0
  prune_ide_caches
  ui_ok "Android Studio caches — $(bytes_pretty "$UNITS_FREED") freed"
}

clean_test_runners() {
  clean_target "Cypress binaries"        "$HOME/.cache/Cypress"          "reinstalled by next yarn install"
  clean_target "Playwright browsers"     "$HOME/.cache/ms-playwright"    "reinstalled by 'npx playwright install'"
  clean_target "Playwright-Go binaries"  "$HOME/.cache/ms-playwright-go" "regenerated"
}

clean_zoom() {
  if [[ -d "$HOME/.zoom/data" ]]; then
    local age; age="$(dir_age_days "$HOME/.zoom/data")"
    clean_target "Zoom data (${age}d old)" "$HOME/.zoom/data" "Zoom rebuilds it"
  else
    ui_info "Zoom data — already absent"
  fi
}

clean_typescript_cache() {
  clean_target "TypeScript watcher cache" "$HOME/.cache/typescript" "regenerated"
}

run_app_caches() {
  ui_section "Application caches"
  clean_chrome
  clean_ide_caches
  clean_gradle
  clean_test_runners
  clean_zoom
  clean_typescript_cache
}
