# Workspace license references

Some published napi-rs crates omit license text from their tarballs. These MIT
LICENSE files are fetched from the exact workspace Git SHA in each locked crate's
`.cargo_vcs_info.json`, from
`https://raw.githubusercontent.com/napi-rs/napi-rs/<SHA>/LICENSE` on2026-10-19.
The notices generator includes them in THIRD_PARTY_NOTICES.txt. Other crate
license texts come from Cargo's checksum-verified registry source archives.
