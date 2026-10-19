'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version', '1'], { cwd: root, encoding: 'utf8' }));
const packages = metadata.packages.filter(pkg => pkg.source?.startsWith('registry+')).sort((a, b) => a.name.localeCompare(b.name));
let output = 'Third-party Rust dependency notices (build and runtime inventory)\n\n';
for (const pkg of packages) {
  const directory = path.dirname(pkg.manifest_path);
  const files = fs.readdirSync(directory).filter(name => /^(licen[cs]e|copying|notice)/i.test(name) && fs.statSync(path.join(directory, name)).isFile()).sort();
  let fallback;
  if (!files.length && pkg.repository === 'https://github.com/napi-rs/napi-rs') {
    const info = JSON.parse(fs.readFileSync(path.join(directory, '.cargo_vcs_info.json'), 'utf8'));
    fallback = path.join(root, 'upstream/licenses', `napi-rs-${info.git.sha1}-LICENSE`);
    if (!fs.existsSync(fallback)) throw new Error(`Vendored pinned workspace license missing: ${fallback}`);
  }
  if (!files.length && !fallback) throw new Error(`License text missing for ${pkg.name}@${pkg.version}`);
  output += `\n${'='.repeat(72)}\n${pkg.name}@${pkg.version}\nSPDX: ${pkg.license}\nSource: https://crates.io/crates/${pkg.name}/${pkg.version}\n`;
  for (const file of files) output += `\n--- ${file} ---\n${fs.readFileSync(path.join(directory, file), 'utf8').replace(/\r\n/g, '\n')}\n`;
  if (fallback) output += `\n--- pinned napi-rs workspace LICENSE ---\n${fs.readFileSync(fallback, 'utf8')}\n`;
}
fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.txt'), output);
console.log(`Preserved license texts for ${packages.length} locked Rust packages`);
