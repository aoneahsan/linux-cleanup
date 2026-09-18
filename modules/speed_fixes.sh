#!/usr/bin/env bash
# speed_fixes.sh — the things --speed can change, all reversible, none of them
# a delete: containers that restart at boot, servers that start at boot, and
# apps that start at login. Each asks first (_speed_confirm: never under -y)
# and records its undo command (_speed_changed). See modules/speed.sh.

# Servers a developer machine often carries that do not need to run all day.
# Deliberately short: databases, web servers, message brokers, VM stacks.
SPEED_SERVICE_UNITS=(
  apache2 httpd nginx mysql mariadb postgresql mongod redis-server redis
  memcached elasticsearch rabbitmq-server libvirtd libvirt-guests qemu-kvm
)

_speed_unit_enabled() { [[ "$(systemctl is-enabled "$1" 2>/dev/null)" == enabled ]]; }

# ── Docker ──────────────────────────────────────────────────────────────────

_speed_docker_desktop() {
  local img="$HOME/.docker/desktop/vms/0/data/Docker.raw" have=0
  [[ -f "$img" ]] && have=1
  command -v dpkg >/dev/null 2>&1 && dpkg -s docker-desktop >/dev/null 2>&1 && have=1
  (( have )) || return 0
  command -v dockerd >/dev/null 2>&1 || return 0
  _speed_finding "Docker Desktop is installed next to the native Docker engine — two Dockers, one of them a VM."
  [[ -f "$img" ]] && ui_info "  its VM disk: $(dir_size "$img"), last used $(newest_access_age_days "$img")d ago"
  ui_info "  To remove it (its containers and images go with it): sudo apt remove docker-desktop && rm -rf ~/.docker/desktop"
}

