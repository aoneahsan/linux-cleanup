#!/usr/bin/env bash
# all-safe — clear regenerable caches with one big confirm.
# Default (since v1.2.0): prunes only files unused for ≥${DAYS}d
# (both atime and mtime older than threshold). Recently-used assets
# survive — important for things you reopen every 1-2 months
# (Gradle wrapper distros, Playwright browsers, etc.).
# Pass --purge-all to restore the pre-1.2.0 wipe-the-whole-thing behavior.
# Will NOT touch personal data, project node_modules, AVDs, Flatpak, Zoom, /Documents, etc.

ALL_SAFE_TARGETS=(
  "$HOME/.cache/yarn"
  "$HOME/.yarn/berry/cache"
  "$HOME/.npm/_npx"
  "$HOME/.npm/_cacache"
  "$HOME/.local/share/pnpm/store"
  "$HOME/.cache/pnpm"
  "$HOME/.bun/install/cache"
  "$HOME/.cache/deno"
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
  local mode_label
  if (( ${PURGE_ALL:-0} == 1 )); then
    mode_label="full purge"
  else
    mode_label="prune files unused ≥${DAYS:-100}d"
  fi
  ui_section "All-safe cleanup (regenerable caches only — ${mode_label})"
  ui_info "Targets:"
  local t total_b=0 sb
  for t in "${ALL_SAFE_TARGETS[@]}"; do
    if [[ -e "$t" ]]; then
      sb=$(dir_bytes "$t")
      total_b=$(( total_b + sb ))
      printf "  %10s  %s\n" "$(dir_size "$t")" "$t"
    fi
  done
  ui_info "Currently on disk across all targets: $(bytes_pretty "$total_b")"
  if (( ${PURGE_ALL:-0} == 1 )); then
    ui_warn "FULL-PURGE MODE — every target above will be wiped, including recently-used files."
    ui_warn "Re-run without --purge-all to keep anything used in the last ${DAYS:-100} days."
  else
    ui_info "Will keep anything touched in the last ${DAYS:-100} days (atime AND mtime)."
    ui_info "Rarely-used assets (Gradle wrapper distros, old Playwright browsers, etc.) survive."
  fi
  ui_warn "Will NOT touch: ~/Documents, ~/Pictures, project node_modules, Android AVDs, Flatpak, Zoom, ~/.config, ~/.claude."
  ui_warn "Globally installed packages (npm/pnpm/yarn/bun/deno) are PRESERVED."
  ui_warn "Shell-init files (.bashrc, .profile, .zshrc, etc.) are NEVER touched."
  ui_info "Use --globals to audit unused globals.  Use --doctor to repair shell-init issues."

  # Sanity check: assert no listed target falls inside a protected runtime tree.
  local pat
  for t in "${ALL_SAFE_TARGETS[@]}"; do
    for pat in "$HOME/.nvm" "$HOME/.cargo" "$HOME/.rustup" "$HOME/.volta" \
               "$HOME/.fnm" "$HOME/go" "$HOME/.bashrc" "$HOME/.profile" \
               "$HOME/.bash_profile" "$HOME/.zshrc" "$HOME/.bash_aliases" \
               "$HOME/.npm-global"; do
      if [[ "$t" == "$pat" || "$t" == "$pat"/* ]]; then
        ui_err "BUG: protected path leaked into ALL_SAFE_TARGETS: $t (under $pat) — aborting."
        return 1
      fi
    done
  done

  local confirm_prompt
  if (( ${PURGE_ALL:-0} == 1 )); then
    confirm_prompt="Proceed with FULL purge? (use -y to skip prompt)"
  else
    confirm_prompt="Proceed: prune files unused ≥${DAYS:-100}d across all targets? (use -y to skip prompt)"
  fi
  if ! ui_confirm "$confirm_prompt" y; then
    ui_info "aborted"
    return
  fi

  local freed=0 b
  for t in "${ALL_SAFE_TARGETS[@]}"; do
    [[ -e "$t" ]] || continue
    if (( ${PURGE_ALL:-0} == 1 )); then
      b=$(dir_bytes "$t")
      if safe_rm "$t"; then
        freed=$(( freed + b ))
        ui_ok "cleared $t  $(bytes_pretty "$b")"
      fi
    else
      b=$(prune_stale "$t" "${DAYS:-100}")
      if (( b > 0 )); then
        freed=$(( freed + b ))
        ui_ok "pruned $t  $(bytes_pretty "$b") freed (kept $(dir_size "$t"))"
      else
        ui_info "nothing older than ${DAYS:-100}d in $t"
      fi
    fi
  done

  ui_section "All-safe complete"
  ui_info "Total freed: $(bytes_pretty "$freed")"
}
