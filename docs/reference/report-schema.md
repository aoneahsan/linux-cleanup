# Report JSON schema

> Every linux-cleanup session writes a canonical, versioned JSON report. This document is the schema spec. The current version is **`linux-cleanup/report/v1`** (since 1.0.0; backwards-compatible additions in 1.2.x and 1.3.0).

---

## Top-level

```jsonc
{
  "schema": "linux-cleanup/report/v1",
  "tool":      { /* see below */ },
  "session":   { /* see below */ },
  "categories":[ /* see below */ ]
}
```

| Key | Type | Notes |
|---|---|---|
| `schema` | string | Version sentinel. Consumers should reject anything that doesn't start with `linux-cleanup/report/`. |
| `tool` | object | Information about the tool invocation itself (version, mode, host, user). |
| `session` | object | High-level session totals (start / end time, disk-free deltas). |
| `categories` | array&lt;object&gt; | One object per category that ran. Empty for read-only modes that don't produce per-category data. |

---

## `tool`

```jsonc
{
  "version":  "1.3.0",
  "started":  "2026-05-10T14:03:12+00:00",
  "finished": "2026-05-10T14:08:55+00:00",
  "mode":     "walkthrough",
  "host":     "thinkpad-x1",
  "user":     "ahsan",
  "via_npx":  false
}
```

| Key | Type | Notes |
|---|---|---|
| `version` | string | The linux-cleanup version that wrote the report. Use this to gate consumer logic. |
| `started` / `finished` | ISO 8601 | Wall-clock at session start / end. |
| `mode` | string | The mode that ran: `walkthrough`, `menu`, `tui`, `allsafe`, `scan`, `system`, `partials`, `audit`, `nodemod`, `globals`, `editorext`, `stale`. |
| `host` | string | `hostname` output. |
| `user` | string | `$USER`. |
| `via_npx` | bool | `true` when run via the npm/npx launcher; `false` for direct git-clone / source runs. |

---

## `session`

```jsonc
{
  "disk_before_avail_bytes": 84129843200,
  "disk_after_avail_bytes":  104235692032,
  "recovered_bytes":         20105848832,
  "recovered_human":         "18.7 GB",
  "errors": []
}
```

| Key | Type | Notes |
|---|---|---|
| `disk_before_avail_bytes` | int | `df --output=avail -B1 /` at session start. |
| `disk_after_avail_bytes` | int | Same query at session end. |
| `recovered_bytes` | int | `disk_after - disk_before`. May be negative if other processes wrote during the session. |
| `recovered_human` | string | Human-readable formatting of `recovered_bytes`. |
| `errors` | array&lt;string&gt; | Non-fatal errors encountered. Normally empty. |

---

## `categories[]`

Each category entry follows:

```jsonc
{
  "name": "package_manager_caches",
  "candidates": [
    {
      "path":       "/home/ahsan/.cache/yarn",
      "size_bytes": 13315108864,
      "atime_iso":  "2025-12-27T18:42:18+00:00",
      "mtime_iso":  "2025-12-27T18:42:18+00:00",
      "idle_days":  134,
      "verdict":    "delete",
      "kept_reason": null
    }
  ],
  "actions": [
    {
      "path":      "/home/ahsan/.cache/yarn",
      "deleted":   true,
      "bytes":     13315108864,
      "duration_ms": 421
    }
  ],
  "totals": {
    "candidates_count": 5,
    "deleted_count":    4,
    "kept_count":       1,
    "bytes_deleted":    20300000000
  }
}
```

| Key | Type | Notes |
|---|---|---|
| `name` | string | Stable category identifier. See [category names](#category-names). |
| `candidates[].path` | string | Absolute path. |
| `candidates[].size_bytes` | int | `du -sb` at scan time. |
| `candidates[].atime_iso` / `mtime_iso` | ISO 8601 | Timestamps. |
| `candidates[].idle_days` | int | `min(now - atime, now - mtime) / 86400`. |
| `candidates[].verdict` | string | `delete` / `keep` / `skip`. |
| `candidates[].kept_reason` | string \| null | When `verdict = keep`: one of `staleness_gate`, `user_declined`, `protected_path`, `not_installed`, `dependency_active`. |
| `actions[].deleted` | bool | Whether `safe_rm` actually completed. |
| `actions[].bytes` | int | Bytes reclaimed by this single action. |
| `actions[].duration_ms` | int | Wall-clock for the deletion. |
| `totals` | object | Summary across all candidates / actions in this category. |

---

## Category names

Stable identifiers across versions:

| Identifier | Maps to |
|---|---|
| `package_manager_caches` | yarn, npm, pnpm, pip, composer caches |
| `app_caches` | Chrome / Brave / Firefox / Gradle / Cypress / Playwright / Zoom / VSCode caches |
| `dev_tool_data` | Android AVDs, pub-cache, dart analysis, flatpak user data |
| `editor_extensions` | Superseded VS Code / Cursor versions |
| `system_sudo` | apt, journal, snap, kernels, /tmp aging, page cache |
| `personal_stale` | Files in `~/Downloads` etc. unused N+ days |
| `partial_downloads` | `*.fdmdownload`, `*.crdownload`, `*.part` |
| `home_audit` | Top 20 entries (read-only, candidates only) |
| `node_modules` | Stale project `node_modules/` |
| `global_packages` | Read-only globals audit (npm/pnpm/yarn/bun/deno) |

---

## Forwards compatibility

A 1.x consumer parsing a 1.x report should:

- Treat unknown keys as additive (don't reject).
- Branch on `tool.mode` and `tool.version` for behaviour-affecting differences.
- Treat `kept_reason` strings as a closed set; new values may appear in patch versions but never invalidate existing names.

A future major schema bump (`linux-cleanup/report/v2`) is not currently planned. If it happens, the v1 reader will keep working on v1 reports.

---

## Validation

There's no shipped JSON Schema file in v1.3.0. To do strict validation:

```bash
jq -e 'has("schema") and (.schema | startswith("linux-cleanup/report/")) and has("tool") and has("session") and has("categories")' \
  ~/.linux-cleanup/reports/report-2026-05-10_*.json
```

A clean run prints `true`.

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
