#!/usr/bin/env bash
# doctor.sh — diagnose & repair common shell-init breakage for dev runtimes.
# This module ONLY appends to ~/.bashrc (with confirmation), never deletes.

# Append a labelled block to ~/.bashrc if not already present.
# $1 = grep-marker (must be unique to this block, used to detect prior install)
# $2 = label/comment
# $3 = block body (multi-line)
_bashrc_append() {
  local marker="$1" label="$2" body="$3"
  local rc="$HOME/.bashrc"
  [[ -f "$rc" ]] || { ui_warn "no ~/.bashrc — skipping $label"; return 1; }
  if grep -qF "$marker" "$rc" 2>/dev/null; then
    ui_info "$label — already in ~/.bashrc"
    return 0
  fi
  if ! ui_confirm "Add $label init block to ~/.bashrc?" y; then
    ui_info "$label — skipped"
    return 0
  fi
  {
    printf '\n'
    printf '# ============================================================\n'
    printf '# %s (added by linux-cleanup --doctor on %s)\n' "$label" "$(date +%Y-%m-%d)"
    printf '# ============================================================\n'
    printf '%s\n' "$body"
  } >> "$rc"
  ui_ok "$label — added. Run: source ~/.bashrc (or open a new terminal)"
}

_check_nvm() {
  ui_info "nvm:"
  if [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
    printf '    not installed (no ~/.nvm/nvm.sh) — skipping\n'
    return
  fi
  if grep -qE 'NVM_DIR|nvm\.sh' "$HOME/.bashrc" 2>/dev/null; then
    printf '    OK — sourced in ~/.bashrc\n'
    return
  fi
  ui_warn "  ~/.nvm exists but is NOT sourced in ~/.bashrc — node/npm will not be on PATH"
  _bashrc_append 'NVM_DIR="$HOME/.nvm"' 'NVM' \
'export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"'
}

_check_pnpm() {
  ui_info "pnpm:"
  if [[ ! -d "$HOME/.local/share/pnpm" ]]; then
    printf '    not installed — skipping\n'
    return
  fi
  if grep -qF 'PNPM_HOME=' "$HOME/.bashrc" 2>/dev/null; then
    printf '    OK — PNPM_HOME in ~/.bashrc\n'
    return
  fi
  ui_warn "  ~/.local/share/pnpm exists but PNPM_HOME is NOT set in ~/.bashrc"
  _bashrc_append 'PNPM_HOME=' 'pnpm' \
'export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac'
}

_check_bun() {
  ui_info "bun:"
  if [[ ! -d "$HOME/.bun" ]]; then
    printf '    not installed — skipping\n'
    return
  fi
  if grep -qF '.bun/bin' "$HOME/.bashrc" 2>/dev/null || grep -qF 'BUN_INSTALL' "$HOME/.bashrc" 2>/dev/null; then
    printf '    OK — bun bin on PATH via ~/.bashrc\n'
    return
  fi
  ui_warn "  ~/.bun exists but bin dir is NOT on PATH in ~/.bashrc"
  _bashrc_append 'BUN_INSTALL=' 'bun' \
'export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"'
}

_check_deno() {
  ui_info "deno:"
  if [[ ! -d "$HOME/.deno" ]]; then
    printf '    not installed — skipping\n'
    return
  fi
  if grep -qF '.deno/bin' "$HOME/.bashrc" 2>/dev/null; then
    printf '    OK — deno bin on PATH via ~/.bashrc\n'
    return
  fi
  ui_warn "  ~/.deno exists but bin dir is NOT on PATH in ~/.bashrc"
  _bashrc_append '.deno/bin' 'deno' \
'export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"'
}

_check_cargo() {
  ui_info "cargo (Rust):"
  if [[ ! -d "$HOME/.cargo/bin" ]]; then
    printf '    not installed — skipping\n'
    return
  fi
  if grep -qF '.cargo/env' "$HOME/.bashrc" 2>/dev/null \
     || grep -qF '.cargo/bin' "$HOME/.bashrc" 2>/dev/null \
     || grep -qF '.cargo/env' "$HOME/.profile" 2>/dev/null; then
    printf '    OK — cargo on PATH\n'
    return
  fi
  ui_warn "  ~/.cargo/bin exists but is NOT on PATH"
  _bashrc_append '.cargo/env' 'cargo' \
'. "$HOME/.cargo/env"'
}

run_doctor() {
  ui_section "Doctor — detect & repair shell-init breakage for dev runtimes"
  ui_info "This checks if installed runtimes are properly wired into ~/.bashrc."
  ui_info "Will only APPEND missing init blocks (with your confirmation). Never deletes."
  printf '\n'
  _check_nvm
  _check_pnpm
  _check_bun
  _check_deno
  _check_cargo
  printf '\n'
  ui_info "Done. If anything was added, run: source ~/.bashrc  (or open a new terminal)"
}
