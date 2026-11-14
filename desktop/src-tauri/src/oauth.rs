//! The one-shot loopback listener for the browser sign-in redirect.
//!
//! Google refuses OAuth inside embedded webviews, so sign-in runs in the user's
//! browser and returns to `http://127.0.0.1:<port>/…`. The first request carrying
//! `code` or `error` is emitted as `oauth-callback` and the listener closes.

use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use crate::error::{AppError, AppResult};

/// How long the listener waits for the browser to come back.
const LISTEN_TIMEOUT: Duration = Duration::from_secs(300);
/// How long one connection may take to send its request head.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
/// Largest request head read.
const MAX_HEAD: usize = 16 * 1024;

const PAGE: &str = "<!doctype html><html lang=\"en-GB\"><head><meta charset=\"utf-8\">\
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>linux-cleanup</title>\
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;\
font:16px/1.5 system-ui,'Cantarell','Ubuntu',sans-serif;background:#f6f4ed;color:#1c1b17}\
@media(prefers-color-scheme:dark){body{background:#0e0d09;color:#f3f1ea}}\
main{text-align:center;padding:32px}.mark{width:48px;height:48px;margin:0 auto 20px;background:#e2c632;\
transform:rotate(-8deg);position:relative}.mark i{position:absolute;left:10px;height:4px;border-radius:2px;background:#2b2a24}\
h1{font-size:20px;margin:0 0 8px}p{margin:0;opacity:.8}</style></head><body><main>\
<div class=\"mark\" aria-hidden=\"true\"><i style=\"top:13px;width:28px\"></i><i style=\"top:22px;width:21px\"></i>\
<i style=\"top:31px;width:14px\"></i></div><h1>Sign-in received</h1>\
<p>You can close this tab. linux-cleanup is finishing the sign-in.</p></main></body></html>";

#[derive(Serialize)]
pub struct OauthPort {
    port: u16,
    /// One-time value the app appends to its redirect (`/callback?n=<nonce>`); a request
    /// without it is refused, so another local process cannot hand the app a code.
    nonce: String,
}

#[derive(Clone, Serialize)]
struct OauthCallback {
    url: String,
}

/// Returns the request target of a `GET` request head, e.g. `/callback?code=…`.
pub fn request_target(head: &str) -> Option<&str> {
    let mut parts = head.lines().next()?.split_whitespace();
    (parts.next()? == "GET").then_some(())?;
    let target = parts.next()?;
    target.starts_with('/').then_some(target)
}

/// True when the target carries the OAuth result (`code` or `error` parameter).
pub fn is_callback(target: &str, nonce: &str) -> bool {
    target
        .split_once('?')
        .map(|(_, query)| {
            let mut pairs = query.split('&');
            let has_result = query
                .split('&')
                .any(|pair| pair.starts_with("code=") || pair.starts_with("error="));
            has_result && pairs.any(|pair| pair.strip_prefix("n=") == Some(nonce))
        })
        .unwrap_or(false)
}

/// Starts the loopback listener on a random port and returns that port.
#[tauri::command]
pub async fn oauth_listen(app: AppHandle) -> AppResult<OauthPort> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let nonce = uuid::Uuid::new_v4().simple().to_string();
    let expected = nonce.clone();
    tauri::async_runtime::spawn(async move {
        match tokio::time::timeout(
            LISTEN_TIMEOUT,
            wait_for_callback(&listener, port, &expected),
        )
        .await
        {
            Ok(Some(url)) => {
                crate::window::show_main(&app);
                if let Err(error) = app.emit("oauth-callback", OauthCallback { url }) {
                    log::warn!("emitting oauth-callback failed: {error}");
                }
            }
            Ok(None) => log::warn!("the sign-in listener stopped before a callback"),
            Err(_) => log::warn!("the sign-in listener timed out"),
        }
    });
    Ok(OauthPort { port, nonce })
}

/// Accepts connections until one carries the callback, answering the rest with 404.
async fn wait_for_callback(listener: &TcpListener, port: u16, nonce: &str) -> Option<String> {
    loop {
        let (mut stream, _) = listener.accept().await.ok()?;
        let Ok(Some(head)) = tokio::time::timeout(REQUEST_TIMEOUT, read_head(&mut stream)).await
        else {
            continue;
        };
        match request_target(&head).filter(|target| is_callback(target, nonce)) {
            Some(target) => {
                let url = format!("http://127.0.0.1:{port}{target}");
                let _ = respond(&mut stream, "200 OK", PAGE).await;
                return Some(url);
            }
            None => {
                let _ = respond(&mut stream, "404 Not Found", "").await;
            }
        }
    }
}

/// Reads until the blank line that ends an HTTP request head.
async fn read_head(stream: &mut TcpStream) -> Option<String> {
    let mut buf = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];
    while !buf.windows(4).any(|w| w == b"\r\n\r\n") && buf.len() < MAX_HEAD {
        let n = stream.read(&mut chunk).await.ok()?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
    }
    Some(String::from_utf8_lossy(&buf).into_owned())
}

async fn respond(stream: &mut TcpStream, status: &str, body: &str) -> AppResult<()> {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
Cache-Control: no-store\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\n\
Referrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;
    let _ = stream.shutdown().await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_callback_target() {
        let head = "GET /callback?code=abc&state=x HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
        assert_eq!(request_target(head), Some("/callback?code=abc&state=x"));
        assert!(is_callback("/callback?n=k1&code=abc", "k1"));
        assert!(!is_callback("/callback?code=abc", "k1"));
        assert!(!is_callback("/callback?n=other&code=abc", "k1"));
        assert!(is_callback("/?n=k1&error=access_denied", "k1"));
        assert!(!is_callback("/favicon.ico", "k1"));
        assert_eq!(request_target("POST / HTTP/1.1\r\n\r\n"), None);
    }
}
