#!/usr/bin/env bash
# Developer tooling caches. Slower to recreate than package caches.

clean_android_avd() {
  local avd_root="$HOME/.android/avd"
  if [[ ! -d "$avd_root" ]]; then
    ui_info "Android AVDs — already absent"
    return 0
  fi
  ui_warn "AVDs are slow to recreate. Skip if you actively run Android emulators."

  # Full-purge mode keeps the legacy "wipe everything" behavior.
  if (( ${PURGE_ALL:-0} == 1 )); then
    clean_target "Android AVDs" "$avd_root" "recreate via Android Studio AVD Manager"
    return
  fi

  # Default: per-AVD staleness gate. An AVD is a *.avd directory paired with
  # a sibling *.ini config (Android tooling needs both). We treat each pair
  # as one unit; an AVD only goes if every file inside the .avd dir has
  # been untouched (atime AND mtime) for ≥${DAYS}d.
  local size; size="$(dir_size "$avd_root")"
  if ! ui_confirm "Inspect Android AVDs and prune any unused ≥${DAYS}d ($size in total)?" n; then
    ui_info "Android AVDs — skipped"
    return
  fi

  shopt -s nullglob dotglob
  local pruned_freed=0 inspected=0 kept=0 pruned=0
  local avd ini base age b
  for avd in "$avd_root"/*.avd; do
    [[ -d "$avd" ]] || continue
    inspected=$(( inspected + 1 ))
    base="${avd%.avd}"
    base="$(basename "$base")"
    ini="$avd_root/${base}.ini"
    age=$(newest_access_age_days "$avd")
    if (( age > DAYS )); then
      b=$(dir_bytes "$avd")
      [[ -f "$ini" ]] && b=$(( b + $(dir_bytes "$ini") ))
      if safe_rm "$avd"; then
        [[ -f "$ini" ]] && safe_rm "$ini"
        pruned_freed=$(( pruned_freed + b ))
        pruned=$(( pruned + 1 ))
        ui_ok "  pruned AVD ${base} (${age}d idle, $(bytes_pretty "$b") freed)"
      fi
    else
      kept=$(( kept + 1 ))
      ui_info "  kept AVD ${base} (${age}d idle — within ${DAYS}d window)"
    fi
  done
  shopt -u nullglob dotglob

  if (( inspected == 0 )); then
    ui_info "Android AVDs — none found in $avd_root"
  else
    ui_ok "Android AVDs — inspected ${inspected}, pruned ${pruned}, kept ${kept}; $(bytes_pretty "$pruned_freed") freed"
  fi
}

clean_pub_cache()   { clean_target "Flutter/Dart pub-cache"     "$HOME/.pub-cache"  "redownloaded by 'flutter pub get'"; }
clean_dart_server() { clean_target "Dart analysis server cache" "$HOME/.dartServer" "regenerated"; }

# Flatpak user dir backs INSTALLED user-scope flatpak apps + their runtimes.
# Wiping it uninstalls software, so we apply the two-condition rule:
#   1. No installed user-scope flatpak apps depend on it.
#   2. Hasn't been touched (atime/mtime) for ≥${DAYS}d.
# In stale-mode we additionally limit pruning to the cache subdirs that are
# safe to thin (`.cache`, repo objects), never the `app/` or `runtime/`
# install trees.
clean_flatpak_user() {
  local root="$HOME/.local/share/flatpak"
  if [[ ! -d "$root" ]]; then
    ui_info "Flatpak user data — already absent"
    return 0
  fi

  if (( ${PURGE_ALL:-0} == 1 )); then
    clean_target "Flatpak user runtimes" "$root" "redownloaded by flatpak (FULL PURGE — uninstalls user-scope apps)"
    return
  fi

  # Check for installed user apps. If flatpak CLI is present and reports
  # ≥1 user-scope app, condition #1 fails → skip entirely.
  if command -v flatpak >/dev/null 2>&1; then
    local installed_count
    installed_count=$(flatpak list --user --app --columns=application 2>/dev/null | grep -cv '^$' || true)
    if (( installed_count > 0 )); then
      ui_info "Flatpak user data — ${installed_count} user-scope app(s) installed; skipping (active software depends on this tree)"
      ui_info "  → Use 'flatpak uninstall --user --unused' to safely remove orphan runtimes"
      return
    fi
  fi

  # No active apps: gate on global ≥${DAYS}d idle before nuking the tree.
  local age; age=$(newest_access_age_days "$root")
  if (( age <= DAYS )); then
    ui_info "Flatpak user data — touched ${age}d ago (within ${DAYS}d window); keeping"
    return
  fi
  clean_target "Flatpak user data (no installed apps, ${age}d idle)" "$root" "no user-scope flatpak apps installed and ≥${DAYS}d idle"
}

run_dev_tools() {
  ui_section "Developer-tool data"
  clean_android_avd
  clean_pub_cache
  clean_dart_server
  clean_flatpak_user
}
