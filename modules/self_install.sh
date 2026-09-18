#!/usr/bin/env bash
# self_install.sh — the `cleanup` shell alias and the weekly cron entry.
#
# Both have to keep working after the copy of the tool that installed them is
# gone. Under npx the tool runs from ~/.npm/_npx/<hash>/…, a directory npm
# evicts (and this tool's own all-safe run prunes once idle), and a global npm
# install lives under one Node version's prefix, which cron cannot see. So when
# started by the Node launcher the tool first copies itself to <data-home>/app
# and points the alias and the cron line there: no node, npx or network is
# needed at run time. A git clone is already a stable location and is used as is.
#
# Entries are recognised by a marker, never by the path they happen to hold,
# so an entry written by an older version (or from a vanished npx cache) is
# still found, updated and uninstalled.

SELF_ALIAS_MARKER='# linux-cleanup tool'
SELF_CRON_MARKER='# linux-cleanup'
SELF_ALIAS_RE="^alias cleanup=.*cleanup\.sh'\$"
SELF_CRON_RE="(${SELF_CRON_MARKER}\$|/cleanup\.sh --all-safe)"

_self_data_home() { printf '%s' "${LINUX_CLEANUP_DATA_HOME:-$HOME/.linux-cleanup}"; }
_self_app_dir()   { printf '%s/app' "$(_self_data_home)"; }

# _self_persist — copy the running tool to <data-home>/app (atomic swap).
# A copy of the same version is left alone. Returns 1 when the copy failed.
_self_persist() {
  local app item; app="$(_self_app_dir)"
  [[ "$app" == */app && "$app" != /app ]] || return 1
  if [[ -f "$app/.persistent" ]] && cmp -s "$app/VERSION" "$CLEANUP_ROOT/VERSION"; then
    return 0
  fi
  rm -rf -- "$app.new"
  mkdir -p "$app.new" || return 1
  for item in cleanup.sh lib modules VERSION LICENSE; do
    [[ -e "$CLEANUP_ROOT/$item" ]] || continue
    cp -a -- "$CLEANUP_ROOT/$item" "$app.new/" || { rm -rf -- "$app.new"; return 1; }
  done
  [[ -f "$app.new/cleanup.sh" ]] || { rm -rf -- "$app.new"; return 1; }
  : >"$app.new/.persistent"
  rm -rf -- "$app"
  mv -- "$app.new" "$app"
}

# _self_target — the cleanup.sh path an alias or cron line should call.
_self_target() {
  if [[ "${LINUX_CLEANUP_LAUNCHER:-}" == node && ! -f "$CLEANUP_ROOT/.persistent" ]]; then
    if _self_persist; then
      printf '%s/cleanup.sh' "$(_self_app_dir)"
      return 0
    fi
    ui_warn "could not copy the tool to $(_self_app_dir); using the current location, which npm may evict" >&2
  fi
  printf '%s/cleanup.sh' "$CLEANUP_ROOT"
}

_self_alias_in()  { grep -qsF "$SELF_ALIAS_MARKER" "$1" || grep -qsE "$SELF_ALIAS_RE" "$1"; }
_self_cron_lines() { crontab -l 2>/dev/null | grep -E "$SELF_CRON_RE"; }

# Used by the walkthrough's "next steps" hints.
self_alias_installed() {
  local f
  for f in "$HOME/.bash_aliases" "$HOME/.zshrc" "$HOME/.bashrc"; do
    _self_alias_in "$f" && return 0
  done
  return 1
}
self_cron_installed() { command -v crontab >/dev/null 2>&1 && [[ -n "$(_self_cron_lines)" ]]; }

_self_strip_alias() {
  sed -i.bak -e "/^${SELF_ALIAS_MARKER}\$/d" -e "/${SELF_ALIAS_RE//\//\\/}/d" "$1"
}

