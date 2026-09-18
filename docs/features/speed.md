# Speed check (`--speed`)

> Measures why a machine is slow, then offers a small set of undoable fixes for the things that start by themselves: Docker containers, database / web / VM services, and login items. It deletes nothing.

**Type**: inspection + repair mode (interactive)
**Run**: `linux-cleanup --speed`
**Touches personal data**: no
**Under `-y`**: report only — no fix is ever auto-accepted
**Needs `sudo`**: only if you accept a systemd or cloud-init change

---

## What it measures (always, read-only)

| Section | Source | What a finding means |
|---|---|---|
| CPU temperature & throttling | `/sys/devices/system/cpu/cpu*/thermal_throttle/*_count`, thermal zones, hwmon fan speeds, plus two readings 2 seconds apart | The CPU reached its temperature limit and slowed itself down. Reported when the since-boot average passes 100 events an hour, or when it is throttling at that moment. |
| Pressure | `/proc/pressure/{cpu,memory,io}` (60-second average), `MemAvailable`, swap | Programs spent 10% or more of the last minute waiting for that resource, or under 10% of memory is available. |
| Heaviest processes | `ps`, top five by CPU and by memory | Informational. CPU is the average over each process's lifetime. |
| Boot time | `systemd-analyze time` and `blame` | Informational. A unit can run long after login without delaying it, and the firmware figure is set in the BIOS. |

**About throttling.** On a laptop under load, steady throttling is a cooling problem — dust in the fans or heatsink, or dried-out thermal paste. No software setting repairs that. Removing background load only makes it happen less often, and that is what the fixes below are for.

---

## What it can change (asked one by one)

Every change prints its undo command. All of them are listed again at the end of the run and written to the session log.

| Finding | Offered change | Undo |
|---|---|---|
| Containers with restart policy `always` or `unless-stopped` | `docker update --restart=no` on them, `docker stop` on the running ones. Containers, images and volumes are kept. | `docker update --restart=unless-stopped <name> && docker start <name>` |
| `docker.service` enabled at boot | Disable `docker.service` and `containerd.service` at boot and keep `docker.socket`, so the daemon starts when a `docker` command runs. The running daemon is left alone. | `sudo systemctl enable docker.service containerd.service` |
| Docker Desktop installed next to the native engine | Nothing — it prints the VM disk size, its idle days and the removal command. | — |
| A listed server enabled at boot | `sudo systemctl disable --now <unit>` | `sudo systemctl enable --now <unit>` |
| cloud-init enabled on a machine that is not a VM | `sudo touch /etc/cloud/cloud-init.disabled` (cloud-init's own off switch) | `sudo rm /etc/cloud/cloud-init.disabled` |
| A live entry in `~/.config/autostart` | `Hidden=true` inside that entry's `[Desktop Entry]` group | `sed -i 's/^Hidden=true/Hidden=false/' <file>` |
| GNOME Software working in the background | A `Hidden=true` user copy of its login entry, `download-updates false`, and removing it from the desktop's search providers. It still opens from the app grid. | `rm ~/.config/autostart/org.gnome.Software.desktop; gsettings reset org.gnome.software download-updates; gsettings reset org.gnome.desktop.search-providers disabled` |

The server list is fixed and short: `apache2`, `httpd`, `nginx`, `mysql`, `mariadb`, `postgresql`, `mongod`, `redis-server`, `redis`, `memcached`, `elasticsearch`, `rabbitmq-server`, `libvirtd`, `libvirt-guests`, `qemu-kvm` and any `php*-fpm`. Only units whose state is exactly `enabled` are listed.

---

## What it will NOT do

- It never deletes a container, image, volume, package or file.
- It never starts Docker. If the daemon is asleep (socket-activated), containers are not inspected.
- It never edits a file under `/etc/xdg/autostart`. A system login item is switched off by a copy in your own `~/.config/autostart`.
- It does not offer the desktop's own session services, or entries handed to systemd (`X-GNOME-HiddenUnderSystemd=true`).
- It does not tune the kernel, the CPU governor, swap or the fans.
- It applies nothing under `-y`, including in cron.

---

## When to use it

- The machine got slow over months and freeing disk space changed nothing.
- After installing a local database, a web stack or Docker Compose projects "just to try".
- Before blaming the hardware — and to find out when the hardware is in fact the cause.

---

## See also

- [System cleanup](./system-cleanup.md) — the `sudo` cleanup steps
- [Doctor](./doctor.md) — shell-init repair
- [Safety](../safety.md) — what the tool refuses to touch

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-09-18 · **Tool version**: 1.6.0