speed_check_docker() {
  ui_section "Docker"
  if ! command -v docker >/dev/null 2>&1; then
    ui_info "Docker — not installed."
    return
  fi
  _speed_docker_desktop
  local at_boot=0
  _speed_unit_enabled docker.service && at_boot=1

  # Containers are inspected only when the daemon is already up: a check must
  # not start a Docker the user keeps on demand.
  if _docker_ready >/dev/null 2>&1; then
    local id name state policy auto_ids=() running_ids=() rows=""
    while read -r id name state; do
      [[ -z "$id" ]] && continue
      policy=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$id" 2>/dev/null)
      [[ "$policy" == always || "$policy" == unless-stopped ]] || continue
      auto_ids+=("$id")
      [[ "$state" == running ]] && running_ids+=("$id")
      rows+="    ${name}  (${state}, restart=${policy})"$'\n'
    done < <(docker ps -a --format '{{.ID}} {{.Names}} {{.State}}' 2>/dev/null)

    if (( ${#auto_ids[@]} )); then
      _speed_finding "${#auto_ids[@]} container(s) start themselves at every boot (${#running_ids[@]} running now):"
      printf '%s' "$rows"
      if _speed_confirm "Set restart=no on these ${#auto_ids[@]} and stop the running ones? Nothing is deleted — 'docker start <name>' brings one back."; then
        docker update --restart=no "${auto_ids[@]}" >/dev/null 2>&1
        (( ${#running_ids[@]} )) && docker stop "${running_ids[@]}" >/dev/null 2>&1
        _speed_changed "${#auto_ids[@]} container(s) no longer start at boot" "docker update --restart=unless-stopped <name> && docker start <name>"
        ui_info "  A compose file that says 'restart: always' sets it again on the next 'compose up' — change it there too."
      fi
    else
      ui_ok "No container restarts itself at boot."
    fi
  else
    ui_info "Docker daemon is not running — containers not inspected."
  fi

  if (( at_boot )); then
    _speed_finding "The Docker daemon starts at every boot, used or not."
    if [[ -n "$(systemctl list-unit-files docker.socket --no-legend 2>/dev/null)" ]] \
       && _speed_confirm "Start Docker only when a docker command runs (keeps docker.socket, disables docker.service + containerd at boot)?"; then
      require_sudo || return 0
      sudo systemctl disable docker.service containerd.service >/dev/null 2>&1
      sudo systemctl enable docker.socket >/dev/null 2>&1
      _speed_changed "Docker starts on demand from the next boot" "sudo systemctl enable docker.service containerd.service"
    fi
  else
    ui_ok "The Docker daemon does not start at boot."
  fi
}

# ── Servers at boot ─────────────────────────────────────────────────────────

speed_check_services() {
  ui_section "Servers that start at every boot"
  if ! command -v systemctl >/dev/null 2>&1; then
    ui_info "systemd not found — skipped."
    return
  fi
  local u units=() enabled=() mem state
  for u in "${SPEED_SERVICE_UNITS[@]}"; do units+=("$u.service"); done
  while read -r u _; do
    [[ -n "$u" ]] && units+=("$u")
  done < <(systemctl list-unit-files 'php*-fpm.service' --no-legend 2>/dev/null)
  for u in "${units[@]}"; do
    _speed_unit_enabled "$u" && enabled+=("$u")
  done

  if (( ${#enabled[@]} == 0 )); then
    ui_ok "No database, web server or VM stack starts at boot."
  else
    _speed_finding "${#enabled[@]} server(s) start at every boot, whether or not you use them that day:"
    for u in "${enabled[@]}"; do
      state=$(systemctl is-active "$u" 2>/dev/null)
      mem=$(systemctl show -p MemoryCurrent --value "$u" 2>/dev/null)
      if [[ "$mem" =~ ^[0-9]+$ ]]; then mem="$(bytes_pretty "$mem")"; else mem="—"; fi
      printf '    %-28s %-9s %s\n' "$u" "$state" "$mem"
    done
    for u in "${enabled[@]}"; do
      if _speed_confirm "Run ${u%.service} only when you start it (sudo systemctl disable --now $u)?"; then
        require_sudo || return 0
        if sudo systemctl disable --now "$u" >/dev/null 2>&1; then
          _speed_changed "$u no longer starts at boot (start it with: sudo systemctl start $u)" "sudo systemctl enable --now $u"
        else
          ui_err "could not disable $u"
        fi
      fi
    done
  fi

  # cloud-init configures cloud VMs on first boot; on a laptop or desktop it
  # only costs boot time. Its own documented off switch is a marker file.
  if [[ -d /etc/cloud && ! -e /etc/cloud/cloud-init.disabled ]] \
     && _speed_unit_enabled cloud-init.service \
     && [[ "$(systemd-detect-virt 2>/dev/null)" == none ]]; then
    _speed_finding "cloud-init runs at every boot, and this is not a cloud VM."
    if _speed_confirm "Switch cloud-init off with its marker file (sudo touch /etc/cloud/cloud-init.disabled)?"; then
      require_sudo || return 0
      sudo touch /etc/cloud/cloud-init.disabled \
        && _speed_changed "cloud-init is off from the next boot" "sudo rm /etc/cloud/cloud-init.disabled"
    fi
  fi
}

# ── Apps at login ───────────────────────────────────────────────────────────

# Off already, or handed to a systemd user unit (X-GNOME-HiddenUnderSystemd):
# either way the desktop entry starts nothing.
_desktop_disabled() {
  grep -qiE '^(Hidden=true|X-GNOME-Autostart-enabled=false|X-GNOME-HiddenUnderSystemd=true)' "$1" 2>/dev/null
}
_desktop_name()     { awk -F= '/^Name=/ { print $2; exit }' "$1" 2>/dev/null; }

# _autostart_disable <source.desktop> — writes Hidden=true into the user's own
# copy, inside the [Desktop Entry] group. A system entry is copied first: the
# file under /etc is never edited.
_autostart_disable() {
  local src="$1" udir dst
  udir="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
  dst="$udir/$(basename -- "$src")"
  mkdir -p "$udir" || return 1
  [[ "$src" == "$dst" ]] || cp -- "$src" "$dst" || return 1
  sed -i -e '/^Hidden=/d' -e '0,/^\[Desktop Entry\]/s/^\[Desktop Entry\]/[Desktop Entry]\nHidden=true/' "$dst"
  _desktop_disabled "$dst"
}

# GNOME Software is started by the desktop's search box as well as at login,
# then keeps the package service refreshing. Both switches are its own settings.
_speed_gnome_software() {
  command -v gsettings >/dev/null 2>&1 || return 0
  local dl sp new entry=org.gnome.Software.desktop udir at_login=0
  dl=$(gsettings get org.gnome.software download-updates 2>/dev/null) || return 0
  sp=$(gsettings get org.gnome.desktop.search-providers disabled 2>/dev/null)
  udir="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
  # Its login entry is live unless a user copy switches it off.
  if [[ -f "/etc/xdg/autostart/$entry" ]] && ! _desktop_disabled "$udir/$entry"; then at_login=1; fi
  if (( ! at_login )) && [[ "$dl" != true && "$sp" == *"'$entry'"* ]]; then
    ui_ok "GNOME Software: not started at login or by desktop search, no background downloads."
    return 0
  fi
  _speed_finding "GNOME Software works in the background: it starts at login or from desktop search, then keeps the package service busy."
  if _speed_confirm "Make it on-demand (it still opens normally from the app grid)?"; then
    (( at_login )) && _autostart_disable "/etc/xdg/autostart/$entry"
    gsettings set org.gnome.software download-updates false
    gsettings set org.gnome.software download-updates-notify false 2>/dev/null
    if [[ "$sp" != *"'org.gnome.Software.desktop'"* ]]; then
      if [[ "$sp" == "@as []" || "$sp" == "[]" || -z "$sp" ]]; then
        new="['org.gnome.Software.desktop']"
      else
        new="${sp%]}, 'org.gnome.Software.desktop']"
      fi
      gsettings set org.gnome.desktop.search-providers disabled "$new"
    fi
    pgrep -x gnome-software >/dev/null 2>&1 && gnome-software --quit >/dev/null 2>&1
    _speed_changed "GNOME Software is on-demand" "rm -f '$udir/$entry'; gsettings reset org.gnome.software download-updates; gsettings reset org.gnome.desktop.search-providers disabled"
  fi
}

speed_check_autostart() {
  ui_section "Apps that start when you log in"
  # The user's own autostart folder holds what apps and installers added
  # (downloaders, chat clients, sync tools). The desktop's own session
  # services under /etc/xdg/autostart are not offered — only GNOME Software,
  # below, which is a known background worker.
  local udir f name cands=()
  udir="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
  shopt -s nullglob
  for f in "$udir"/*.desktop; do
    _desktop_disabled "$f" || cands+=("$f")
  done
  shopt -u nullglob

  if (( ${#cands[@]} == 0 )); then
    ui_ok "No app you or an installer added starts at login."
  else
    _speed_finding "${#cands[@]} app(s) start at every login:"
    for f in "${cands[@]}"; do printf '    %s  (%s)\n' "$(_desktop_name "$f")" "$f"; done
    for f in "${cands[@]}"; do
      name="$(_desktop_name "$f")"
      if _speed_confirm "Stop '${name:-$(basename "$f")}' starting at login? The app stays installed."; then
        if _autostart_disable "$f"; then
          _speed_changed "'${name}' no longer starts at login" "sed -i 's/^Hidden=true/Hidden=false/' '$f'"
        else
          ui_err "could not write $udir/$(basename "$f")"
        fi
      fi
    done
  fi
  _speed_gnome_software
}
