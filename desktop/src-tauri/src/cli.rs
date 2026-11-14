//! Running the bundled CLI and streaming its NDJSON events to the UI.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::Command;

use crate::error::{AppError, AppResult};
use crate::paths;
use crate::run_args::{RunMode, build_args};

/// How long `cancel_run` waits after SIGINT before it sends SIGTERM.
const CANCEL_GRACE: Duration = Duration::from_secs(5);

/// One live run.
struct RunHandle {
    /// Process-group id of the CLI (it is spawned as a group leader).
    pgid: i32,
    cancelled: Arc<AtomicBool>,
}

/// The runs the app has started and not yet seen exit.
#[derive(Default)]
pub struct RunRegistry {
    runs: Mutex<HashMap<String, RunHandle>>,
}

impl RunRegistry {
    /// True while at least one run is alive (the window refuses to quit then).
    pub fn has_active(&self) -> bool {
        self.runs
            .lock()
            .map(|runs| !runs.is_empty())
            .unwrap_or(false)
    }
}

/// Payload of `cli_info`.
#[derive(Serialize)]
pub struct CliInfo {
    version: String,
    path: String,
    ok: bool,
}

/// Extracts `2.1.0` from the CLI's `linux-cleanup v2.1.0` (or `linux-cleanup 2.1.0`) version line.
pub fn parse_version(stdout: &str) -> Option<String> {
    stdout.lines().find_map(|line| {
        let rest = line.trim().strip_prefix("linux-cleanup ")?;
        let version = rest.strip_prefix('v').unwrap_or(rest);
        let looks_right = !version.is_empty()
            && version
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-');
        looks_right.then(|| version.to_owned())
    })
}

