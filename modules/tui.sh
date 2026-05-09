#!/usr/bin/env bash
# tui.sh — whiptail/dialog-based menu for users who prefer a TUI over CLI prompts.
# Falls back gracefully when neither tool is installed (suggests apt install
# whiptail). The TUI is a thin wrapper around existing run_* functions: each
# selection drops out of the dialog, runs the action with the regular CLI
# output, then loops back. Cleanup logic and safety guards are unchanged.

_lclean_tui_tool() {
  if command -v whiptail >/dev/null 2>&1; then
    printf 'whiptail'
  elif command -v dialog >/dev/null 2>&1; then
    printf 'dialog'
  else
    printf ''
  fi
}

_lclean_tui_msg() {
  local tool="$1" title="$2" text="$3"
  "$tool" --title "$title" --msgbox "$text" 16 78 3>&1 1>&2 2>&3 || true
}

_lclean_tui_yesno() {
  local tool="$1" title="$2" text="$3"
  "$tool" --title "$title" --yesno "$text" 12 78 3>&1 1>&2 2>&3
}

run_tui() {
  local tool; tool="$(_lclean_tui_tool)"
  if [[ -z "$tool" ]]; then
    ui_warn "TUI mode needs 'whiptail' (recommended) or 'dialog'."
    printf '  Install:  %bsudo apt install whiptail%b   (Debian/Ubuntu)\n' "${C_BLD}" "${C_RST}"
    printf '            %bsudo dnf install newt%b       (Fedora/RHEL)\n' "${C_BLD}" "${C_RST}"
    printf '            %bsudo pacman -S libnewt%b      (Arch)\n\n' "${C_BLD}" "${C_RST}"
    if ui_confirm "Fall back to the regular CLI menu now?" y; then
      run_menu
    fi
    return
  fi

  while true; do
    local choice
    choice="$("$tool" \
      --title "linux-cleanup v${LINUX_CLEANUP_VERSION}" \
      --backtitle "Safe modular disk + cache cleanup  ·  ${LINUX_CLEANUP_AUTHOR}" \
      --menu "Pick an action — Esc / Cancel to quit" 22 78 14 \
        "scan"        "Scan & report (read-only, no deletes)" \
        "walkthrough" "Guided walkthrough — every category, with prompts" \
        "all-safe"    "All regenerable caches in one shot" \
        "pkg"         "Package-manager caches (yarn, npm, pnpm, pip, composer)" \
        "apps"        "App caches (Chrome, Gradle, Cypress, Playwright, Zoom)" \
        "dev"         "Dev-tool data (Android AVDs, pub, dart, flatpak)" \
        "node-mod"    "Stale node_modules in old projects" \
        "globals"     "Audit global npm/pnpm/yarn/bun/deno packages" \
        "editor-ext"  "Old VS Code / Cursor extension versions" \
        "stale"       "Personal files unused N+ days (interactive)" \
        "system"      "System cleanup (sudo: apt, journal, kernels, snap)" \
        "doctor"      "Doctor — repair shell-init breakage" \
        "reports"     "Reports manager (list / convert / view)" \
        "feedback"    "Send feedback / report a bug (offline)" \
        "bundle"      "Create debug bundle for emailing" \
        "about"       "About linux-cleanup (version, author, license)" \
        "quit"        "Exit" \
      3>&1 1>&2 2>&3)" || break

    clear
    case "$choice" in
      scan)        run_scan_all ;;
      walkthrough) guided_walkthrough ;;
      all-safe)    run_all_safe ;;
      pkg)         run_pkg_managers ;;
      apps)        run_app_caches ;;
      dev)         run_dev_tools ;;
      node-mod)    run_stale_node_modules ;;
      globals)     run_global_packages_audit ;;
      editor-ext)  run_editor_extensions ;;
      stale)       run_stale_personal ;;
      system)      run_system ;;
      doctor)      run_doctor ;;
      reports)     run_reports_manager ;;
      feedback)    show_feedback ;;
      bundle)      make_debug_bundle ;;
      about)
        _lclean_tui_msg "$tool" "About linux-cleanup" \
"linux-cleanup v${LINUX_CLEANUP_VERSION}

Author:   ${LINUX_CLEANUP_AUTHOR}
Email:    ${LINUX_CLEANUP_EMAIL}
Web:      ${LINUX_CLEANUP_WEB}
LinkedIn: ${LINUX_CLEANUP_LINKEDIN}

License:  ${LINUX_CLEANUP_LICENSE}

linux-cleanup makes no network calls. No telemetry. No analytics.
Logs and reports stay on your machine. Only what you explicitly
email leaves this computer."
        continue
        ;;
      quit|"") break ;;
    esac

    printf '\n'
    read -r -p "— press Enter to return to the menu — " _ || true
  done
}
