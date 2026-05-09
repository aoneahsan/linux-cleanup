#!/usr/bin/env bash
# System cleanup — needs sudo. apt, journal, snap, kernels, page cache, /tmp.

sys_apt_clean() {
  ui_info "apt autoremove --purge -y && apt clean"
  if ui_confirm "Run apt autoremove + clean?" y; then
    sudo apt autoremove --purge -y 2>&1 | tail -20
    sudo apt clean
    ui_ok "apt cleaned"
  fi
}

sys_journal_vacuum() {
  local cur
  cur="$(journalctl --disk-usage 2>/dev/null | grep -oE '[0-9.]+[GMK]' | head -1 || echo '?')"
  ui_info "Journal currently uses $cur"
  if ui_confirm "Vacuum journal to 100M?" y; then
    sudo journalctl --vacuum-size=100M 2>&1 | tail -5
    ui_ok "journal vacuumed"
  fi
}

sys_old_snaps() {
  if ! command -v snap >/dev/null 2>&1; then
    ui_info "snap not installed — skipping."
    return
  fi
  local revs
  revs="$(snap list --all 2>/dev/null | awk '/disabled/ {print $1, $3}')"
  if [[ -z "$revs" ]]; then
    ui_info "No disabled snap revisions."
    return
  fi
  echo "Disabled revisions:"
  echo "$revs" | awk '{printf "  %s rev %s\n", $1, $2}'
  if ui_confirm "Remove all disabled snap revisions above?" y; then
    while read -r name rev; do
      [[ -z "$name" ]] && continue
      sudo snap remove "$name" --revision="$rev" 2>&1 | tail -1
    done <<<"$revs"
    ui_ok "old snap revisions removed"
  fi
}

sys_old_kernels() {
  local cur; cur="$(uname -r)"
  ui_info "Running kernel: $cur"
  ui_info "(apt autoremove already removes superseded kernels — listing remaining for visibility.)"
  dpkg --list 2>/dev/null | awk '/^ii  linux-image-[0-9]/ {print "  "$2}' || true
}

sys_drop_pagecache() {
  ui_info "Drop kernel page cache (frees buff/cache RAM, harmless)"
  if ui_confirm "Run sync && drop_caches=3?" n; then
    sudo sync
    sudo sysctl -w vm.drop_caches=3 >/dev/null
    ui_ok "page cache dropped"
  fi
}

sys_clean_tmp() {
  ui_info "/tmp size: $(dir_size /tmp)"
  if ui_confirm "Remove files in /tmp older than 7 days?" y; then
    sudo find /tmp -mindepth 1 -atime +7 -delete 2>/dev/null || true
    ui_ok "/tmp cleaned (7+ day-old files)"
  fi
}

run_system() {
  ui_section "System cleanup (sudo)"
  require_sudo || { ui_err "sudo unavailable — aborting"; return 1; }
  sys_apt_clean
  sys_journal_vacuum
  sys_old_snaps
  sys_old_kernels
  sys_clean_tmp
  sys_drop_pagecache
}
