//! The CLI argument list for one desktop run. The UI never sends raw arguments: it names a
//! mode, and this module maps it to the only two invocations `--json-events` supports
//! (`linux-cleanup/docs/reference/json-events.md`).

use serde::Deserialize;

use crate::error::{AppError, AppResult};

/// What the UI asks for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunMode {
    /// Read-only survey of the paths the CLI checks. Deletes nothing.
    Scan,
    /// The all-safe cleanup. With `dry_run` it proposes paths and deletes nothing.
    Allsafe,
}

/// Builds the argument list. A scan is always read-only, so `dry_run` is refused with it
/// rather than silently ignored.
pub fn build_args(mode: RunMode, dry_run: bool) -> AppResult<Vec<String>> {
    let args: &[&str] = match (mode, dry_run) {
        (RunMode::Scan, false) => &["--scan", "--json-events"],
        (RunMode::Scan, true) => {
            return Err(AppError::invalid(
                "a scan never deletes, so it takes no dry run",
            ));
        }
        (RunMode::Allsafe, true) => &["--all-safe", "--yes", "--dry-run", "--json-events"],
        (RunMode::Allsafe, false) => &["--all-safe", "--yes", "--json-events"],
    };
    Ok(args.iter().map(|a| (*a).to_owned()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_each_mode_to_its_one_invocation() {
        assert_eq!(
            build_args(RunMode::Scan, false).ok(),
            Some(vec!["--scan".into(), "--json-events".into()])
        );
        assert_eq!(
            build_args(RunMode::Allsafe, true).ok(),
            Some(vec![
                "--all-safe".into(),
                "--yes".into(),
                "--dry-run".into(),
                "--json-events".into()
            ])
        );
        assert_eq!(
            build_args(RunMode::Allsafe, false).ok(),
            Some(vec![
                "--all-safe".into(),
                "--yes".into(),
                "--json-events".into()
            ])
        );
        assert!(build_args(RunMode::Scan, true).is_err());
    }

    #[test]
    fn a_real_run_never_carries_the_dry_run_flag_and_a_preview_always_does() {
        let real = build_args(RunMode::Allsafe, false).unwrap_or_default();
        let preview = build_args(RunMode::Allsafe, true).unwrap_or_default();
        assert!(!real.iter().any(|a| a == "--dry-run"));
        assert!(preview.iter().any(|a| a == "--dry-run"));
    }
}
