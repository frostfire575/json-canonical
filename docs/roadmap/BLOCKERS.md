# Blockers

No local implementation blocker. Linux x64 and macOS ARM64 release verification
requires hosted CI or an available target runtime. Docker29.7.2 client is present
but `docker version --format json` reports no Linux server/daemon. `wsl --list --quiet`
lists only docker-desktop, with no independent Linux development distro. No Docker
Desktop/service startup or global SDK installation has been performed. macOS ARM64
is unavailable. CI definitions can be checked locally, but successful remote jobs
remain required. No remote push/publication/release is authorized.
