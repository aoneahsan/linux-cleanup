#!/usr/bin/env bash
# Package-manager caches. All regenerable.

clean_yarn_v1()   { clean_target "Yarn v1 cache"           "$HOME/.cache/yarn"            "regenerated on next yarn install"; }
clean_yarn_berry(){ clean_target "Yarn berry global cache" "$HOME/.yarn/berry/cache"      "regenerated on next install"; }
clean_npm_npx()   { clean_target "npx package cache"       "$HOME/.npm/_npx"              "regenerated on next npx run"; }
clean_pnpm_store(){ clean_target "pnpm content store"      "$HOME/.local/share/pnpm"      "regenerated on next pnpm install"; }
clean_pnpm_cache(){ clean_target "pnpm cache"              "$HOME/.cache/pnpm"            "regenerated"; }
clean_composer()  { clean_target "Composer cache"          "$HOME/.cache/composer"        "regenerated"; }
clean_pip()       { clean_target "pip cache"               "$HOME/.cache/pip"             "regenerated"; }

clean_npm_cache() {
  if [[ ! -e "$HOME/.npm/_cacache" ]]; then
    ui_info "npm cache — already absent"; return 0
  fi
  local size; size="$(dir_size "$HOME/.npm/_cacache")"
  if ui_confirm "Run npm cache clean --force ($size)?" n; then
    if command -v npm >/dev/null 2>&1; then
      npm cache clean --force >/dev/null 2>&1 && ui_ok "npm cache cleared ($size freed)"
    else
      safe_rm "$HOME/.npm/_cacache" && ui_ok "npm cache dir removed ($size freed)"
    fi
  else
    ui_info "npm cache — skipped"
  fi
}

run_pkg_managers() {
  ui_section "Package-manager caches"
  clean_yarn_v1
  clean_yarn_berry
  clean_npm_cache
  clean_npm_npx
  clean_pnpm_store
  clean_pnpm_cache
  clean_composer
  clean_pip
}
