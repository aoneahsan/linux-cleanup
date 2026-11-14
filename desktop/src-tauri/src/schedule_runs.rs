//! Scheduled runs report back: the NDJSON streams systemd user timers write to
//! `~/.linux-cleanup/schedule-runs/<scheduleId>-<epochSeconds>.ndjson` (folder 700, file 600).
//!
//! The app lists unread streams, reads one, and acks it (renamed to `.ndjson.done`)
//! once it has become a receipt, so each run is ingested once.

use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Runtime};

use crate::error::{AppError, AppResult};
use crate::paths;

/// Largest stream `read_schedule_run` returns.
const MAX_BYTES: u64 = 5 * 1024 * 1024;
/// Most unread runs one `list_schedule_runs` call returns.
const MAX_LISTED: usize = 50;
const UNREAD_SUFFIX: &str = ".ndjson";

/// One unread scheduled run (camelCase on the wire, per the contract).
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRun {
    file: String,
    schedule_id: String,
    started_ms: u64,
    size_bytes: u64,
}

/// `~/.linux-cleanup/schedule-runs`.
pub fn runs_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(paths::data_dir(app)?.join("schedule-runs"))
}

/// Creates the runs folder if needed and keeps it private (700).
pub fn ensure_runs_dir(dir: &Path) -> AppResult<()> {
    std::fs::create_dir_all(dir)?;
    std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
    Ok(())
}

/// The shell program that wraps one scheduled run. Every value it uses arrives as a
/// positional argument (`$0` script, `$1` runs folder, `$2` schedule id), so nothing
/// from a spec is ever spliced into the program text.
const RUN_WRAPPER: &str = "umask 077; d=\"$1\"; id=\"$2\"; shift 2; \
mkdir -p \"$d\" && chmod 700 \"$d\" || exit 1; \
exec /bin/bash \"$0\" \"$@\" > \"$d/$id-$(date +%s).ndjson\"";

/// The scheduled service argv: `/bin/sh -c <wrapper> <script> <runs dir> <id> <cli args…>`.
/// The CLI's NDJSON stdout lands in `<runs dir>/<id>-<epochSeconds>.ndjson`, mode 600.
pub fn program_args(
    id: &str,
    script: &Path,
    runs_dir: &Path,
    cli_args: Vec<String>,
) -> Vec<String> {
    let mut argv = vec![
        "/bin/sh".to_owned(),
        "-c".to_owned(),
        RUN_WRAPPER.to_owned(),
        script.to_string_lossy().into_owned(),
        runs_dir.to_string_lossy().into_owned(),
        id.to_owned(),
    ];
    argv.extend(cli_args);
    argv
}

/// Splits an unread run file name into `(scheduleId, epochSeconds)`.
///
/// The id is `[A-Za-z0-9-]{1,64}` and may itself contain dashes, so the epoch is
/// the part after the last dash. Acked (`.ndjson.done`) and other names give `None`.
pub fn parse_run_name(name: &str) -> Option<(String, u64)> {
    let stem = name.strip_suffix(UNREAD_SUFFIX)?;
    let (id, epoch) = stem.rsplit_once('-')?;
    let id_ok = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    let epoch_ok =
        !epoch.is_empty() && epoch.len() <= 12 && epoch.bytes().all(|b| b.is_ascii_digit());
    if !(id_ok && epoch_ok) {
        return None;
    }
    Some((id.to_owned(), epoch.parse().ok()?))
}

/// Unread runs in `dir`, oldest first, at most 50. Symlinks and odd names are skipped.
pub fn collect_runs(dir: &Path) -> Vec<ScheduleRun> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut runs: Vec<ScheduleRun> = entries
        .flatten()
        .filter_map(|entry| {
            let meta = entry.path().symlink_metadata().ok()?;
            if !meta.is_file() {
                return None;
            }
            let (schedule_id, epoch) = parse_run_name(&entry.file_name().to_string_lossy())?;
            Some(ScheduleRun {
                file: entry.path().to_string_lossy().into_owned(),
                schedule_id,
                started_ms: epoch.saturating_mul(1000),
                size_bytes: meta.len(),
            })
        })
        .collect();
    runs.sort_by(|a, b| {
        a.started_ms
            .cmp(&b.started_ms)
            .then_with(|| a.file.cmp(&b.file))
    });
    runs.truncate(MAX_LISTED);
    runs
}

