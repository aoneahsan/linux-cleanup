#!/usr/bin/env bash
# common.sh — UI helpers, safety guards, sudo handling. Sourced, not executed.

# Project metadata
LINUX_CLEANUP_VERSION="1.0.0"
LINUX_CLEANUP_AUTHOR="Ahsan Mahmood"
LINUX_CLEANUP_EMAIL="aoneahsan@gmail.com"
LINUX_CLEANUP_WEB="https://aoneahsan.com"
LINUX_CLEANUP_LINKEDIN="https://linkedin.com/in/aoneahsan"
LINUX_CLEANUP_PHONE="+92 304 6619706"
LINUX_CLEANUP_LICENSE="Source-Available, No-Derivatives, Non-Commercial v1.0"

# Colors only when stdout is a TTY AND NO_COLOR is not set (de-facto standard).
# Disable explicitly with --no-color flag (handled in cleanup.sh).
if [[ -t 1 && -z "${NO_COLOR:-}" && "${CLEANUP_NO_COLOR:-0}" != 1 ]]; then
  C_RED=$'\e[31m'; C_GRN=$'\e[32m'; C_YLW=$'\e[33m'; C_BLU=$'\e[34m'
  C_MAG=$'\e[35m'; C_CYN=$'\e[36m'; C_DIM=$'\e[2m'; C_BLD=$'\e[1m'; C_RST=$'\e[0m'
else
  C_RED=''; C_GRN=''; C_YLW=''; C_BLU=''; C_MAG=''; C_CYN=''; C_DIM=''; C_BLD=''; C_RST=''
fi

ui_term_w() { tput cols 2>/dev/null || echo 78; }

ui_banner() {
  printf '%s\n' "${C_BLU}${C_BLD}╔════════════════════════════════════════════╗${C_RST}"
  printf '%s\n' "${C_BLU}${C_BLD}║   linux-cleanup — safe modular cleanup     ║${C_RST}"
  printf '%s\n' "${C_BLU}${C_BLD}╚════════════════════════════════════════════╝${C_RST}"
}

ui_section() { printf '\n%s\n' "${C_BLU}${C_BLD}── $* ──${C_RST}"; }

# Boxed title with optional dim subtitle. Width-stable, color-safe.
ui_box() {
  local title="$1" subtitle="${2:-}"
  local w=78 line
  line=$(printf '═%.0s' $(seq 1 $w))
  printf '\n%b%s%b\n' "${C_BLU}${C_BLD}" "$line" "${C_RST}"
  printf '   %b%s%b\n' "${C_BLU}${C_BLD}" "$title" "${C_RST}"
  [[ -n "$subtitle" ]] && printf '   %b%s%b\n' "${C_DIM}" "$subtitle" "${C_RST}"
  printf '%b%s%b\n' "${C_BLU}${C_BLD}" "$line" "${C_RST}"
}

# Step header: [ STEP n/N ]  Title
ui_step() {
  local n="$1" total="$2" title="$3"
  local line
  line=$(printf '─%.0s' $(seq 1 78))
  printf '\n%b%s%b\n' "${C_DIM}" "$line" "${C_RST}"
  printf '  %b[ STEP %s/%s ]%b  %b%s%b\n' \
    "${C_CYN}${C_BLD}" "$n" "$total" "${C_RST}" "${C_BLD}" "$title" "${C_RST}"
  printf '%b%s%b\n' "${C_DIM}" "$line" "${C_RST}"
}

ui_separator() {
  printf '%b%s%b\n' "${C_DIM}" "$(printf '─%.0s' $(seq 1 78))" "${C_RST}"
}

ui_kv() { printf '  %b%-22s%b %s\n' "${C_DIM}" "$1" "${C_RST}" "$2"; }

ui_pause() {
  printf '\n%b— press Enter to continue —%b ' "${C_DIM}" "${C_RST}"
  read -r _ || true
}

# JSON-safe string emitter: prints "<escaped>"
json_str() {
  local s="${1:-}"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '"%s"' "$s"
}
ui_info()    { printf '%s\n' "${C_CYN}ℹ${C_RST} $*"; }
ui_ok()      { printf '%s\n' "${C_GRN}✓${C_RST} $*"; }
ui_warn()    { printf '%s\n' "${C_YLW}!${C_RST} $*"; }
ui_err()     { printf '%s\n' "${C_RED}✗${C_RST} $*" >&2; }

# ui_confirm "prompt" [default-y|n]   — returns 0 on yes, 1 on no
ui_confirm() {
  local prompt="${1:-Proceed?}" default="${2:-n}" reply hint="[y/N]"
  [[ "$default" == "y" ]] && hint="[Y/n]"
  if (( ${ASSUME_YES:-0} )); then
    printf '%s\n' "${C_DIM}[auto-yes] $prompt${C_RST}"
    return 0
  fi
  read -rp "${C_BLD}?${C_RST} $prompt $hint " reply || return 1
  reply="${reply:-$default}"
  [[ "$reply" =~ ^[Yy]$ ]]
}

