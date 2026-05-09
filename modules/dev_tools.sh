#!/usr/bin/env bash
# Developer tooling caches. Slower to recreate than package caches.

clean_android_avd() {
  if [[ -d "$HOME/.android/avd" ]]; then
    ui_warn "AVDs are slow to recreate. Skip if you actively run Android emulators."
    clean_target "Android AVDs" "$HOME/.android/avd" "recreate via Android Studio AVD Manager"
  else
    ui_info "Android AVDs — already absent"
  fi
}

clean_pub_cache()   { clean_target "Flutter/Dart pub-cache"     "$HOME/.pub-cache"  "redownloaded by 'flutter pub get'"; }
clean_dart_server() { clean_target "Dart analysis server cache" "$HOME/.dartServer" "regenerated"; }
clean_flatpak_user(){ clean_target "Flatpak user runtimes"      "$HOME/.local/share/flatpak" "redownloaded by flatpak"; }

run_dev_tools() {
  ui_section "Developer-tool data"
  clean_android_avd
  clean_pub_cache
  clean_dart_server
  clean_flatpak_user
}
