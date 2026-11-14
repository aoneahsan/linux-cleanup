# Releasing the desktop app — from this Mac

Last Updated: 2026-11-02

Releases are built and published by hand on a Mac. No GitHub Actions workflow builds or publishes anything
(house rule, 2026-10-31). The updater endpoint in `src-tauri/tauri.conf.json` is
`https://github.com/aoneahsan/macleanup/releases/latest/download/latest.json`, so every release goes to the
PUBLIC `aoneahsan/macleanup` repository with the five assets 5.3.0 carries:
`macleanup_<version>_universal.dmg`, `macleanup.dmg` (stable name for the website button),
`macleanup.app.tar.gz`, `macleanup.app.tar.gz.sig` and `latest.json`.

The app is not code-signed or notarized (no Apple Developer account). Only the updater archive is signed with
the minisign key in `~/.secrets/macleanup/` (backed up and restore-proven in the FilesHub vault, project
`macleanup`).

## Steps

1. Version: `src-tauri/tauri.conf.json`, `package.json` and `src-tauri/Cargo.toml` carry the new app version.
   The bundled script `src-tauri/resources/macleanup.sh` equals the published CLI and keeps the CLI's own
   version (the app shows both, "App x · script y"); a desktop-only release such as 5.3.1 leaves it alone.
   Add the release to the website feed (`macleanup-website/content/releases.json` and `feed.html`).
2. Gates: `yarn install --immutable && yarn gates`.
3. Build the universal app with the updater key read at runtime (never echoed):

   ```bash
   export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.secrets/macleanup/tauri-updater.key)"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ~/.secrets/macleanup/tauri-updater.key.password)"
   yarn tauri build --target universal-apple-darwin
   ```

4. Write `latest.json` (version, notes, `pub_date`, and for each of `darwin-aarch64`, `darwin-x86_64` and
   `darwin-universal` the URL
   `https://github.com/aoneahsan/macleanup/releases/download/v<version>/macleanup.app.tar.gz` and the contents
   of the `.sig` file), then publish:

   ```bash
   B=src-tauri/target/universal-apple-darwin/release/bundle
   cp "$B"/dmg/macleanup_*_universal.dmg macleanup.dmg
   gh release create v<version> --repo aoneahsan/macleanup --title "macleanup <version>" \
     --notes "macOS 11 or later, Apple silicon and Intel. On first open, choose Open Anyway in System Settings > Privacy & Security." \
     "$B"/dmg/macleanup_*_universal.dmg macleanup.dmg "$B"/macos/macleanup.app.tar.gz "$B"/macos/macleanup.app.tar.gz.sig latest.json
   ```

5. Prove it: `curl -sL .../releases/latest/download/latest.json` shows the new version, and the previous
   release app updates itself to it (layer 1): download the previous DMG, run that app, and watch its bundle
   version change and the status bar read the new version after the quiet-moment relaunch. GitHub's
   `releases/latest` redirect can lag the first minute after publishing; a first launch then reports "up to date".
6. Layer 2 is a decision, not a step: publish a `production` row for `desktop` (Admin › Releases) only when
   older apps must stop (`urgent` blocks now, `normal` from the next start). 5.3.1 needed none.
