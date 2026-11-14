//! Scheduled dry runs and all-safe cleanups as systemd user timers.
//!
//! Each schedule is a pair in `~/.config/systemd/user/`:
//! `linux-cleanup-schedule-<id>.timer` (when) and `linux-cleanup-schedule-<id>.service` (what).
//! The service file carries the spec as one `# linux-cleanup-spec:` JSON comment, and that
//! comment is the only record: `schedule_list` reads the specs back from it.
//!
//! The timer cannot point into the app bundle: an AppImage's files live in a mount that
//! disappears when the app closes. So the service runs a copy of the bundled engine in
//! `~/.linux-cleanup/desktop-engine/`, refreshed at every install and at app start.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tokio::process::Command;

use crate::error::{AppError, AppResult};
use crate::paths;

const UNIT_PREFIX: &str = "linux-cleanup-schedule-";
const SPEC_MARK: &str = "# linux-cleanup-spec: ";

/// One schedule, exactly as the UI sends and receives it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScheduleSpec {
    pub id: String,
    pub kind: ScheduleKind,
    /// 0 (Sunday) to 6; `None` runs daily. Ignored when `day_of_month` is set.
    pub weekday: Option<u8>,
    /// 1 to 28: runs monthly on that day. `dayOfMonth` on the JS side.
    #[serde(rename = "dayOfMonth", default)]
    pub day_of_month: Option<u8>,
    pub hour: u8,
    pub minute: u8,
}

/// Whether a schedule runs a dry run (nothing removed) or the all-safe cleanup.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScheduleKind {
    Preview,
    Cleanup,
}

/// Checks a spec: id shape and time ranges.
pub fn validate(spec: &ScheduleSpec) -> AppResult<()> {
    let id_ok = !spec.id.is_empty()
        && spec.id.len() <= 64
        && spec
            .id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-');
    if !id_ok {
        return Err(AppError::invalid(
            "schedule id must be 1-64 letters, digits or dashes",
        ));
    }
    if spec.weekday.is_some_and(|d| d > 6) || spec.hour > 23 || spec.minute > 59 {
        return Err(AppError::invalid("weekday 0-6, hour 0-23, minute 0-59"));
    }
    if spec.day_of_month.is_some_and(|d| !(1..=28).contains(&d)) {
        return Err(AppError::invalid("day of month must be 1-28"));
    }
    Ok(())
}

/// The CLI arguments a schedule runs with (after `/bin/bash <script>`). Unattended, so
/// `--yes` answers the all-safe confirmation; a preview adds `--dry-run`.
pub fn schedule_args(kind: ScheduleKind) -> Vec<String> {
    let args: &[&str] = match kind {
        ScheduleKind::Preview => &["--all-safe", "--yes", "--dry-run", "--json-events"],
        ScheduleKind::Cleanup => &["--all-safe", "--yes", "--json-events"],
    };
    args.iter().map(|a| (*a).to_owned()).collect()
}

/// systemd `OnCalendar=` for the spec.
pub fn on_calendar(spec: &ScheduleSpec) -> String {
    const DAYS: [&str; 7] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let time = format!("{:02}:{:02}:00", spec.hour, spec.minute);
    match (spec.day_of_month, spec.weekday) {
        (Some(day), _) => format!("*-*-{day:02} {time}"),
        (None, Some(weekday)) => format!("{} *-*-* {time}", DAYS[usize::from(weekday.min(6))]),
        (None, None) => format!("*-*-* {time}"),
    }
}

/// Quotes one ExecStart word for systemd: double quotes, with `\`, `"` escaped and the
/// specifier and variable characters (`%`, `$`) doubled so systemd passes them literally.
pub fn unit_quote(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for c in value.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '%' => out.push_str("%%"),
            '$' => out.push_str("$$"),
            '\n' | '\r' => out.push(' '),
            other => out.push(other),
        }
    }
    out.push('"');
    out
}

/// The service unit text.
pub fn service_unit(
    spec: &ScheduleSpec,
    script: &Path,
    runs_dir: &Path,
    data_dir: &Path,
) -> AppResult<String> {
    let json = serde_json::to_string(spec)
        .map_err(|e| AppError::Io(format!("spec encode failed: {e}")))?;
    let argv =
        crate::schedule_runs::program_args(&spec.id, script, runs_dir, schedule_args(spec.kind));
    let exec = argv
        .iter()
        .map(|a| unit_quote(a))
        .collect::<Vec<_>>()
        .join(" ");
    let what = match spec.kind {
        ScheduleKind::Preview => "dry run",
        ScheduleKind::Cleanup => "all-safe cleanup",
    };
    let env = |key: &str, value: &Path| {
        format!(
            "Environment={}",
            unit_quote(&format!("{key}={}", value.display()))
        )
    };
    Ok(format!(
        "{SPEC_MARK}{json}\n[Unit]\nDescription=linux-cleanup scheduled {what}\n\n[Service]\nType=oneshot\n\
Environment=LINUX_CLEANUP_LAUNCHER=desktop\nEnvironment=NO_COLOR=1\n{}\n{}\nNice=10\nIOSchedulingClass=idle\nExecStart={exec}\n",
        env("LINUX_CLEANUP_LOG_DIR", &data_dir.join("logs")),
        env("LINUX_CLEANUP_REPORTS_DIR", &data_dir.join("reports")),
    ))
}