/// Accepts `requested` only as an unread run file directly inside `dir`: a regular
/// file (never a symlink), whose canonical parent is the canonical runs folder.
pub fn confine(dir: &Path, requested: &str) -> AppResult<PathBuf> {
    let requested = Path::new(requested);
    if !requested.is_absolute() {
        return Err(AppError::invalid("the run file path must be absolute"));
    }
    let name = requested
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    if parse_run_name(&name).is_none() {
        return Err(AppError::denied("not a scheduled-run file"));
    }
    let meta = requested
        .symlink_metadata()
        .map_err(|_| AppError::NotFound("that run file no longer exists".into()))?;
    if !meta.is_file() {
        return Err(AppError::denied(
            "run files must be regular files, not links",
        ));
    }
    let root = dir
        .canonicalize()
        .map_err(|_| AppError::NotFound("no scheduled runs yet".into()))?;
    let real = requested.canonicalize()?;
    if real.parent() != Some(root.as_path()) {
        return Err(AppError::denied(
            "only files in ~/.linux-cleanup/schedule-runs can be read",
        ));
    }
    Ok(real)
}

/// Reads a confined run file as non-empty lines, refusing anything over 5 MB.
pub fn read_lines(path: &Path) -> AppResult<Vec<String>> {
    let size = std::fs::metadata(path)?.len();
    if size > MAX_BYTES {
        return Err(AppError::invalid("the run file is larger than 5 MB"));
    }
    let bytes = std::fs::read(path)?;
    Ok(String::from_utf8_lossy(&bytes)
        .lines()
        .map(str::trim_end)
        .filter(|line| !line.is_empty())
        .map(str::to_owned)
        .collect())
}

/// Renames a confined run file to `<name>.done` so it is never listed again.
pub fn ack(dir: &Path, requested: &str) -> AppResult<()> {
    let real = confine(dir, requested)?;
    let mut done = real.clone().into_os_string();
    done.push(".done");
    std::fs::rename(&real, PathBuf::from(done))?;
    Ok(())
}

async fn blocking<T: Send + 'static>(
    job: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|e| AppError::Io(format!("background read failed: {e}")))?
}

/// Lists unread scheduled-run streams, oldest first, at most 50.
#[tauri::command]
pub async fn list_schedule_runs(app: AppHandle) -> AppResult<Vec<ScheduleRun>> {
    let dir = runs_dir(&app)?;
    blocking(move || Ok(collect_runs(&dir))).await
}

/// Returns the NDJSON lines of one unread run (inside the runs folder, at most 5 MB).
#[tauri::command]
pub async fn read_schedule_run(app: AppHandle, file: String) -> AppResult<Vec<String>> {
    let dir = runs_dir(&app)?;
    blocking(move || read_lines(&confine(&dir, &file)?)).await
}

