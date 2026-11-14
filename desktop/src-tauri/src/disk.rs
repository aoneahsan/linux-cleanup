//! Machine facts: `system_info` and `disk_status`.

use std::ffi::CString;
use std::os::unix::fs::OpenOptionsExt;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::error::{AppError, AppResult};
use crate::paths;

/// Payload of `system_info`.
#[derive(Serialize)]
pub struct SystemInfo {
    /// The distribution's `PRETTY_NAME` from `/etc/os-release`, e.g. "Ubuntu 24.04.1 LTS".
    os_version: String,
    arch: String,
    ram_bytes: u64,
    device_id: String,
}

/// Payload of `disk_status`. Linux has no purgeable space or local snapshots to report,
/// so those two stay `null` / `0`; the shape matches the CLI's `disk` event.
#[derive(Serialize)]
pub struct DiskStatus {
    total_kb: u64,
    free_kb: u64,
    purgeable_kb: Option<u64>,
    snapshots: u32,
}

/// Reports the distribution, CPU architecture, RAM and this install's device id.
#[tauri::command]
pub async fn system_info(app: AppHandle) -> AppResult<SystemInfo> {
    let os_version = std::fs::read_to_string("/etc/os-release")
        .ok()
        .and_then(|text| pretty_name(&text))
        .unwrap_or_else(|| "Linux".to_owned());
    Ok(SystemInfo {
        os_version,
        arch: std::env::consts::ARCH.to_owned(),
        ram_bytes: ram_bytes(),
        device_id: device_id(&app)?,
    })
}

/// `PRETTY_NAME` (or `NAME` + `VERSION_ID`) from an os-release file, clipped to 40 characters
/// so it fits the server's `os_version` check.
pub fn pretty_name(text: &str) -> Option<String> {
    let field = |key: &str| {
        text.lines().find_map(|line| {
            let value = line.strip_prefix(key)?.strip_prefix('=')?;
            let value = value.trim().trim_matches('"').trim_matches('\'');
            (!value.is_empty()).then(|| value.to_owned())
        })
    };
    let name = field("PRETTY_NAME").or_else(|| {
        let base = field("NAME")?;
        Some(match field("VERSION_ID") {
            Some(v) => format!("{base} {v}"),
            None => base,
        })
    })?;
    Some(name.chars().take(40).collect())
}

/// Physical memory from `sysinfo(2)`; 0 when the kernel does not answer.
fn ram_bytes() -> u64 {
    // SAFETY: sysinfo fills a zeroed, correctly sized struct.
    let mut info: libc::sysinfo = unsafe { std::mem::zeroed() };
    let rc = unsafe { libc::sysinfo(&mut info) };
    if rc == 0 {
        info.totalram.saturating_mul(u64::from(info.mem_unit))
    } else {
        0
    }
}

/// The random UUID that identifies this install, created once in the app data dir.
fn device_id<R: Runtime>(app: &AppHandle<R>) -> AppResult<String> {
    let dir = app.path().app_data_dir()?;
    let file = dir.join("device-id");
    if let Ok(existing) = std::fs::read_to_string(&file)
        && let Ok(id) = uuid::Uuid::parse_str(existing.trim())
    {
        return Ok(id.to_string());
    }
    std::fs::create_dir_all(&dir)?;
    let id = uuid::Uuid::new_v4().to_string();
    let temp = dir.join("device-id.tmp");
    {
        use std::io::Write;
        let mut handle = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&temp)?;
        handle.write_all(id.as_bytes())?;
    }
    std::fs::rename(&temp, &file)?;
    Ok(id)
}

/// Total and available space of the volume holding the home folder (what the CLI cleans).
#[tauri::command]
pub async fn disk_status(app: AppHandle) -> AppResult<DiskStatus> {
    let home = paths::home_dir(&app)?;
    let (total_kb, free_kb) = statvfs_kb(&home.to_string_lossy())?;
    Ok(DiskStatus {
        total_kb,
        free_kb,
        purgeable_kb: None,
        snapshots: 0,
    })
}

/// Total and available kilobytes of the volume holding `path`.
fn statvfs_kb(path: &str) -> AppResult<(u64, u64)> {
    let c_path = CString::new(path).map_err(|_| AppError::invalid("bad path"))?;
    // SAFETY: statvfs fills a zeroed, correctly sized struct for a valid C path.
    let mut stats: libc::statvfs = unsafe { std::mem::zeroed() };
    let rc = unsafe { libc::statvfs(c_path.as_ptr(), &mut stats) };
    if rc != 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    let block = stats.f_frsize;
    Ok((
        stats.f_blocks.saturating_mul(block) / 1024,
        stats.f_bavail.saturating_mul(block) / 1024,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_pretty_name_or_falls_back() {
        assert_eq!(
            pretty_name("NAME=\"Ubuntu\"\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\n").as_deref(),
            Some("Ubuntu 24.04.1 LTS")
        );
        assert_eq!(
            pretty_name("NAME=Fedora\nVERSION_ID=41\n").as_deref(),
            Some("Fedora 41")
        );
        assert_eq!(pretty_name("ID=x\n"), None);
        assert_eq!(
            pretty_name(&format!("PRETTY_NAME={}", "a".repeat(60))).map(|s| s.len()),
            Some(40)
        );
    }

    #[test]
    fn root_volume_has_space() {
        let (total, free) = statvfs_kb("/").unwrap_or((0, 0));
        assert!(total > 0 && free <= total);
    }
}