/// Reports the bundled CLI's version and path; `ok` is false when it does not answer.
#[tauri::command]
pub async fn cli_info(app: AppHandle) -> AppResult<CliInfo> {
    let path = paths::checked_cli_path(&app)?;
    let output = tokio::time::timeout(
        Duration::from_secs(15),
        Command::new("/bin/bash")
            .arg(&path)
            .arg("--version")
            .env("PATH", paths::cli_path_env(&app))
            .env("LINUX_CLEANUP_LAUNCHER", "desktop")
            .stdin(Stdio::null())
            .output(),
    )
    .await;
    let version = match output {
        Ok(Ok(out)) if out.status.success() => parse_version(&String::from_utf8_lossy(&out.stdout)),
        _ => None,
    };
    Ok(CliInfo {
        ok: version.is_some(),
        version: version.unwrap_or_default(),
        path: path.to_string_lossy().into_owned(),
    })
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliEvent {
    run_id: String,
    line: serde_json::Value,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliStderr {
    run_id: String,
    text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliExit {
    run_id: String,
    code: Option<i32>,
    cancelled: bool,
}

/// Starts the CLI and returns its run id; output arrives as `cli-event`,
/// `cli-stderr` and finally `cli-exit`.
#[tauri::command]
pub async fn run_cli(
    app: AppHandle,
    registry: State<'_, RunRegistry>,
    mode: RunMode,
    dry_run: bool,
) -> AppResult<String> {
    let args = build_args(mode, dry_run)?;
    let script = paths::checked_cli_path(&app)?;
    let logs = paths::logs_dir(&app)?;
    let reports = paths::reports_dir(&app)?;

    let mut command = Command::new("/bin/bash");
    command
        .arg(&script)
        .args(&args)
        .env("PATH", paths::cli_path_env(&app))
        // The desktop owns updates (app_releases gate); the bundled engine skips its npm check.
        .env("LINUX_CLEANUP_LAUNCHER", "desktop")
        // The bundle is read-only (AppImage); reports and logs live in ~/.linux-cleanup.
        .env("LINUX_CLEANUP_LOG_DIR", &logs)
        .env("LINUX_CLEANUP_REPORTS_DIR", &reports)
        .env("NO_COLOR", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .process_group(0);

    let run_id = uuid::Uuid::new_v4().to_string();
    let cancelled = Arc::new(AtomicBool::new(false));
    // Check, spawn and register under one lock so two clicks cannot start two runs.
    let mut child = {
        let mut runs = registry
            .runs
            .lock()
            .map_err(|_| AppError::Io("run registry unavailable".into()))?;
        if !runs.is_empty() {
            return Err(AppError::invalid("a run is already in progress"));
        }
        let child = command
            .spawn()
            .map_err(|e| AppError::CliFailed(format!("could not start the CLI: {e}")))?;
        let pgid = child
            .id()
            .and_then(|id| i32::try_from(id).ok())
            .ok_or_else(|| AppError::CliFailed("the CLI exited before it started".into()))?;
        runs.insert(
            run_id.clone(),
            RunHandle {
                pgid,
                cancelled: cancelled.clone(),
            },
        );
        child
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let task_app = app.clone();
    let task_id = run_id.clone();
    tauri::async_runtime::spawn(async move {
        // Drain both pipes at once: reading one to the end first can stall the CLI
        // when the other pipe's buffer fills.
        let out_task = async {
            if let Some(stream) = stdout {
                forward(task_app.clone(), task_id.clone(), stream, true).await;
            }
        };
        let err_task = async {
            if let Some(stream) = stderr {
                forward(task_app.clone(), task_id.clone(), stream, false).await;
            }
        };
        tokio::join!(out_task, err_task);
        let code = match child.wait().await {
            Ok(status) => status.code(),
            Err(error) => {
                log::warn!("waiting for the CLI failed: {error}");
                None
            }
        };
        if let Ok(mut runs) = task_app.state::<RunRegistry>().runs.lock() {
            runs.remove(&task_id);
        }
        let payload = CliExit {
            run_id: task_id,
            code,
            cancelled: cancelled.load(Ordering::SeqCst),
        };
        if let Err(error) = task_app.emit("cli-exit", payload) {
            log::warn!("emitting cli-exit failed: {error}");
        }
    });
    Ok(run_id)
}

/// Reads one pipe line by line. Stdout lines that parse as JSON become `cli-event`;
/// everything else becomes `cli-stderr`.
async fn forward<R: Runtime, S: AsyncRead + Unpin>(
    app: AppHandle<R>,
    run_id: String,
    stream: S,
    is_stdout: bool,
) {
    let mut lines = BufReader::new(stream).lines();
    loop {
        let line = match lines.next_line().await {
            Ok(Some(line)) => line,
            Ok(None) => break,
            Err(error) => {
                log::warn!("reading CLI output failed: {error}");
                break;
            }
        };
        if line.trim().is_empty() {
            continue;
        }
        let parsed = is_stdout
            .then(|| serde_json::from_str::<serde_json::Value>(&line).ok())
            .flatten()
            .filter(serde_json::Value::is_object);
        let result = match parsed {
            Some(value) => app.emit(
                "cli-event",
                CliEvent {
                    run_id: run_id.clone(),
                    line: value,
                },
            ),
            None => app.emit(
                "cli-stderr",
                CliStderr {
                    run_id: run_id.clone(),
                    text: line,
                },
            ),
        };
        if let Err(error) = result {
            log::warn!("emitting CLI output failed: {error}");
        }
    }
}

/// Sends SIGINT to the run's process group, then SIGTERM after five seconds if it lives on.
#[tauri::command]
pub fn cancel_run(
    app: AppHandle,
    registry: State<'_, RunRegistry>,
    run_id: String,
) -> AppResult<()> {
    let pgid = {
        let runs = registry
            .runs
            .lock()
            .map_err(|_| AppError::Io("run registry unavailable".into()))?;
        let handle = runs
            .get(&run_id)
            .ok_or_else(|| AppError::NotFound("that run has already finished".into()))?;
        handle.cancelled.store(true, Ordering::SeqCst);
        handle.pgid
    };
    signal_group(pgid, libc::SIGINT)?;
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(CANCEL_GRACE).await;
        let alive = app
            .state::<RunRegistry>()
            .runs
            .lock()
            .map(|runs| runs.contains_key(&run_id))
            .unwrap_or(false);
        if alive && let Err(error) = signal_group(pgid, libc::SIGTERM) {
            log::warn!("SIGTERM after the grace period failed: {error}");
        }
    });
    Ok(())
}

/// Sends `signal` to every process in the group.
fn signal_group(pgid: i32, signal: i32) -> AppResult<()> {
    // SAFETY: killpg only reads its two integer arguments.
    let rc = unsafe { libc::killpg(pgid, signal) };
    if rc == 0 {
        return Ok(());
    }
    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ESRCH) {
        return Ok(());
    }
    Err(AppError::Io(format!("could not signal the run: {error}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_line_parses() {
        assert_eq!(
            parse_version("linux-cleanup v2.1.0\n"),
            Some("2.1.0".to_owned())
        );
        assert_eq!(
            parse_version("linux-cleanup 2.1.0\n"),
            Some("2.1.0".to_owned())
        );
        assert_eq!(parse_version("[NOTE] hello\n"), None);
    }
}
