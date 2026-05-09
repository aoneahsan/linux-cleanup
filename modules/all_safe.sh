#!/usr/bin/env bash
# all-safe — clear every regenerable cache with one big confirm.
# Will NOT touch personal data, project node_modules, AVDs, Flatpak, Zoom, /Documents, etc.

ALL_SAFE_TARGETS=(
  "$HOME/.cache/yarn"
  "$HOME/.yarn/berry/cache"
  "$HOME/.npm/_npx"
  "$HOME/.npm/_cacache"
  "$HOME/.local/share/pnpm/store"
  "$HOME/.cache/pnpm"
  "$HOME/.cache/composer"
  "$HOME/.cache/pip"
  "$HOME/.cache/google-chrome"
  "$HOME/.cache/Google"
  "$HOME/.gradle/caches"
  "$HOME/.gradle/wrapper"
  "$HOME/.cache/Cypress"
  "$HOME/.cache/ms-playwright"
  "$HOME/.cache/ms-playwright-go"
  "$HOME/.cache/typescript"
  "$HOME/.dartServer"
  "$HOME/.cache/mozilla"
  "$HOME/.cache/BraveSoftware"
  "$HOME/.cache/chromium"
  "$HOME/.cache/microsoft-edge"
  "$HOME/.cache/vivaldi"
)

run_all_safe() {
  ui_section "All-safe cleanup (regenerable caches only)"
  ui_info "Targets:"
  local t total_size_h=0 sb total_b=0
  for t in "${ALL_SAFE_TARGETS[@]}"; do
    if [[ -e "$t" ]]; then
      sb=$(dir_bytes "$t")
      total_b=$(( total_b + sb ))
      printf "  %10s  %s\n" "$(dir_size "$t")" "$t"
    fi
  done
  ui_info "Estimated reclaim: $(bytes_pretty "$total_b")"
  ui_warn "Will NOT touch: ~/Documents, ~/Pictures, project node_modules, Android AVDs, Flatpak, Zoom, ~/.config, ~/.claude."
  ui_warn "Globally installed packages (npm/pnpm/yarn) are PRESERVED. Use --globals to audit unused ones."
  if ! ui_confirm "Proceed with batch clean? (use -y to skip prompt)" y; then
    ui_info "aborted"
    return
  fi

  local freed=0 b
  for t in "${ALL_SAFE_TARGETS[@]}"; do
    [[ -e "$t" ]] || continue
    b=$(dir_bytes "$t")
    if safe_rm "$t"; then
      freed=$(( freed + b ))
      ui_ok "cleared $t  $(bytes_pretty "$b")"
    fi
  done

  ui_section "All-safe complete"
  ui_info "Total freed: $(bytes_pretty "$freed")"
}