/// Marks a run as ingested by renaming it to `.ndjson.done`.
#[tauri::command]
pub async fn ack_schedule_run(app: AppHandle, file: String) -> AppResult<()> {
    let dir = runs_dir(&app)?;
    blocking(move || ack(&dir, &file)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_run_names_with_dashed_ids() {
        assert_eq!(
            parse_run_name("weekly-1-1793344648.ndjson"),
            Some(("weekly-1".into(), 1_793_344_648))
        );
        assert_eq!(parse_run_name("abc-1.ndjson"), Some(("abc".into(), 1)));
        assert_eq!(parse_run_name("weekly-1-1793344648.ndjson.done"), None);
        assert_eq!(parse_run_name("-1793344648.ndjson"), None);
        assert_eq!(parse_run_name("weekly-.ndjson"), None);
        assert_eq!(parse_run_name("we ekly-17.ndjson"), None);
        assert_eq!(parse_run_name("x-17.json"), None);
    }

    #[test]
    fn lists_confines_reads_and_acks() {
        let base = std::env::temp_dir().join(format!("linux-cleanup-runs-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        let dir = base.join("schedule-runs");
        ensure_runs_dir(&dir).ok();
        std::fs::create_dir_all(base.join("elsewhere")).ok();
        std::fs::write(dir.join("b-20.ndjson"), "{\"v\":1}\n\n{\"v\":2}\n").ok();
        std::fs::write(dir.join("a-10.ndjson"), "{}\n").ok();
        std::fs::write(dir.join("a-5.ndjson.done"), "{}\n").ok();
        std::fs::write(base.join("elsewhere/c-1.ndjson"), "{}\n").ok();
        std::os::unix::fs::symlink(base.join("elsewhere/c-1.ndjson"), dir.join("c-1.ndjson")).ok();

        let runs = collect_runs(&dir);
        let ids: Vec<_> = runs
            .iter()
            .map(|r| (r.schedule_id.as_str(), r.started_ms))
            .collect();
        assert_eq!(ids, [("a", 10_000), ("b", 20_000)]);

        let b = dir.join("b-20.ndjson").to_string_lossy().into_owned();
        let lines = confine(&dir, &b)
            .and_then(|p| read_lines(&p))
            .unwrap_or_default();
        assert_eq!(lines, ["{\"v\":1}", "{\"v\":2}"]);

        let link = dir.join("c-1.ndjson").to_string_lossy().into_owned();
        assert_eq!(
            confine(&dir, &link).err().map(|e| e.kind()),
            Some("permission_denied")
        );
        let outside = base
            .join("elsewhere/c-1.ndjson")
            .to_string_lossy()
            .into_owned();
        assert_eq!(
            confine(&dir, &outside).err().map(|e| e.kind()),
            Some("permission_denied")
        );
        let dotdot = format!("{}/../elsewhere/c-1.ndjson", dir.display());
        assert_eq!(
            confine(&dir, &dotdot).err().map(|e| e.kind()),
            Some("permission_denied")
        );
        assert_eq!(
            confine(&dir, "b-20.ndjson").err().map(|e| e.kind()),
            Some("invalid_input")
        );

        assert!(ack(&dir, &dir.join("a-10.ndjson").to_string_lossy()).is_ok());
        assert!(dir.join("a-10.ndjson.done").is_file());
        assert_eq!(collect_runs(&dir).len(), 1);
        assert_eq!(
            ack(&dir, &link).err().map(|e| e.kind()),
            Some("permission_denied")
        );
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn program_argv_keeps_every_value_out_of_the_shell_text() {
        let argv = program_args(
            "weekly-1",
            Path::new("/home/me/.linux-cleanup/desktop-engine/clean up.sh"),
            Path::new("/home/me/.linux-cleanup/schedule-runs"),
            crate::schedule::schedule_args(crate::schedule::ScheduleKind::Cleanup),
        );
        assert_eq!(argv[..2], ["/bin/sh", "-c"]);
        assert!(!argv[2].contains("weekly-1") && !argv[2].contains("clean up.sh"));
        assert!(
            argv[2].starts_with("umask 077;") && argv[2].contains("exec /bin/bash \"$0\" \"$@\"")
        );
        assert_eq!(
            argv[3..],
            [
                "/home/me/.linux-cleanup/desktop-engine/clean up.sh",
                "/home/me/.linux-cleanup/schedule-runs",
                "weekly-1",
                "--all-safe",
                "--yes",
                "--json-events"
            ]
        );
    }

    #[test]
    fn wrapper_writes_the_stream_to_a_private_file() {
        let dir =
            std::env::temp_dir().join(format!("linux-cleanup-wrapper-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).ok();
        let script = dir.join("fake.sh");
        std::fs::write(
            &script,
            "printf '{\\\"v\\\":1,\\\"args\\\":\\\"%s\\\"}\\n' \"$*\"\n",
        )
        .ok();
        let runs = dir.join("runs");
        let argv = program_args("id-1", &script, &runs, vec!["--x".into(), "a b".into()]);
        let status = std::process::Command::new(&argv[0])
            .args(&argv[1..])
            .status();
        assert!(status.is_ok_and(|s| s.success()));
        let files: Vec<_> = std::fs::read_dir(&runs)
            .map(|r| r.flatten().map(|e| e.path()).collect())
            .unwrap_or_default();
        assert_eq!(files.len(), 1);
        let name = files[0]
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        assert!(parse_run_name(&name).is_some_and(|(id, _)| id == "id-1"));
        use std::os::unix::fs::PermissionsExt;
        let mode = |p: &Path| {
            std::fs::metadata(p)
                .map(|m| m.permissions().mode() & 0o777)
                .ok()
        };
        assert_eq!(mode(&files[0]), Some(0o600));
        assert_eq!(mode(&runs), Some(0o700));
        assert_eq!(
            std::fs::read_to_string(&files[0]).ok(),
            Some("{\"v\":1,\"args\":\"--x a b\"}\n".into())
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
