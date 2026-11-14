//! linux-cleanup desktop core.
//!
//! A thin, safe wrapper around the bundled `cleanup.sh`: every cleanup rule lives in the
//! CLI. This crate starts it, streams its `--json-events` output to the UI, and owns the
//! few native jobs a webview cannot do (disk facts, schedules, local reports, sign-in).

mod cli;
mod disk;
mod error;
mod export;
mod history;
mod oauth;
mod paths;
mod run_args;
mod schedule;
mod schedule_runs;
mod window;

use tauri::WindowEvent;

/// Builds and runs the app. Returns only when the app quits.
pub fn run() {
    let app = tauri::Builder::default()
        // First: a second launch focuses the running window instead of starting again.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show_main(app);
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Warn)
                .build(),
        )
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(cli::RunRegistry::default())
        .manage(window::TrayState::default())
        .setup(|app| {
            schedule::refresh_engine_if_scheduled(app.handle());
            Ok(())
        })
        .on_menu_event(window::handle_tray_menu)
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.label() == "main"
                && window::on_close_requested(window)
            {
                api.prevent_close();
            }
        })
        // The only invoke_handler: every command is listed here, once.
        .invoke_handler(tauri::generate_handler![
            cli::cli_info,
            cli::run_cli,
            cli::cancel_run,
            disk::system_info,
            disk::disk_status,
            export::export_json,
            window::set_tray_mode,
            history::list_local_history,
            history::open_path,
            history::reveal_path,
            oauth::oauth_listen,
            schedule::schedule_list,
            schedule::schedule_install,
            schedule::schedule_remove,
            schedule_runs::list_schedule_runs,
            schedule_runs::read_schedule_run,
            schedule_runs::ack_schedule_run,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = app {
        log::error!("linux-cleanup could not start: {error}");
        std::process::exit(1);
    }
}