install_alias() {
  ui_section "Install shell alias"
  local target_file="$HOME/.bash_aliases"
  if [[ -f "$HOME/.zshrc" && ! -f "$HOME/.bash_aliases" ]]; then
    target_file="$HOME/.zshrc"
  fi
  local target line
  target="$(_self_target)"
  line="alias cleanup='$target'"
  if grep -qsxF "$line" "$target_file" 2>/dev/null; then
    ui_info "alias already present in $target_file"
    return
  fi
  if _self_alias_in "$target_file"; then
    ui_info "an older 'cleanup' alias is in $target_file:"
    grep -E "$SELF_ALIAS_RE" "$target_file" | sed 's/^/  /'
    ui_confirm "Point it at $target instead?" y || { ui_info "left unchanged"; return; }
    _self_strip_alias "$target_file"
  elif ! ui_confirm "Add 'cleanup' alias to $target_file ?" y; then
    return
  fi
  {
    printf '\n'
    printf '%s\n' "$SELF_ALIAS_MARKER"
    printf '%s\n' "$line"
  } >>"$target_file"
  ui_ok "added. Run: source $target_file  (or open a new terminal), then 'cleanup'"
  [[ "$target" == "$(_self_app_dir)/cleanup.sh" ]] \
    && ui_info "The alias runs a persistent copy in $(_self_app_dir) — run --install-alias again after an upgrade to refresh it."
}

install_cron() {
  ui_section "Install weekly cron"
  if ! command -v crontab >/dev/null 2>&1; then
    ui_warn "crontab is not installed — nothing scheduled"
    return
  fi
  local target cron_line existing
  target="$(_self_target)"
  cron_line="0 3 * * 0 $target --all-safe -y >>$LOG_DIR/cron.log 2>&1 $SELF_CRON_MARKER"
  existing="$(_self_cron_lines)"
  if [[ "$existing" == "$cron_line" ]]; then
    ui_info "cron entry already present:"
    printf '  %s\n' "$existing"
    return
  fi
  if [[ -n "$existing" ]]; then
    ui_info "an older cleanup cron entry exists:"
    printf '%s\n' "$existing" | sed 's/^/  /'
    ui_confirm "Replace it with: $cron_line ?" y || { ui_info "left unchanged"; return; }
  else
    ui_info "Will add: $cron_line"
    ui_confirm "Add this entry to crontab?" y || return
  fi
  ( crontab -l 2>/dev/null | grep -vE "$SELF_CRON_RE"; printf '%s\n' "$cron_line" ) | crontab -
  ui_ok "cron installed (runs every Sunday 03:00, logs to $LOG_DIR/cron.log)"
}

# _self_drop_app — offer to remove the persistent copy once nothing calls it.
_self_drop_app() {
  local app; app="$(_self_app_dir)"
  [[ -f "$app/.persistent" && "$app" == */app && "$app" != /app ]] || return 0
  self_alias_installed && return 0
  self_cron_installed && return 0
  [[ "$CLEANUP_ROOT" == "$app" ]] && return 0
  if ui_confirm "Nothing uses the persistent copy at $app any more. Remove it?" y; then
    rm -rf -- "$app" && ui_ok "removed $app"
  fi
}

uninstall_alias() {
  ui_section "Uninstall shell alias"
  local found=0 file
  for file in "$HOME/.bash_aliases" "$HOME/.zshrc" "$HOME/.bashrc"; do
    [[ -f "$file" ]] || continue
    if _self_alias_in "$file"; then
      found=1
      if ui_confirm "Remove cleanup-related lines from $file ?" y; then
        _self_strip_alias "$file"
        ui_ok "removed (backup at ${file}.bak)"
      fi
    fi
  done
  (( found == 0 )) && ui_info "no cleanup alias found"
  _self_drop_app
}

uninstall_cron() {
  ui_section "Uninstall cron entry"
  if ! command -v crontab >/dev/null 2>&1; then
    ui_info "crontab not installed"
    return
  fi
  if [[ -z "$(_self_cron_lines)" ]]; then
    ui_info "no cleanup cron entry found"
    return
  fi
  if ui_confirm "Remove cleanup cron entry?" y; then
    ( crontab -l 2>/dev/null | grep -vE "$SELF_CRON_RE" ) | crontab -
    ui_ok "cron entry removed"
  fi
  _self_drop_app
}