/// The timer unit text. `Persistent=true` runs a missed schedule at the next login.
pub fn timer_unit(spec: &ScheduleSpec) -> String {
    format!(
        "[Unit]\nDescription=linux-cleanup schedule {}\n\n[Timer]\nOnCalendar={}\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n",
        spec.id,
        on_calendar(spec)
    )
}

/// Reads the spec back from a service unit's first comment.
pub fn spec_from_unit(text: &str) -> Option<ScheduleSpec> {
    let json = text.lines().find_map(|line| line.strip_prefix(SPEC_MARK))?;
    let spec: ScheduleSpec = serde_json::from_str(json).ok()?;
    validate(&spec).ok()?;
    Some(spec)
}

fn units_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(paths::home_dir(app)?.join(".config/systemd/user"))
}

/// `~/.linux-cleanup/desktop-engine/cleanup.sh`: the copy a timer runs.
fn engine_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(paths::data_dir(app)?.join("desktop-engine"))
}

fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)?.flatten() {
        let meta = entry.path().symlink_metadata()?;
        let target = to.join(entry.file_name());
        if meta.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if meta.is_file() {
            std::fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// Replaces the engine copy with the bundled CLI (staged beside it, then swapped in).
pub fn refresh_engine<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let bundled = paths::checked_cli_path(app)?;
    let source = bundled
        .parent()
        .ok_or_else(|| AppError::CliMissing("bundled CLI has no folder".into()))?;
    let engine = engine_dir(app)?;
    let parent = engine
        .parent()
        .ok_or_else(|| AppError::Io("no data folder".into()))?
        .to_path_buf();
    std::fs::create_dir_all(&parent)?;
    let staged = parent.join(format!(".desktop-engine-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&staged);
    copy_tree(source, &staged)?;
    let old = parent.join(format!(".desktop-engine-old-{}", std::process::id()));
    if engine.exists() {
        std::fs::rename(&engine, &old)?;
    }
    std::fs::rename(&staged, &engine)?;
    let _ = std::fs::remove_dir_all(&old);
    Ok(engine.join("cleanup.sh"))
}

/// Refreshes the engine copy at app start when a schedule exists, so a timer always runs
/// the version this app ships. Failures are logged; the next install retries.
pub fn refresh_engine_if_scheduled<R: Runtime>(app: &AppHandle<R>) {
    let has_schedule = units_dir(app)
        .ok()
        .and_then(|dir| std::fs::read_dir(dir).ok())
        .is_some_and(|mut it| {
            it.any(|e| e.is_ok_and(|e| e.file_name().to_string_lossy().starts_with(UNIT_PREFIX)))
        });
    if has_schedule && let Err(error) = refresh_engine(app) {
        log::warn!("refreshing the schedule engine failed: {error}");
    }
}

async fn systemctl(args: &[&str]) -> AppResult<std::process::Output> {
    Command::new("systemctl")
        .arg("--user")
        .args(args)
        .stdin(Stdio::null())
        .output()
        .await
        .map_err(|e| AppError::Io(format!("systemctl is not available: {e}")))
}

/// Lists the schedules this app installed.
#[tauri::command]
pub async fn schedule_list(app: AppHandle) -> AppResult<Vec<ScheduleSpec>> {
    let Ok(entries) = std::fs::read_dir(units_dir(&app)?) else {
        return Ok(Vec::new());
    };
    let mut specs: Vec<ScheduleSpec> = entries
        .flatten()
        .filter(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            name.starts_with(UNIT_PREFIX) && name.ends_with(".service")
        })
        .filter_map(|e| std::fs::read_to_string(e.path()).ok())
        .filter_map(|text| spec_from_unit(&text))
        .collect();
    specs.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(specs)
}

/// Writes and enables the timer for the spec, replacing one with the same id.
#[tauri::command]
pub async fn schedule_install(
    app: AppHandle,
    id: String,
    kind: ScheduleKind,
    weekday: Option<u8>,
    day_of_month: Option<u8>,
    hour: u8,
    minute: u8,
) -> AppResult<()> {
    let spec = ScheduleSpec {
        id,
        kind,
        // A monthly schedule ignores the weekday, so it is not stored.
        weekday: weekday.filter(|_| day_of_month.is_none()),
        day_of_month,
        hour,
        minute,
    };
    validate(&spec)?;
    let script = refresh_engine(&app)?;
    let data = paths::data_dir(&app)?;
    std::fs::create_dir_all(data.join("logs"))?;
    let runs_dir = crate::schedule_runs::runs_dir(&app)?;
    crate::schedule_runs::ensure_runs_dir(&runs_dir)?;
    let dir = units_dir(&app)?;
    std::fs::create_dir_all(&dir)?;
    let base = format!("{UNIT_PREFIX}{}", spec.id);
    for (ext, text) in [
        ("service", service_unit(&spec, &script, &runs_dir, &data)?),
        ("timer", timer_unit(&spec)),
    ] {
        let temp = dir.join(format!(".{base}.{ext}.tmp"));
        std::fs::write(&temp, text)?;
        std::fs::rename(&temp, dir.join(format!("{base}.{ext}")))?;
    }
    let reload = systemctl(&["daemon-reload"]).await?;
    let enable = systemctl(&["enable", "--now", &format!("{base}.timer")]).await?;
    if !reload.status.success() || !enable.status.success() {
        let _ = std::fs::remove_file(dir.join(format!("{base}.service")));
        let _ = std::fs::remove_file(dir.join(format!("{base}.timer")));
        let _ = systemctl(&["daemon-reload"]).await;
        return Err(AppError::Io(format!(
            "systemd could not enable the schedule: {}",
            String::from_utf8_lossy(&enable.stderr).trim()
        )));
    }
    Ok(())
}

/// Disables and deletes a schedule.
#[tauri::command]
pub async fn schedule_remove(app: AppHandle, id: String) -> AppResult<()> {
    validate(&ScheduleSpec {
        id: id.clone(),
        kind: ScheduleKind::Preview,
        weekday: None,
        day_of_month: None,
        hour: 0,
        minute: 0,
    })?;
    let base = format!("{UNIT_PREFIX}{id}");
    // "not loaded" is expected when the timer was already gone; the files decide.
    let _ = systemctl(&["disable", "--now", &format!("{base}.timer")]).await;
    let dir = units_dir(&app)?;
    let mut removed = false;
    for ext in ["timer", "service"] {
        removed |= std::fs::remove_file(dir.join(format!("{base}.{ext}"))).is_ok();
    }
    let _ = systemctl(&["daemon-reload"]).await;
    if removed {
        Ok(())
    } else {
        Err(AppError::NotFound("that schedule does not exist".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(kind: ScheduleKind, weekday: Option<u8>, day: Option<u8>) -> ScheduleSpec {
        ScheduleSpec {
            id: "weekly-1".into(),
            kind,
            weekday,
            day_of_month: day,
            hour: 9,
            minute: 5,
        }
    }

    #[test]
    fn calendar_for_daily_weekly_monthly() {
        assert_eq!(
            on_calendar(&spec(ScheduleKind::Preview, None, None)),
            "*-*-* 09:05:00"
        );
        assert_eq!(
            on_calendar(&spec(ScheduleKind::Preview, Some(0), None)),
            "Sun *-*-* 09:05:00"
        );
        assert_eq!(
            on_calendar(&spec(ScheduleKind::Preview, Some(3), Some(7))),
            "*-*-07 09:05:00"
        );
    }

    #[test]
    fn preview_schedule_is_a_dry_run_and_cleanup_is_not() {
        assert!(schedule_args(ScheduleKind::Preview).contains(&"--dry-run".to_owned()));
        assert!(!schedule_args(ScheduleKind::Cleanup).contains(&"--dry-run".to_owned()));
    }

    #[test]
    fn unit_round_trips_the_spec_and_quotes_hostile_paths() {
        let s = spec(ScheduleKind::Cleanup, Some(2), None);
        let text = service_unit(
            &s,
            Path::new("/home/a b/$x%h\"q/cleanup.sh"),
            Path::new("/r"),
            Path::new("/d"),
        )
        .unwrap_or_default();
        assert_eq!(spec_from_unit(&text), Some(s));
        assert!(text.contains(r#""/home/a b/$$x%%h\"q/cleanup.sh""#));
        assert!(!text.contains("--dry-run"));
    }

    #[test]
    fn rejects_bad_specs() {
        let mut s = spec(ScheduleKind::Preview, Some(7), None);
        assert!(validate(&s).is_err());
        s.weekday = None;
        s.id = "../evil".into();
        assert!(validate(&s).is_err());
        s.id = "ok".into();
        s.day_of_month = Some(29);
        assert!(validate(&s).is_err());
    }
}