# Paths the tool will NEVER delete inside (subtree-protected).
PROTECTED_PATHS=(
  "$HOME/.ssh" "$HOME/.gnupg" "$HOME/.gnome"
  "$HOME/Documents" "$HOME/Pictures" "$HOME/Music" "$HOME/Videos"
  "$HOME/Desktop" "$HOME/Public" "$HOME/Templates"
  "$HOME/.claude" "$HOME/.local/share/claude" "$HOME/.config"
  "$HOME/.mozilla" "$HOME/.thunderbird"
)

# Exact-match-only blocks: deleting THIS path is forbidden, but deleting a
# specific subdirectory (e.g. only the store/ inside) is still allowed.
# This is critical for pnpm: $HOME/.local/share/pnpm is PNPM_HOME — it holds
# globally installed package shims, the `global/` install tree, and the
# `pnpm` binary from `pnpm setup`. Only the `store/` subdirectory is a
# regenerable cache; everything else is real installed software.
PROTECTED_EXACT=(
  "$HOME/.local/share/pnpm"
  "$HOME/.local/share/pnpm/global"
  "$HOME/.local/share/pnpm/bin"
  "$HOME/.local/share/pnpm/nodejs"
  "$HOME/.npm-global"
  "$HOME/.npm-global/lib"
  "$HOME/.npm-global/lib/node_modules"
  "$HOME/.config/yarn/global"
  "$HOME/.yarn"
  "$HOME/.npm"
)

is_protected() {
  [[ -z "${1:-}" ]] && return 0
  local p
  p="$(realpath -m -- "$1" 2>/dev/null)" || return 0
  case "$p" in
    /|/home|/root|/etc|/etc/*|/boot|/boot/*|/usr|/usr/*|/var|/lib|/sbin|/bin) return 0 ;;
    "$HOME") return 0 ;;
  esac
  local prot
  for prot in "${PROTECTED_PATHS[@]}"; do
    [[ "$p" == "$prot" || "$p" == "$prot"/* ]] && return 0
  done
  for prot in "${PROTECTED_EXACT[@]}"; do
    [[ "$p" == "$prot" ]] && return 0
  done
  return 1
}

# safe_rm <path> — only deletes if not in protected list and not bare $HOME or /
safe_rm() {
  local target="${1:-}"
  if [[ -z "$target" || "$target" == "/" || "$target" == "$HOME" || "$target" == "$HOME/" ]]; then
    ui_err "REFUSE: unsafe path: '${target}'"; return 1
  fi
  if is_protected "$target"; then
    ui_err "REFUSE: protected path: $target"; return 1
  fi
  if [[ ! -e "$target" && ! -L "$target" ]]; then
    return 0
  fi
  rm -rf -- "$target"
}

# Human-readable size of a path (du -sh) or "—" if missing
dir_size() {
  [[ -e "${1:-}" ]] || { printf '—'; return; }
  du -sh -- "$1" 2>/dev/null | awk '{print $1}'
}

# Bytes (used internally for accumulating freed totals)
dir_bytes() {
  [[ -e "${1:-}" ]] || { printf '0'; return; }
  du -sb -- "$1" 2>/dev/null | awk '{print $1}'
}

# Days since target was last modified
dir_age_days() {
  [[ -e "${1:-}" ]] || { printf '—'; return; }
  local now ts
  now=$(date +%s)
  ts=$(stat -c %Y -- "$1" 2>/dev/null || echo "$now")
  printf '%d' $(( (now - ts) / 86400 ))
}

ui_show_disk() {
  ui_section "Disk & memory"
  df -h / | awk '{printf "  %s\n",$0}'
  printf '\n'
  free -h | awk '{printf "  %s\n",$0}'
}

# Bytes-pretty (uses numfmt if present, falls back to raw)
bytes_pretty() {
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec-i --suffix=B "$1" 2>/dev/null || printf '%sB' "$1"
  else
    printf '%sB' "$1"
  fi
}

require_sudo() {
  if sudo -n true 2>/dev/null; then return 0; fi
  ui_warn "Sudo password needed."
  sudo -v || { ui_err "sudo failed"; return 1; }
  # Keepalive in background until parent exits
  ( while true; do sudo -n true 2>/dev/null || exit; sleep 50; kill -0 "$$" 2>/dev/null || exit; done ) &
  SUDO_KEEPALIVE_PID=$!
  trap '[[ -n "${SUDO_KEEPALIVE_PID:-}" ]] && kill "$SUDO_KEEPALIVE_PID" 2>/dev/null || true' EXIT
}

# Print one row of a target table
ui_target_row() {
  local label="$1" path="$2" size
  size="$(dir_size "$path")"
  printf "  %-44s %10s  %s\n" "$label" "$size" "${C_DIM}$path${C_RST}"
}

# Generic interactive cleaner: prompt + safe_rm
clean_target() {
  local label="$1" target="$2" desc="${3:-}"
  if [[ ! -e "$target" ]]; then
    ui_info "$label — already absent"
    return 0
  fi
  local size
  size="$(dir_size "$target")"
  local prompt="Delete $label ($size)?"
  [[ -n "$desc" ]] && prompt+=" — $desc"
  if ui_confirm "$prompt" n; then
    if safe_rm "$target"; then
      ui_ok "$label cleared ($size freed)"
    fi
  else
    ui_info "$label — skipped"
  fi
}
