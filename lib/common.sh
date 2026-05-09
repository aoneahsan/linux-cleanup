#!/usr/bin/env bash
# common.sh — UI helpers, safety guards, sudo handling. Sourced, not executed.

# Project metadata
LINUX_CLEANUP_VERSION="1.3.0"
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
  "$HOME/.bun"
  "$HOME/.bun/install"
  "$HOME/.bun/install/global"
  "$HOME/.bun/install/global/node_modules"
  "$HOME/.bun/bin"
  "$HOME/.deno"
  "$HOME/.deno/bin"
  "$HOME/.volta"
  "$HOME/.volta/bin"
  "$HOME/.nvm"
  "$HOME/.nvm/versions"
  "$HOME/.fnm"
  "$HOME/.cargo"
  "$HOME/.cargo/bin"
  "$HOME/.rustup"
  "$HOME/go"
  "$HOME/go/bin"
)

# Filename basenames that are ALWAYS off-limits, anywhere on disk.
# safe_rm refuses if the target path is or ends with any of these.
PROTECTED_BASENAMES=(
  ".bashrc" ".bash_profile" ".bash_login" ".profile" ".bash_logout"
  ".zshrc" ".zshenv" ".zprofile" ".zlogin" ".zlogout"
  ".bash_aliases" ".bash_history" ".zsh_history"
  ".inputrc" ".dircolors" ".config" ".local"
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
  # Last-ditch basename guard: never delete shell-init / history files,
  # regardless of caller. Belt-and-braces against a future bug introducing
  # such a path into a target list.
  local base="${target##*/}"
  local pb
  for pb in "${PROTECTED_BASENAMES[@]}"; do
    if [[ "$base" == "$pb" ]]; then
      ui_err "REFUSE: shell-init / history file: $target"; return 1
    fi
  done
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

# prune_stale <root> <days>
#
# Walks <root> and deletes only files where BOTH atime and mtime are older
# than <days> days. Then removes any directories left empty as a result.
# Refuses if <root> is in the protected list. Echoes bytes freed.
#
# This is the surgical alternative to safe_rm <dir>: instead of nuking the
# whole cache (which destroys e.g. Gradle wrapper distros the user opens
# every 1-2 months), it only takes content the user genuinely hasn't touched
# in the cooling-off window. Defaults align with $DAYS (default 100).
prune_stale() {
  local root="$1" days="${2:-${DAYS:-100}}"
  [[ -e "$root" ]] || { printf '0'; return 0; }
  if is_protected "$root"; then
    ui_err "REFUSE: protected path: $root"
    printf '0'; return 1
  fi
  local before after freed
  before=$(dir_bytes "$root")
  # Only delete a file if it's untouched (atime) AND unmodified (mtime) for >days.
  # -depth ensures we process contents before parents; -delete then nukes file/symlink.
  find "$root" -depth -mindepth 1 \
       \( -type f -o -type l \) \
       -atime +"$days" -mtime +"$days" \
       -delete 2>/dev/null || true
  # Sweep up directories that became empty.
  find "$root" -depth -mindepth 1 -type d -empty -delete 2>/dev/null || true
  after=$(dir_bytes "$root")
  freed=$(( before - after ))
  (( freed < 0 )) && freed=0
  printf '%d' "$freed"
}

# newest_access_age_days <path>
#
# For a file: prints the smaller of (now - atime) and (now - mtime), in days.
# For a directory: walks recursively and prints the freshest atime/mtime
# anywhere inside, in days. "How many days since this asset was last
# touched in any way." Echoes a very large number if the path is missing
# so callers can treat it as "definitely stale" without special-casing.
newest_access_age_days() {
  local path="$1"
  [[ -e "$path" ]] || { printf '999999'; return; }
  local now newest
  now=$(date +%s)
  if [[ -f "$path" || -L "$path" ]]; then
    local at mt
    at=$(stat -c %X -- "$path" 2>/dev/null || echo 0)
    mt=$(stat -c %Y -- "$path" 2>/dev/null || echo 0)
    newest=$(( at > mt ? at : mt ))
  else
    # Look at FILES only — directory atimes/mtimes get bumped by routine
    # operations (creating, renaming, listing in some FS configs) and don't
    # reflect actual usage of the underlying asset. Files are the truth.
    newest=$(find "$path" \( -type f -o -type l \) -printf '%A@\n%T@\n' 2>/dev/null \
             | awk -F. '{print $1}' | sort -n | tail -1)
    if [[ -z "$newest" || "$newest" == "0" ]]; then
      # Empty dir or unreadable — fall back to dir's own mtime as last resort.
      newest=$(stat -c %Y -- "$path" 2>/dev/null || echo 0)
    fi
  fi
  printf '%d' $(( (now - newest) / 86400 ))
}

# prune_stale_units <root> <days> [glob]
#
# Treats each top-level child of <root> matching <glob> (default *) as an
# indivisible unit (e.g. one AVD, one tool installation, one Gradle distro).
# A unit is deleted whole only when EVERY file inside it has atime AND mtime
# older than <days>. Recently-used units survive intact. Echoes bytes freed.
#
# Use this for caches where partial-prune would corrupt state (Android AVDs,
# editor extensions with sibling metadata files, etc.).
prune_stale_units() {
  local root="$1" days="${2:-${DAYS:-100}}" pattern="${3:-*}"
  [[ -d "$root" ]] || { printf '0'; return 0; }
  if is_protected "$root"; then
    ui_err "REFUSE: protected path: $root"
    printf '0'; return 1
  fi
  local freed=0 entry age b
  shopt -s nullglob dotglob
  for entry in "$root"/$pattern; do
    [[ -e "$entry" ]] || continue
    age=$(newest_access_age_days "$entry")
    if (( age > days )); then
      b=$(dir_bytes "$entry")
      if safe_rm "$entry"; then
        freed=$(( freed + b ))
        ui_ok "  pruned $(basename "$entry") (${age}d idle, $(bytes_pretty "$b") freed)"
      fi
    else
      ui_info "  kept $(basename "$entry") (${age}d idle — within ${days}d window)"
    fi
  done
  shopt -u nullglob dotglob
  printf '%d' "$freed"
}

# Generic interactive cleaner.
#
# Default mode (PURGE_ALL=0): prune only files unused for ≥${DAYS}d
# (both atime and mtime older than threshold). Recently-used items survive.
# This protects rarely-used-but-valuable assets like Gradle wrapper distros,
# Playwright browsers for an old release branch, etc.
#
# Full-purge mode (PURGE_ALL=1, via --purge-all): wipe the entire target.
# Use this when you genuinely want pre-1.2.0 behavior.
clean_target() {
  local label="$1" target="$2" desc="${3:-}"
  if [[ ! -e "$target" ]]; then
    ui_info "$label — already absent"
    return 0
  fi
  local size
  size="$(dir_size "$target")"

  if (( ${PURGE_ALL:-0} == 1 )); then
    local prompt="Delete $label ($size, FULL PURGE)?"
    [[ -n "$desc" ]] && prompt+=" — $desc"
    if ui_confirm "$prompt" n; then
      safe_rm "$target" && ui_ok "$label cleared ($size freed)"
    else
      ui_info "$label — skipped"
    fi
    return
  fi

  local prompt="Prune $label files unused ≥${DAYS}d ($size in total)?"
  [[ -n "$desc" ]] && prompt+=" — $desc"
  if ui_confirm "$prompt" n; then
    if is_protected "$target"; then
      ui_err "REFUSE: protected path: $target"
      return 1
    fi
    local freed
    freed=$(prune_stale "$target" "${DAYS:-100}")
    if (( freed > 0 )); then
      ui_ok "$label pruned — $(bytes_pretty "$freed") freed; $(dir_size "$target") remains (recently-used kept)"
    else
      ui_info "$label — nothing older than ${DAYS}d; nothing pruned"
    fi
  else
    ui_info "$label — skipped"
  fi
}
