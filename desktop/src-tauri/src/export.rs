//! `export_json`: "Download my data" writes a JSON file to ~/Downloads.

use std::io::{ErrorKind, Write};
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::error::{AppError, AppResult};

/// Largest export accepted.
const MAX_BYTES: usize = 5 * 1024 * 1024;
/// Longest file name kept after sanitising.
const MAX_NAME: usize = 120;

/// Payload of `export_json`.
#[derive(Debug, Serialize)]
pub struct ExportResult {
    path: String,
}

/// Keeps `[A-Za-z0-9._-]`, replaces everything else with `_`, drops leading dots,
/// and requires the name to end in `.json`.
pub fn sanitise_filename(raw: &str) -> AppResult<String> {
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let cleaned = cleaned.trim_start_matches('.');
    let stem_ok = cleaned
        .strip_suffix(".json")
        .is_some_and(|stem| !stem.is_empty() && stem.chars().any(|c| c.is_ascii_alphanumeric()));
    if !stem_ok || cleaned.len() > MAX_NAME {
        return Err(AppError::invalid(
            "the file name must be a short name ending in .json",
        ));
    }
    Ok(cleaned.to_owned())
}

/// Writes `content` to a new file in `dir` with mode 600, never replacing an existing
/// file or following a symlink: a taken name gets `-1`, `-2`, … before `.json`.
pub fn write_new(dir: &Path, name: &str, content: &[u8]) -> AppResult<PathBuf> {
    let stem = name.strip_suffix(".json").unwrap_or(name);
    for attempt in 0..100 {
        let candidate = if attempt == 0 {
            dir.join(name)
        } else {
            dir.join(format!("{stem}-{attempt}.json"))
        };
        let opened = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&candidate);
        match opened {
            Ok(mut file) => {
                file.write_all(content)?;
                file.sync_all()?;
                return Ok(candidate);
            }
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
    Err(AppError::Io(
        "too many files with that name in Downloads".into(),
    ))
}

/// Saves the export to ~/Downloads, reveals it in the file manager and returns its path.
#[tauri::command]
pub async fn export_json(
    app: AppHandle,
    filename: String,
    content: String,
) -> AppResult<ExportResult> {
    let name = sanitise_filename(&filename)?;
    if content.len() > MAX_BYTES {
        return Err(AppError::invalid("the export is larger than 5 MB"));
    }
    serde_json::from_str::<serde::de::IgnoredAny>(&content)
        .map_err(|_| AppError::invalid("the export is not valid JSON"))?;
    let dir = app.path().download_dir()?;
    let path =
        tauri::async_runtime::spawn_blocking(move || write_new(&dir, &name, content.as_bytes()))
            .await
            .map_err(|e| AppError::Io(format!("writing the export failed: {e}")))??;
    if let Err(error) = app.opener().reveal_item_in_dir(&path) {
        log::warn!("revealing the export failed: {error}");
    }
    Ok(ExportResult {
        path: path.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn sanitises_names() {
        assert_eq!(
            sanitise_filename("linux-cleanup data 2026.json").ok(),
            Some("linux-cleanup_data_2026.json".into())
        );
        assert_eq!(
            sanitise_filename("../../etc/passwd.json").ok(),
            Some("_.._etc_passwd.json".into())
        );
        assert!(sanitise_filename("export.txt").is_err());
        assert!(sanitise_filename(".json").is_err());
        assert!(sanitise_filename("___.json").is_err());
        assert!(sanitise_filename(&format!("{}.json", "a".repeat(200))).is_err());
    }

    #[test]
    fn writes_mode_600_and_never_overwrites() {
        let dir = std::env::temp_dir().join(format!("linux-cleanup-export-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).ok();
        let first = write_new(&dir, "data.json", b"{}").ok();
        let second = write_new(&dir, "data.json", b"[]").ok();
        assert_eq!(first, Some(dir.join("data.json")));
        assert_eq!(second, Some(dir.join("data-1.json")));
        let mode = std::fs::metadata(dir.join("data.json"))
            .map(|m| m.permissions().mode() & 0o777)
            .ok();
        assert_eq!(mode, Some(0o600));
        assert_eq!(
            std::fs::read_to_string(dir.join("data.json")).ok(),
            Some("{}".into())
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
