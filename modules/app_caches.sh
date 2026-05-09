#!/usr/bin/env bash
# Application caches — Chrome, Gradle, test runners, Zoom, TS watcher.

clean_chrome() {
  clean_target "Chrome cache"            "$HOME/.cache/google-chrome" "Chrome rebuilds on next launch"
  clean_target "Chrome ancillary cache"  "$HOME/.cache/Google"        "regenerated"
}

clean_gradle() {
  clean_target "Gradle build caches"   "$HOME/.gradle/caches"  "redownloaded on next Android build"
  clean_target "Gradle wrapper distros" "$HOME/.gradle/wrapper" "redownloaded on next Android build"
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
  clean_gradle
  clean_test_runners
  clean_zoom
  clean_typescript_cache
}
