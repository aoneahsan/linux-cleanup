//! The main window's lifecycle and the optional tray icon.
//!
//! Tray off: closing the window quits the app, as Linux desktop apps do.
//! Tray on: closing hides the window and the tray icon stays, with Open linux-cleanup,
//! New preview and Quit. A run in progress keeps the app alive either way: closing then
//! hides the window instead of quitting mid-run.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::image::Image;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime, State, Window};

use crate::cli::RunRegistry;
use crate::error::{AppError, AppResult};

const TRAY_ID: &str = "linux-cleanup-tray";
/// Menu ids of the tray items.
pub const TRAY_OPEN: &str = "tray-open";
pub const TRAY_NEW_PREVIEW: &str = "tray-new-preview";
pub const TRAY_QUIT: &str = "tray-quit";
/// The tray icon, drawn from the app mark at 32 px.
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray.png");

/// Payload of the `menu` event the UI listens to.
#[derive(Clone, Serialize)]
struct MenuPayload {
    id: &'static str,
}

/// Whether the tray is on, and the live icon while it is.
#[derive(Default)]
pub struct TrayState {
    enabled: AtomicBool,
    icon: Mutex<Option<TrayIcon>>,
}

/// Shows and focuses the main window.
pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Close-button handling. Returns true when the close should be prevented (the window is
/// hidden instead): the tray is on, or a run is still going.
pub fn on_close_requested<R: Runtime>(window: &Window<R>) -> bool {
    let app = window.app_handle();
    let tray_on = app.state::<TrayState>().enabled.load(Ordering::SeqCst);
    let running = app.state::<RunRegistry>().has_active();
    if tray_on || running {
        let _ = window.hide();
        return true;
    }
    false
}

/// Handles the tray's menu items.
pub fn handle_tray_menu<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().as_ref() {
        TRAY_OPEN => show_main(app),
        TRAY_NEW_PREVIEW => {
            show_main(app);
            if let Err(error) = app.emit("menu", MenuPayload { id: "new-preview" }) {
                log::warn!("emitting menu failed: {error}");
            }
        }
        TRAY_QUIT => {
            if app.state::<RunRegistry>().has_active() {
                // Never quit under a running cleanup; show the window so the run can be watched or cancelled.
                show_main(app);
            } else {
                app.exit(0);
            }
        }
        _ => {}
    }
}

fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<TrayIcon<R>> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, TRAY_OPEN, "Open linux-cleanup", true, None::<&str>)?,
            &MenuItem::with_id(app, TRAY_NEW_PREVIEW, "New preview", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, TRAY_QUIT, "Quit linux-cleanup", true, None::<&str>)?,
        ],
    )?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(TRAY_ICON)?)
        .tooltip("linux-cleanup")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .build(app)
}

/// Turns the tray icon on or off. The UI persists the choice and re-sends it at launch.
#[tauri::command]
pub fn set_tray_mode(app: AppHandle, state: State<'_, TrayState>, enabled: bool) -> AppResult<()> {
    let mut icon = state
        .icon
        .lock()
        .map_err(|_| AppError::Io("tray state unavailable".into()))?;
    if enabled && icon.is_none() {
        *icon = Some(build_tray(&app)?);
    } else if !enabled && let Some(tray) = icon.take() {
        drop(tray);
        let _ = app.remove_tray_by_id(TRAY_ID);
        // A hidden window must not be stranded without its tray icon.
        show_main(&app);
    }
    state.enabled.store(enabled, Ordering::SeqCst);
    Ok(())
}
