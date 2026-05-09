#!/usr/bin/env bash
# global_packages.sh — READ-ONLY audit of globally installed npm/pnpm/yarn
# packages. Reports candidates that look unused (mtime older than $DAYS) and
# that have no other global package depending on them. NEVER uninstalls
# anything — prints the exact command for the user to run themselves.
#
# This module exists because earlier versions of the cleanup wiped
# $HOME/.local/share/pnpm wholesale, destroying global installs (firebase-tools,
# yarn, etc.) and the `pnpm setup` shims. We never auto-touch globals again.

# Resolve the global node_modules dir for a given package manager.
# Tries the PM's own CLI first, then falls back to well-known filesystem paths
# so we still find globals when the CLI isn't on PATH (common in cron / npx).
_global_modules_dir() {
  local pm="$1" prefix
  case "$pm" in
    npm)
      if command -v npm >/dev/null 2>&1; then
        prefix="$(npm root -g 2>/dev/null)" || true
        [[ -n "$prefix" && -d "$prefix" ]] && { printf '%s' "$prefix"; return; }
      fi
      for prefix in "$HOME/.npm-global/lib/node_modules" \
                    "/usr/local/lib/node_modules" \
                    "/usr/lib/node_modules"; do
        [[ -d "$prefix" ]] && { printf '%s' "$prefix"; return; }
      done
      ;;
    pnpm)
      if command -v pnpm >/dev/null 2>&1; then
        prefix="$(pnpm root -g 2>/dev/null)" || true
        [[ -n "$prefix" && -d "$prefix" ]] && { printf '%s' "$prefix"; return; }
      fi
      # pnpm stores globals at ~/.local/share/pnpm/global/<version>/node_modules.
      # Pick the highest-numbered version dir.
      local base="$HOME/.local/share/pnpm/global"
      if [[ -d "$base" ]]; then
        local v
        v="$(ls -1 "$base" 2>/dev/null | sort -V | tail -1)"
        [[ -n "$v" && -d "$base/$v/node_modules" ]] && { printf '%s' "$base/$v/node_modules"; return; }
      fi
      ;;
    yarn)
      if command -v yarn >/dev/null 2>&1; then
        prefix="$(yarn global dir 2>/dev/null)/node_modules" || true
        [[ -n "$prefix" && -d "$prefix" ]] && { printf '%s' "$prefix"; return; }
      fi
      for prefix in "$HOME/.config/yarn/global/node_modules" \
                    "$HOME/.yarn/global/node_modules"; do
        [[ -d "$prefix" ]] && { printf '%s' "$prefix"; return; }
      done
      ;;
  esac
  return 0
}

# Extract dependency NAMES from a package.json (top-level deps only).
_manifest_dep_names() {
  local pj="$1"
  [[ -f "$pj" ]] || return 0
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$pj" <<'PY' 2>/dev/null
import json, sys
try:
    with open(sys.argv[1]) as f: p = json.load(f)
except Exception: sys.exit(0)
for n in (p.get("dependencies") or {}).keys():
    print(n)
PY
  else
    awk '
      /"dependencies"[[:space:]]*:/ {indep=1; next}
      indep && /\}/ {indep=0}
      indep && /^[[:space:]]*"[^"]+"[[:space:]]*:/ {
        gsub(/^[[:space:]]*"|"[[:space:]]*:.*$/, ""); print
      }' "$pj"
  fi
}

# Resolve "<name>" to its on-disk directory under a given node_modules root.
# Handles @scope/name. Returns empty if not present.
_resolve_in_root() {
  local root="$1" name="$2" candidate="$root/$name"
  [[ -d "$candidate" ]] && { printf '%s' "$candidate"; return; }
}

