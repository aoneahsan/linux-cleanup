#!/usr/bin/env bash
# Personal-data scans — INTERACTIVE ONLY. No batch / auto-yes for personal files.

# Partial / orphan downloads
run_partial_downloads() {
  ui_section "Partial / orphan downloads in ~/Downloads"
  local files=() f
  while IFS= read -r -d '' f; do files+=("$f"); done < <(
    find "$HOME/Downloads" -maxdepth 4 -type f \
      \( -name "*.fdmdownload" -o -name "*.crdownload" -o -name "*.part" -o -name "*.aria2" \) \
      -print0 2>/dev/null
  )
  if (( ${#files[@]} == 0 )); then
    ui_info "None found."
    return
  fi
  for f in "${files[@]}"; do
    printf "  %10s  %s\n" "$(du -h -- "$f" 2>/dev/null | cut -f1)" "$f"
  done
  if ui_confirm "Delete all ${#files[@]} partial downloads?" n; then
    for f in "${files[@]}"; do
      if is_protected "$f"; then ui_warn "skip protected: $f"; continue; fi
      rm -f -- "$f" && ui_ok "deleted $f"
    done
  fi
}

# Stale personal files >N days unaccessed, >10MB, in Downloads/Desktop only.
# Always interactive — never auto.
run_stale_personal() {
  local days="${DAYS:-100}"
  ui_section "Personal files unused ${days}+ days (>10MB) in ~/Downloads + ~/Desktop"
  ui_warn "Personal data — interactive only. Nothing is deleted without your confirmation."

  local roots=("$HOME/Downloads" "$HOME/Desktop")
  local found=() f
  while IFS= read -r -d '' f; do found+=("$f"); done < <(
    find "${roots[@]}" -maxdepth 4 -type f -atime +"$days" -size +10M -print0 2>/dev/null
  )

  if (( ${#found[@]} == 0 )); then
    ui_info "Nothing >10MB unused for ${days}+ days."
    return
  fi

  printf "${C_BLD}%4s %10s %12s  %s${C_RST}\n" "#" "SIZE" "LAST-ACCESS" "PATH"
  local i=1 sz la
  for f in "${found[@]}"; do
    sz=$(du -h -- "$f" 2>/dev/null | cut -f1)
    la=$(stat -c '%x' -- "$f" 2>/dev/null | cut -d' ' -f1)
    printf "%4d %10s %12s  %s\n" "$i" "$sz" "$la" "$f"
    ((i++))
    (( i > 100 )) && { ui_warn "(truncated to 100 entries)"; break; }
  done

  printf '\n%s\n' "Choose action:"
  printf '  %s\n' "a   review each one (per-file y/n)"
  printf '  %s\n' "c   enter comma/range indexes to delete (e.g. 1,3,5-7)"
  printf '  %s\n' "s   skip"
  local mode
  read -rp "> " mode
  case "$mode" in
    a)
      for f in "${found[@]}"; do
        if is_protected "$f"; then ui_warn "protected, skipping: $f"; continue; fi
        ls -lh -- "$f" 2>/dev/null
        if ui_confirm "Delete this file?" n; then
          rm -f -- "$f" && ui_ok "deleted"
        fi
      done
      ;;
    c)
      local idxs picks=()
      read -rp "Indexes (e.g. 1,3,5-7): " idxs
      local IFS=','; local parts=($idxs); unset IFS
      local p k
      for p in "${parts[@]}"; do
        p="${p// /}"
        if [[ "$p" =~ ^([0-9]+)-([0-9]+)$ ]]; then
          for ((k=${BASH_REMATCH[1]}; k<=${BASH_REMATCH[2]}; k++)); do picks+=("$k"); done
        elif [[ "$p" =~ ^[0-9]+$ ]]; then
          picks+=("$p")
        fi
      done
      if (( ${#picks[@]} == 0 )); then ui_info "No valid indexes."; return; fi
      printf '\nSelected files:\n'
      for k in "${picks[@]}"; do printf '  [%s] %s\n' "$k" "${found[$((k-1))]:-<out-of-range>}"; done
      if ui_confirm "Confirm delete ALL of the above?" n; then
        for k in "${picks[@]}"; do
          local target="${found[$((k-1))]:-}"
          [[ -z "$target" ]] && continue
          if is_protected "$target"; then ui_warn "protected, skipping: $target"; continue; fi
          rm -f -- "$target" && ui_ok "deleted $target"
        done
      fi
      ;;
    *)
      ui_info "skipped"
      ;;
  esac
}

# Show top dirs in HOME by size, marking protected vs reclaimable
run_size_audit() {
  ui_section "Top 20 largest entries in \$HOME"
  du -sh -- "$HOME"/* "$HOME"/.[!.]* 2>/dev/null | sort -hr | head -20 \
    | awk '{ printf "  %8s  %s\n", $1, $2 }'
}
