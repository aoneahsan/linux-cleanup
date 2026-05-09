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

  # Per-version idle gate (since v1.2.0): a superseded version qualifies for
  # deletion only if its files haven't been touched (atime/mtime) for ≥${DAYS}d.
  # Active superseded = "the editor still loads it occasionally" → keep.
  # The "newer version exists" check already covers condition #1
  # (no active software depends on this version); the idle gate covers #2.
  local eligible=() ineligible=() v age
  for v in "${victims[@]}"; do
    age=$(newest_access_age_days "$ext_dir/$v")
    if (( ${PURGE_ALL:-0} == 1 )) || (( age > ${DAYS:-100} )); then
      eligible+=("$v|$age")
    else
      ineligible+=("$v|$age")
    fi
  done

  ui_section "$label — superseded extension versions"
  local total_b=0 b name age_d
  if (( ${#ineligible[@]} > 0 )); then
    ui_info "Kept (used within ${DAYS:-100}d window — superseded but still loaded):"
    for entry in "${ineligible[@]}"; do
      name="${entry%|*}"; age_d="${entry##*|}"
      printf "  %4dd idle  %10s  %s\n" "$age_d" "$(dir_size "$ext_dir/$name")" "$name"
    done
  fi
  if (( ${#eligible[@]} == 0 )); then
    ui_info "$label — no superseded versions older than ${DAYS:-100}d. Nothing to delete."
    return
  fi
  ui_info "Eligible for deletion (superseded AND ≥${DAYS:-100}d idle):"
  for entry in "${eligible[@]}"; do
    name="${entry%|*}"; age_d="${entry##*|}"
    b=$(dir_bytes "$ext_dir/$name")
    total_b=$(( total_b + b ))
    printf "  %4dd idle  %10s  %s\n" "$age_d" "$(dir_size "$ext_dir/$name")" "$name"
  done
  ui_info "Total reclaim: $(bytes_pretty "$total_b") across ${#eligible[@]} dirs"

  if ui_confirm "Delete the ${#eligible[@]} eligible superseded versions above?" n; then
    local freed=0
    for entry in "${eligible[@]}"; do
      name="${entry%|*}"
      b=$(dir_bytes "$ext_dir/$name")
      if safe_rm "$ext_dir/$name"; then
        freed=$(( freed + b ))
        ui_ok "deleted $name"
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
