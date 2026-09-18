#!/usr/bin/env bash
# speed.sh — "why is this machine slow?" The measuring half of --speed:
# thermal throttling, CPU / memory / IO pressure, the heaviest processes and
# boot time. Nothing here changes the system; the fixes that can be offered
# live in modules/speed_fixes.sh, ask one by one, and never run under -y.

SPEED_FINDINGS=0
SPEED_UNDO=()

# _speed_finding <text> — a problem worth the reader's attention.
_speed_finding() {
  SPEED_FINDINGS=$(( SPEED_FINDINGS + 1 ))
  ui_warn "$*"
}

# _speed_confirm <prompt> — like ui_confirm, but a change to services, login
# items or containers is never auto-accepted: under -y it is reported only.
_speed_confirm() {
  if (( ${ASSUME_YES:-0} )); then
    ui_info "  not changed under -y — run --speed without -y to decide"
    return 1
  fi
  ui_confirm "$1" n
}

# _speed_changed <what> <undo-command> — record one applied change.
_speed_changed() {
  ui_ok "$1"
  ui_info "  undo: $2"
  SPEED_UNDO+=("$1  →  undo: $2")
}

# _speed_max_of <glob-expanded files...> — largest integer held by the files.
_speed_max_of() {
  local f v max=-1
  for f in "$@"; do
    [[ -r "$f" ]] || continue
    v=$(<"$f")
    [[ "$v" =~ ^[0-9]+$ ]] || continue
    (( v > max )) && max=$v
  done
  printf '%d' "$max"
}

# _speed_throttle_events — thermal-throttle events since boot: the larger of
# the package counter and the busiest core's. Prints -1 when the CPU has none.
_speed_throttle_events() {
  local core pkg
  shopt -s nullglob
  core=$(_speed_max_of /sys/devices/system/cpu/cpu[0-9]*/thermal_throttle/core_throttle_count)
  pkg=$(_speed_max_of /sys/devices/system/cpu/cpu[0-9]*/thermal_throttle/package_throttle_count)
  shopt -u nullglob
  (( pkg < core )) && pkg=$core
  printf '%d' "$pkg"
}

