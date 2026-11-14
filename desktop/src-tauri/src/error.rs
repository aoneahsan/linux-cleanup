//! The one error type every command returns.
//!
//! It crosses IPC as `{ kind, message }` (docs/CONTRACTS.md §2). `kind` is one of
//! `cli_missing`, `cli_failed`, `permission_denied`, `not_found`, `invalid_input`,
//! `io` and `cancelled`; the UI switches on it, the message is for people.

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// Every failure a command can report to the UI.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// The bundled `cleanup.sh` (or its `lib/`, `modules/`) is missing.
    #[error("{0}")]
    CliMissing(String),
    /// The CLI could not be started or exited in a way the app cannot use.
    #[error("{0}")]
    CliFailed(String),
    /// The request touches something the app refuses to touch.
    #[error("{0}")]
    PermissionDenied(String),
    /// The thing asked for does not exist.
    #[error("{0}")]
    NotFound(String),
    /// The arguments do not pass validation.
    #[error("{0}")]
    InvalidInput(String),
    /// Any other operating-system failure.
    #[error("{0}")]
    Io(String),
}

impl AppError {
    /// The stable wire name of the variant.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::CliMissing(_) => "cli_missing",
            Self::CliFailed(_) => "cli_failed",
            Self::PermissionDenied(_) => "permission_denied",
            Self::NotFound(_) => "not_found",
            Self::InvalidInput(_) => "invalid_input",
            Self::Io(_) => "io",
        }
    }

    /// Shorthand for an `invalid_input` error.
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::InvalidInput(message.into())
    }

    /// Shorthand for a `permission_denied` error.
    pub fn denied(message: impl Into<String>) -> Self {
        Self::PermissionDenied(message.into())
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        match error.kind() {
            std::io::ErrorKind::NotFound => Self::NotFound(error.to_string()),
            std::io::ErrorKind::PermissionDenied => Self::PermissionDenied(error.to_string()),
            _ => Self::Io(error.to_string()),
        }
    }
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::Io(error.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::Io(error.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

/// The result type of every command.
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialises_as_kind_and_message() {
        let json = serde_json::to_value(AppError::denied("outside ~/.linux-cleanup"));
        assert_eq!(
            json.ok(),
            Some(
                serde_json::json!({ "kind": "permission_denied", "message": "outside ~/.linux-cleanup" })
            )
        );
    }

    #[test]
    fn io_not_found_maps_to_not_found() {
        let error: AppError = std::io::Error::from(std::io::ErrorKind::NotFound).into();
        assert_eq!(error.kind(), "not_found");
    }
}
