//! Local reports and logs under `~/.linux-cleanup`, and opening them safely.

use std::path::Path;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::error::{AppError, AppResult};
use crate::paths;

/// Most entries one `list_local_history` call returns.
const MAX_LIMIT: u32 = 500;

/// File types `open_path` hands to their default app. Anything else, such as a
/// `.sh` or `.desktop` file, could execute, so it can only be revealed in the file manager.
const OPENABLE: [&str; 6] = ["txt", "log", "md", "json", "csv", "tsv"];

/// One report or log file.
#[derive(Debug, Serialize)]
pub struct HistoryEntry {
    file: String,
    kind: &'static str,
    modified_ms: u64,
    size_bytes: u64,
}

/// Lists regular files directly inside `dir`, tagged with `kind`. Symlinks are skipped.
fn scan(dir: &Path, kind: &'static str, out: &mut Vec<HistoryEntry>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(meta) = entry.path().symlink_metadata() else {
            continue;
        };
        if !meta.is_file() || entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
            .unwrap_or(0);
        out.push(HistoryEntry {
            file: entry.path().to_string_lossy().into_owned(),
            kind,
            modified_ms,
            size_bytes: meta.len(),
        });
    }
}

/// Collects reports and logs under `root`, newest first, at most `limit` entries.
pub fn collect(root: &Path, limit: u32) -> Vec<HistoryEntry> {
    let mut out = Vec::new();
    scan(&root.join("reports"), "report", &mut out);
    scan(&root.join("logs"), "log", &mut out);
    out.sort_by(|a, b| {
        b.modified_ms
            .cmp(&a.modified_ms)
            .then_with(|| a.file.cmp(&b.file))
    });
    out.truncate(usize::try_from(limit.clamp(1, MAX_LIMIT)).unwrap_or(1));
    out
}

/// Lists `~/.linux-cleanup/{reports,logs}`, newest first.
#[tauri::command]
pub async fn list_local_history(app: AppHandle, limit: u32) -> AppResult<Vec<HistoryEntry>> {
    let root = paths::data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || collect(&root, limit))
        .await
        .map_err(|e| AppError::Io(format!("listing history failed: {e}")))
}

/// Opens a report, log or folder inside `~/.linux-cleanup` with its default app.
#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> AppResult<()> {
    let real = paths::restrict_to(&paths::data_dir(&app)?, &path)?;
    let extension = real
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    if !real.is_dir() && !OPENABLE.contains(&extension.as_str()) {
        return Err(AppError::denied(
            "only reports, logs and folders can be opened; use Reveal instead",
        ));
    }
    app.opener()
        .open_path(real.to_string_lossy(), None::<&str>)
        .map_err(|e| AppError::Io(format!("could not open the file: {e}")))
}

/// Shows a file or folder inside `~/.linux-cleanup` in the file manager.
#[tauri::command]
pub fn reveal_path(app: AppHandle, path: String) -> AppResult<()> {
    let real = paths::restrict_to(&paths::data_dir(&app)?, &path)?;
    app.opener()
        .reveal_item_in_dir(real)
        .map_err(|e| AppError::Io(format!("could not reveal the file: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collects_newest_first_and_skips_links_and_dotfiles() {
        let root =
            std::env::temp_dir().join(format!("linux-cleanup-history-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("reports")).ok();
        std::fs::create_dir_all(root.join("logs")).ok();
        std::fs::write(root.join("logs/old.log"), "a").ok();
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(root.join("reports/new.txt"), "bb").ok();
        std::fs::write(root.join("reports/.hidden"), "c").ok();
        std::os::unix::fs::symlink("/etc/hosts", root.join("reports/link.txt")).ok();

        let entries = collect(&root, 10);
        let names: Vec<_> = entries.iter().map(|e| (e.kind, e.size_bytes)).collect();
        assert_eq!(names, [("report", 2), ("log", 1)]);
        assert_eq!(collect(&root, 1).len(), 1);
        let _ = std::fs::remove_dir_all(&root);
    }
}