# List every DIRECTLY-INSTALLED global package as "<name>\t<dir>".
# Avoids transitive deps (which pnpm/yarn hoist into the same tree).
_list_global_packages() {
  local pm="$1" root
  root="$(_global_modules_dir "$pm")"
  # For npm we require a flat root. For pnpm/yarn we read manifests directly,
  # so an empty `root` is OK as long as the manifest paths exist.
  if [[ "$pm" == "npm" ]]; then
    [[ -n "$root" && -d "$root" ]] || return 0
  fi

  case "$pm" in
    npm)
      # npm's global node_modules is flat — top-level entries ARE direct installs.
      local entry sub name
      for entry in "$root"/*; do
        [[ -d "$entry" ]] || continue
        name="${entry##*/}"
        case "$name" in
          .*|.bin|.cache|.modules.yaml|.pnpm) continue ;;
          @*)
            for sub in "$entry"/*; do
              [[ -d "$sub" ]] || continue
              printf '%s/%s\t%s\n' "$name" "${sub##*/}" "$sub"
            done
            ;;
          *) printf '%s\t%s\n' "$name" "$entry" ;;
        esac
      done
      ;;
    pnpm)
      # pnpm's truth is the per-version manifests at:
      #   ~/.local/share/pnpm/global/v*/<hash>/package.json
      local manifest names_seen=" " name dir
      for manifest in "$HOME/.local/share/pnpm/global"/v*/*/package.json; do
        [[ -f "$manifest" ]] || continue
        while IFS= read -r name; do
          [[ -z "$name" ]] && continue
          # Skip the @pnpm/exe wiring entry — internal pnpm bookkeeping.
          [[ "$name" == "@pnpm/exe" ]] && continue
          # Dedupe.
          [[ "$names_seen" == *" $name "* ]] && continue
          names_seen+="$name "
          dir="$(_resolve_in_root "$root" "$name")"
          [[ -z "$dir" ]] && dir="$(dirname "$manifest")/node_modules/$name"
          [[ -d "$dir" ]] || dir="$(dirname "$manifest")"
          printf '%s\t%s\n' "$name" "$dir"
        done < <(_manifest_dep_names "$manifest")
      done
      ;;
    yarn)
      # yarn classic: ~/.config/yarn/global/package.json lists direct installs.
      local manifest="$HOME/.config/yarn/global/package.json"
      [[ -f "$manifest" ]] || manifest="$HOME/.yarn/global/package.json"
      [[ -f "$manifest" ]] || return 0
      local name dir
      while IFS= read -r name; do
        [[ -z "$name" ]] && continue
        dir="$(_resolve_in_root "$root" "$name")"
        [[ -n "$dir" ]] && printf '%s\t%s\n' "$name" "$dir"
      done < <(_manifest_dep_names "$manifest")
      ;;
  esac
}

# Collect dependency names from a package's package.json into a newline list.
# Reads dependencies + peerDependencies (devDeps don't matter for installed CLIs).
_pkg_deps() {
  local pj="$1"
  [[ -f "$pj" ]] || return 0
  # Use python if present (more robust), else grep fallback.
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$pj" <<'PY' 2>/dev/null
import json, sys
try:
    with open(sys.argv[1]) as f: p = json.load(f)
except Exception: sys.exit(0)
for k in ("dependencies", "peerDependencies"):
    for n in (p.get(k) or {}).keys():
        print(n)
PY
  else
    grep -oE '"[^"]+":\s*"[^"]+"' "$pj" \
      | awk -F'"' '{print $2}' \
      | grep -vE '^(name|version|description|main|bin|scripts|engines|repository|author|license|keywords|homepage|files|type|module|exports|types|typings)$'
  fi
}

run_global_packages_audit() {
  ui_section "Global packages audit (read-only)"
  ui_info "Stale threshold: ${DAYS} days. Nothing will be uninstalled — this is informational only."
  ui_warn "Run any uninstall commands MANUALLY after reviewing the list."

  local pm any=0
  for pm in npm pnpm yarn; do
    local root pkgs
    root="$(_global_modules_dir "$pm")"
    pkgs="$(_list_global_packages "$pm")"
    if [[ -z "$pkgs" ]]; then
      ui_info "$pm — not installed or no global packages"
      continue
    fi
    any=1
    printf '\n%b── %s globals (%s) ──%b\n' "${C_BLD}" "$pm" "${root:-<manifest-based>}" "${C_RST}"

    # Build set of all directly-installed global package names (for dependent check).
    local installed_names
    installed_names="$(_list_global_packages "$pm" | awk -F'\t' '{print $1}' | sort -u)"

    # Build reverse-dep map: which other globals declare each package as a dep.
    declare -A reverse_deps=()
    local line name dir
    while IFS=$'\t' read -r name dir; do
      [[ -n "$dir" ]] || continue
      local dep
      while IFS= read -r dep; do
        [[ -z "$dep" ]] && continue
        reverse_deps["$dep"]+="$name "
      done < <(_pkg_deps "$dir/package.json")
    done < <(_list_global_packages "$pm")

    # Now classify each installed global.
    printf '  %-40s %8s  %s\n' "PACKAGE" "AGE(d)" "STATUS"
    local stale_count=0 safe_count=0
    while IFS=$'\t' read -r name dir; do
      [[ -n "$dir" ]] || continue
      local age status="active"
      age="$(dir_age_days "$dir")"
      local depended_by="${reverse_deps[$name]:-}"
      if [[ -n "$depended_by" ]]; then
        status="needed by: ${depended_by% }"
      elif [[ "$age" =~ ^[0-9]+$ ]] && (( age >= DAYS )); then
        status="${C_YLW}STALE — safe to uninstall${C_RST}"
        stale_count=$(( stale_count + 1 ))
        case "$pm" in
          npm)  printf -v _cmd "  npm uninstall -g %s" "$name" ;;
          pnpm) printf -v _cmd "  pnpm remove -g %s" "$name" ;;
          yarn) printf -v _cmd "  yarn global remove %s" "$name" ;;
        esac
      else
        status="recently used"
      fi
      printf '  %-40s %8s  %b\n' "$name" "$age" "$status"
    done < <(_list_global_packages "$pm" | sort)

    if (( stale_count > 0 )); then
      printf '\n  %bSuggested uninstall commands (run manually):%b\n' "${C_DIM}" "${C_RST}"
      while IFS=$'\t' read -r name dir; do
        [[ -n "$dir" ]] || continue
        local age
        age="$(dir_age_days "$dir")"
        [[ -n "${reverse_deps[$name]:-}" ]] && continue
        [[ "$age" =~ ^[0-9]+$ ]] && (( age >= DAYS )) || continue
        case "$pm" in
          npm)  printf '    npm uninstall -g %s\n' "$name" ;;
          pnpm) printf '    pnpm remove -g %s\n' "$name" ;;
          yarn) printf '    yarn global remove %s\n' "$name" ;;
        esac
      done < <(_list_global_packages "$pm" | sort)
    else
      ui_info "$pm — no stale globals (>${DAYS}d unused with no dependents)"
    fi
    unset reverse_deps
  done

  (( any )) || ui_info "No package managers with global installs found."
  ui_info "This audit never modifies anything. Copy a command above to uninstall manually."
}
