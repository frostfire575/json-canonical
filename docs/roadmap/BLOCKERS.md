# Blockers

No local implementation blocker. Linux x64 and macOS ARM64 release verification
requires hosted CI or an available target runtime. Docker29.7.2 client is present
but `docker version --format json` reports no Linux server/daemon. `wsl --list --quiet`
lists only docker-desktop, with no independent Linux development distro. No Docker
Desktop/service startup or global SDK installation has been performed. macOS ARM64
is unavailable. CI definitions can be checked locally, but successful remote jobs
remain required. No remote push/publication/release is authorized.

Current readiness blockers reconfirmed2026-10-19: only genuine Windowsx64addon
exists. Docker client29.7.2 still has no server; WSL has onlydocker-desktop; no
macOS runtime. `git remote` lists no configured remote, so no existing hosted
workflow can execute this localsource. No push or global service startup is
authorized. Combinedschema2candidate gate intentionally rejects absentLinux/
macOS artifacts. Foreign-header unit vectors are never distribution binaries.