speed_report_thermal() {
  ui_section "CPU temperature & throttling"
  shopt -s nullglob
  local up_s hours events live per_hour z t type hottest=0 hottest_type="" fans=() f rpm

  for z in /sys/class/thermal/thermal_zone*; do
    [[ -r "$z/temp" ]] || continue
    t=$(<"$z/temp"); [[ "$t" =~ ^[0-9]+$ ]] || continue
    type=$(<"$z/type")
    # x86_pkg_temp is the CPU package; otherwise report the hottest zone.
    if [[ "$type" == x86_pkg_temp ]]; then hottest=$t; hottest_type=$type; break; fi
    (( t > hottest )) && { hottest=$t; hottest_type=$type; }
  done
  (( hottest > 0 )) && ui_kv "Temperature now:" "$(( hottest / 1000 )) °C (${hottest_type})"

  for f in /sys/class/hwmon/hwmon*/fan*_input; do
    rpm=$(cat "$f" 2>/dev/null) || continue
    [[ "$rpm" =~ ^[0-9]+$ ]] && (( rpm > 0 )) && fans+=("${rpm} RPM")
  done
  shopt -u nullglob
  (( ${#fans[@]} )) && ui_kv "Fans now:" "${fans[*]}"

  events=$(_speed_throttle_events)
  if (( events < 0 )); then
    ui_info "No thermal-throttle counters here (not an Intel CPU, or a virtual machine)."
    return
  fi
  # The since-boot total says what happened; two readings 2 s apart say
  # whether it is happening now. An average alone cannot tell them apart.
  sleep 2
  live=$(( $(_speed_throttle_events) - events ))
  up_s=$(cut -d. -f1 /proc/uptime 2>/dev/null); up_s=${up_s:-3600}
  hours=$(( up_s / 3600 )); (( hours < 1 )) && hours=1
  per_hour=$(( events / hours ))
  ui_kv "Throttle events:" "${events} since boot ${hours}h ago (~${per_hour}/hour on average)"
  ui_kv "Right now:" "+${live} in the last 2 seconds"

  if (( per_hour > 100 || live > 0 )); then
    _speed_finding "The CPU has hit its temperature limit and slowed itself down ${events} times since boot."
    if (( live > 0 )); then
      ui_info "  It is throttling at this moment."
    else
      ui_info "  It is not throttling at this moment — the count comes from heavier periods."
    fi
    ui_info "  Under load that is a cooling problem: dust in the fans or heatsink, or dried-out thermal paste."
    ui_info "  No software setting repairs it. Fewer background programs only make it happen less often."
  elif (( events > 0 )); then
    ui_ok "Occasional throttling only — normal under heavy load."
  else
    ui_ok "No thermal throttling since boot."
  fi
}

# _speed_psi <resource> — the 60-second "some" average from /proc/pressure.
_speed_psi() {
  awk '$1 == "some" { for (i = 2; i <= NF; i++) if ($i ~ /^avg60=/) { sub("avg60=", "", $i); print $i } }' \
    "/proc/pressure/$1" 2>/dev/null
}

speed_report_pressure() {
  ui_section "Pressure — is something starved right now?"
  local r v total avail swap_t swap_f pct
  if [[ -r /proc/pressure/cpu ]]; then
    for r in cpu memory io; do
      v=$(_speed_psi "$r"); v=${v:-0}
      ui_kv "${r} wait, last minute:" "${v}%"
      if awk -v v="$v" 'BEGIN { exit !(v >= 10) }'; then
        _speed_finding "Programs spent ${v}% of the last minute waiting for ${r}."
      fi
    done
  else
    ui_info "This kernel does not expose /proc/pressure."
  fi
  total=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
  avail=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
  swap_t=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)
  swap_f=$(awk '/^SwapFree:/ {print $2}' /proc/meminfo)
  if [[ -n "$total" && -n "$avail" ]] && (( total > 0 )); then
    pct=$(( avail * 100 / total ))
    ui_kv "Memory available:" "$(bytes_pretty $(( avail * 1024 ))) of $(bytes_pretty $(( total * 1024 ))) (${pct}%)"
    ui_kv "Swap in use:" "$(bytes_pretty $(( (${swap_t:-0} - ${swap_f:-0}) * 1024 )))"
    (( pct < 10 )) && _speed_finding "Less than 10% of memory is available — the system is close to swapping."
  fi
  return 0
}

speed_report_hogs() {
  ui_section "Heaviest processes"
  ui_info "By CPU (average over each process's lifetime):"
  ps -eo pcpu,rss,comm --sort=-pcpu 2>/dev/null \
    | awk 'NR > 1 && NR <= 6 { printf "    %5s%%  %8.0f MB  %s\n", $1, $2 / 1024, $3 }'
  ui_info "By memory:"
  ps -eo rss,pcpu,comm --sort=-rss 2>/dev/null \
    | awk 'NR > 1 && NR <= 6 { printf "    %8.0f MB  %5s%%  %s\n", $1 / 1024, $2, $3 }'
}

speed_report_boot() {
  ui_section "Boot time"
  if ! command -v systemd-analyze >/dev/null 2>&1; then
    ui_info "systemd-analyze not available — skipped."
    return
  fi
  systemd-analyze time 2>/dev/null | sed 's/^/  /'
  ui_info "Longest-running units at the last boot:"
  systemd-analyze blame --no-pager 2>/dev/null | awk 'NR <= 8 { print "   " $0 }'
  ui_info "  (a unit can run long after login without delaying it; the firmware figure is set in the BIOS)"
}

run_speed() {
  SPEED_FINDINGS=0
  SPEED_UNDO=()
  ui_box "Speed check" "Measures why this machine is slow. Every fix asks first and prints its undo. Nothing is deleted."
  speed_report_thermal
  speed_report_pressure
  speed_report_hogs
  speed_report_boot
  speed_check_docker
  speed_check_services
  speed_check_autostart

  ui_section "Speed check — summary"
  if (( SPEED_FINDINGS == 0 )); then
    ui_ok "Nothing found that slows this machine down."
  else
    ui_info "${SPEED_FINDINGS} finding(s) above."
  fi
  if (( ${#SPEED_UNDO[@]} )); then
    ui_info "Changes made in this run:"
    printf '    · %s\n' "${SPEED_UNDO[@]}"
    ui_info "They are also in the log: $LOG_FILE"
  else
    ui_info "No changes were made."
  fi
}
