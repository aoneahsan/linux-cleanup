#!/usr/bin/env bash
# Clean superseded extension versions in VS Code / Cursor.
# Pattern: <publisher>.<name>-<x.y.z>[-platform]. Keep highest version per (name|platform), delete others.

clean_editor_old_extensions() {
  local ext_dir="$1" label="$2"
  if [[ ! -d "$ext_dir" ]]; then
    ui_info "$label — no extensions dir"
    return
  fi

  local entries=() d
  while IFS= read -r -d '' d; do entries+=("$(basename "$d")"); done < <(
    find "$ext_dir" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null
  )
  if (( ${#entries[@]} == 0 )); then
    ui_info "$label — no extensions installed"
    return
  fi

  declare -A groups
  local e name ver platform key
  for e in "${entries[@]}"; do
    if [[ "$e" =~ ^(.+)-([0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?)(-([a-z0-9_-]+))?$ ]]; then
      name="${BASH_REMATCH[1]}"
      ver="${BASH_REMATCH[2]}"
      platform="${BASH_REMATCH[5]:-}"
      key="${name}|${platform}"
      groups[$key]+="${ver}|${e}"$'\n'
    fi
  done

  local victims=() key sorted v dirname first
  for key in "${!groups[@]}"; do
    sorted=$(printf '%s' "${groups[$key]}" | grep -v '^$' | sort -t'|' -k1,1 -V -r)
    first=1
    while IFS='|' read -r v dirname; do
      [[ -z "$dirname" ]] && continue
      if (( first )); then first=0; continue; fi
      victims+=("$dirname")
    done <<<"$sorted"
  done

  if (( ${#victims[@]} == 0 )); then
    ui_info "$label — no superseded versions"
    return
  fi

  ui_section "$label — superseded extension versions"
  local total_b=0 b
  for v in "${victims[@]}"; do
    b=$(dir_bytes "$ext_dir/$v")
    total_b=$(( total_b + b ))
    printf "  %10s  %s\n" "$(dir_size "$ext_dir/$v")" "$v"
  done
  ui_info "Total reclaim: $(bytes_pretty "$total_b") across ${#victims[@]} dirs"

  if ui_confirm "Delete all superseded versions above?" n; then
    local freed=0
    for v in "${victims[@]}"; do
      b=$(dir_bytes "$ext_dir/$v")
      if safe_rm "$ext_dir/$v"; then
        freed=$(( freed + b ))
        ui_ok "deleted $v"
      fi
    done
    ui_ok "$label freed: $(bytes_pretty "$freed")"
  fi
}

run_editor_extensions() {
  ui_section "Editor extension cleanup (old versions)"
  clean_editor_old_extensions "$HOME/.vscode/extensions" "VS Code"
  clean_editor_old_extensions "$HOME/.cursor/extensions" "Cursor"
}
