#!/usr/bin/env bash
# roots.sh — the user-configurable search roots. Sourced, not executed.
#
# Two plain-text files, one absolute path per line; a line starting with `#` is a comment:
#   ${XDG_CONFIG_HOME:-~/.config}/linux-cleanup/project-roots.txt   (--node-modules, --globals)
#   ${XDG_CONFIG_HOME:-~/.config}/linux-cleanup/personal-roots.txt  (--stale)
# This module only ever APPENDS to them, and only after a prompt.

# Where developers commonly keep code. Used in addition to project-roots.txt;
# only the ones that exist are searched.
PROJECT_ROOT_DEFAULTS=(
  "$HOME/code" "$HOME/projects" "$HOME/Projects" "$HOME/dev" "$HOME/src"
  "$HOME/work" "$HOME/workspace" "$HOME/repos" "$HOME/git"
  "$HOME/Documents/projects" "$HOME/Documents/code"
)

roots_config_dir() { printf '%s' "${XDG_CONFIG_HOME:-$HOME/.config}/linux-cleanup"; }

# _root_allowed <resolved-path> — a search root may be any directory except
# the filesystem root, the whole home directory (every cache and dotfile would
# be walked) and the credential / configuration trees.
_root_allowed() {
  local p="$1" bad
  [[ -n "$p" && "$p" != "/" && "$p" != "$HOME" ]] || return 1
  for bad in "$HOME/.ssh" "$HOME/.gnupg" "$HOME/.config" "$HOME/.claude"; do
    [[ "$p" == "$bad" || "$p" == "$bad"/* ]] && return 1
  done
  return 0
}

# load_roots <file-name> [default-dir...] — fills the global array
# ROOTS_LOADED with every usable directory: the config file's lines first,
# then the defaults. Missing directories and refused paths are dropped;
# duplicates (after resolving symlinks) are listed once.
load_roots() {
  local file line real
  file="$(roots_config_dir)/$1"; shift
  local candidates=()
  if [[ -r "$file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line#"${line%%[![:space:]]*}"}"
      line="${line%"${line##*[![:space:]]}"}"
      [[ -z "$line" || "$line" == "#"* ]] && continue
      # A leading ~ is written by people, never expanded by `read`.
      # shellcheck disable=SC2088  # a literal tilde is exactly what is tested
      [[ "$line" == "~" || "$line" == "~/"* ]] && line="$HOME${line:1}"
      candidates+=("$line")
    done <"$file"
  fi
  candidates+=("$@")

  ROOTS_LOADED=()
  local -A seen=()
  for line in ${candidates[@]+"${candidates[@]}"}; do
    [[ -d "$line" ]] || continue
    real="$(realpath -e -- "$line" 2>/dev/null)" || continue
    if ! _root_allowed "$real"; then
      ui_warn "ignoring search root $line (too broad, or a credentials/config directory)"
      continue
    fi
    [[ -n "${seen[$real]+x}" ]] && continue
    seen["$real"]=1
    ROOTS_LOADED+=("$real")
  done
}

# prompt_add_root <file-name> <question> — asks for one directory and appends
# it to the config file. Interactive sessions only; returns 1 when nothing
# was added. Never runs under -y.
prompt_add_root() {
  local name="$1" question="$2" answer real dir
  (( ${ASSUME_YES:-0} )) && return 1
  [[ -t 0 ]] || return 1
  read -rp "${C_BLD}?${C_RST} $question (absolute path, empty to skip) " answer || return 1
  [[ -z "$answer" ]] && return 1
  # shellcheck disable=SC2088  # a literal tilde is exactly what is tested
  [[ "$answer" == "~" || "$answer" == "~/"* ]] && answer="$HOME${answer:1}"
  real="$(realpath -e -- "$answer" 2>/dev/null)" || { ui_err "no such directory: $answer"; return 1; }
  [[ -d "$real" ]] || { ui_err "not a directory: $answer"; return 1; }
  _root_allowed "$real" || { ui_err "refused: $answer is too broad, or a credentials/config directory"; return 1; }
  dir="$(roots_config_dir)"
  mkdir -p "$dir" || return 1
  printf '%s\n' "$real" >>"$dir/$name"
  ui_ok "added $real to $dir/$name"
}

# load_project_roots — ROOTS_LOADED = project-roots.txt + existing defaults.
load_project_roots() { load_roots project-roots.txt "${PROJECT_ROOT_DEFAULTS[@]}"; }

# load_personal_roots — ROOTS_LOADED = Downloads + Desktop + personal-roots.txt.
load_personal_roots() { load_roots personal-roots.txt "$HOME/Downloads" "$HOME/Desktop"; }
