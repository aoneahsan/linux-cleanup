# Security

linux-cleanup deletes files. A bug that lets it delete outside its targets —
past the protected-path guard, through a symlink, or during a `--dry-run` — is a
security issue, and so is anything that makes it send data off the machine.

## Reporting

Email **aoneahsan@gmail.com** with "linux-cleanup security" in the subject.
Include the version (`linux-cleanup --version`), your distro, the exact command,
and a `--debug-bundle` if you can make one without exposing private paths.
Please do not open a public issue for these.

You will get a reply within a week. A confirmed issue is fixed in a release
published with `urgency=urgent` in `release/stable.env`, which stops every older
copy at its next start until it is updated.

## Supported versions

Only the latest 2.x release gets fixes.
