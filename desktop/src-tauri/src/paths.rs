//! Path resolution and the `~/.linux-cleanup` boundary.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

use crate::error::{AppError, AppResult};

/// Resource path of the bundled CLI entry point. `cleanup.sh` sources `lib/` and
/// `modules/` from its own folder, so the three are bundled side by side under `cli/`.
const CLI_RESOURCE: &str = "cli/cleanup.sh";

/// A desktop session on Linux may start the app with a short PATH (an AppImage launched
/// from a file manager, a `.desktop` entry); the CLI's package-manager steps need the
/// usual tool locations, including user installs, to find what they clean.
pub fn cli_path_env<R: Runtime>(app: &AppHandle<R>) -> String {
    let home = home_dir(app)
        .map(|h| h.to_string_lossy().into_owned())
        .unwrap_or_default();
    let mut parts: Vec<String> = Vec::new();
    if !home.is_empty() {
        parts.push(format!("{home}/.local/bin"));
        parts.push(format!("{home}/.cargo/bin"));
    }
    parts.extend(
        [
            "/usr/local/sbin",
            "/usr/local/bin",
            "/usr/sbin",
            "/usr/bin",
            "/sbin",
            "/bin",
            "/snap/bin",
        ]
        .iter()
        .map(|s| (*s).to_owned()),
    );
    parts.join(":")
}

/// The user's home directory.
pub fn home_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    app.path()
        .home_dir()
        .map_err(|e| AppError::Io(format!("cannot resolve the home folder: {e}")))
}

/// `~/.linux-cleanup`, where the CLI keeps reports and logs for the desktop app.
pub fn data_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(home_dir(app)?.join(".linux-cleanup"))
}

/// `~/.linux-cleanup/reports`: the JSON session reports the CLI writes after a real run.
pub fn reports_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(data_dir(app)?.join("reports"))
}

/// `~/.linux-cleanup/logs`: one text log per CLI session.
pub fn logs_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(data_dir(app)?.join("logs"))
}

/// Absolute path of the bundled `cleanup.sh`.
pub fn cli_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    app.path()
        .resolve(CLI_RESOURCE, tauri::path::BaseDirectory::Resource)
        .map_err(|e| AppError::CliMissing(format!("cannot locate the bundled CLI: {e}")))
}

/// True when `dir` holds at least one `*.sh` file: the CLI sources `lib/*.sh` and
/// `modules/*.sh` by name, so an empty folder means a broken bundle.
pub fn has_shell_files(dir: &Path) -> bool {
    std::fs::read_dir(dir)
        .map(|entries| {
            entries.flatten().any(|entry| {
                entry.path().is_file() && entry.file_name().to_string_lossy().ends_with(".sh")
            })
        })
        .unwrap_or(false)
}

/// The bundled CLI path, checked to exist with `lib/` and `modules/` beside it.
///
/// The CLI always runs as `/bin/bash <script>`, so the execute bit is not needed at runtime.
pub fn checked_cli_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let path = cli_path(app)?;
    if !path.is_file() {
        return Err(AppError::CliMissing(format!(
            "the bundled CLI is missing at {}",
            path.display()
        )));
    }
    for folder in ["lib", "modules"] {
        let dir = path.with_file_name(folder);
        if !has_shell_files(&dir) {
            return Err(AppError::CliMissing(format!(
                "the bundled CLI folder is missing at {}",
                dir.display()
            )));
        }
    }
    Ok(path)
}

/// True when `candidate` is `root` or lies inside it. Both must already be canonical.
pub fn is_within(root: &Path, candidate: &Path) -> bool {
    candidate.starts_with(root)
}

/// Canonicalises `requested` and accepts it only inside `root`.
///
/// Canonicalising first resolves `..` and every symlink, so a link inside the root
/// that points elsewhere is judged by where it really leads.
pub fn restrict_to(root: &Path, requested: &str) -> AppResult<PathBuf> {
    let requested = Path::new(requested);
    if !requested.is_absolute() {
        return Err(AppError::invalid("the path must be absolute"));
    }
    let root = root
        .canonicalize()
        .map_err(|_| AppError::NotFound(format!("{} does not exist yet", root.display())))?;
    let real = requested
        .canonicalize()
        .map_err(|_| AppError::NotFound(format!("{} does not exist", requested.display())))?;
    if is_within(&root, &real) {
        Ok(real)
    } else {
        Err(AppError::denied(
            "only files inside ~/.linux-cleanup can be opened",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("linux-cleanup-paths-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("inside/reports")).ok();
        std::fs::create_dir_all(dir.join("outside")).ok();
        dir
    }

    #[test]
    fn accepts_a_file_inside_the_root() {
        let dir = temp_root("inside");
        let file = dir.join("inside/reports/a.txt");
        std::fs::write(&file, "x").ok();
        assert!(restrict_to(&dir.join("inside"), &file.to_string_lossy()).is_ok());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_dot_dot_and_symlink_escapes() {
        let dir = temp_root("escape");
        let outside = dir.join("outside/secret.txt");
        std::fs::write(&outside, "x").ok();
        let dotdot = dir.join("inside/../outside/secret.txt");
        assert!(restrict_to(&dir.join("inside"), &dotdot.to_string_lossy()).is_err());
        let link = dir.join("inside/link.txt");
        std::os::unix::fs::symlink(&outside, &link).ok();
        assert!(restrict_to(&dir.join("inside"), &link.to_string_lossy()).is_err());
        assert!(restrict_to(&dir.join("inside"), "relative/path").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn finds_shell_files_only() {
        let dir = temp_root("shell");
        assert!(!has_shell_files(&dir.join("inside")));
        std::fs::write(dir.join("inside/readme.txt"), "x").ok();
        assert!(!has_shell_files(&dir.join("inside")));
        std::fs::write(dir.join("inside/common.sh"), "x").ok();
        assert!(has_shell_files(&dir.join("inside")));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
