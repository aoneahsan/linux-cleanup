//! Build script: the Tauri context, an app permission per command, and a check
//! that the CLI this repo ships (../../cleanup.sh, lib/, modules/) is present before anything bundles it.

use std::os::unix::fs::PermissionsExt;
use std::path::Path;

/// Every app command. Listing them makes each one need an explicit capability grant.
const COMMANDS: &[&str] = &[
    "cli_info",
    "run_cli",
    "cancel_run",
    "system_info",
    "disk_status",
    "export_json",
    "set_tray_mode",
    "list_local_history",
    "open_path",
    "reveal_path",
    "oauth_listen",
    "schedule_list",
    "schedule_install",
    "schedule_remove",
    "list_schedule_runs",
    "read_schedule_run",
    "ack_schedule_run",
];

/// Counts `*.sh` files directly inside `dir`.
fn shell_files(dir: &Path) -> usize {
    std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .filter(|e| e.file_name().to_string_lossy().ends_with(".sh"))
                .count()
        })
        .unwrap_or(0)
}

fn main() {
    // The desktop bundles the CLI from the same repository, so app and engine ship one version.
    let cli = Path::new("../../cleanup.sh");
    println!("cargo:rerun-if-changed={}", cli.display());
    let executable = std::fs::metadata(cli)
        .map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
        .unwrap_or(false);
    assert!(executable, "../../cleanup.sh must exist and be executable");
    for folder in ["../../lib", "../../modules"] {
        let dir = Path::new(folder);
        println!("cargo:rerun-if-changed={}", dir.display());
        assert!(
            shell_files(dir) > 0,
            "{folder} must hold the CLI's *.sh files"
        );
    }

    let manifest = tauri_build::AppManifest::new().commands(COMMANDS);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .unwrap_or_else(|error| panic!("tauri build step failed: {error:#}"));
}
