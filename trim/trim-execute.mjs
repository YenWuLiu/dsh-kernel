/**
 * Trim deepseek-harness to the kernel workspace at D:\dsh\dsh-kernel.
 *
 * Keep set = closure(dsh-base, dsh-headless) + CLI boot glue + typert-generator
 * (build) + dev/test referents + {persona, tool-ask-user, agent-tool-presentation}
 * (agent-plane presets). Copies kept packages, rewrites root configs, trims the
 * CLI manifest/tsconfig/tests, and writes the keep/delete report.
 */
import {
  readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync,
  cpSync, copyFileSync, rmSync,
} from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const SRC = resolve('D:/dsh/deepseek-harness');
const OUT = resolve('D:/dsh/dsh-kernel');

// ── 1. Recompute the keep set ────────────────────────────────────────────────
function enumeratePackages() {
  const dirs = [];
  const push = (rel) => { if (existsSync(join(SRC, rel, 'package.json'))) dirs.push(rel); };
  for (const d of readdirSync(join(SRC, 'vendor'), { withFileTypes: true }))
    if (d.isDirectory()) push(`vendor/${d.name}`);
  for (const g of readdirSync(join(SRC, 'packages'), { withFileTypes: true }))
    if (g.isDirectory())
      for (const p of readdirSync(join(SRC, 'packages', g.name), { withFileTypes: true }))
        if (p.isDirectory()) push(`packages/${g.name}/${p.name}`);
  push('native/landlock-run');
  const nl = join(SRC, 'native/landlock-run/packages');
  if (existsSync(nl))
    for (const p of readdirSync(nl, { withFileTypes: true }))
      if (p.isDirectory()) push(`native/landlock-run/packages/${p.name}`);
  for (const d of readdirSync(join(SRC, 'apps'), { withFileTypes: true }))
    if (d.isDirectory()) push(`apps/${d.name}`);
  push('website');
  push('python/sdk-runtime');
  return dirs;
}

const packages = new Map(); // name -> {dir, ...}
const dirToName = new Map();
for (const dir of enumeratePackages()) {
  const pkg = JSON.parse(readFileSync(join(SRC, dir, 'package.json'), 'utf8'));
  if (!pkg.name) continue;
  packages.set(pkg.name, {
    dir, pkg,
    deps: Object.keys(pkg.dependencies ?? {}),
    devDeps: Object.keys(pkg.devDependencies ?? {}),
    peerDeps: Object.keys(pkg.peerDependencies ?? {}),
    optionalDeps: Object.keys(pkg.optionalDependencies ?? {}),
  });
  dirToName.set(dir, pkg.name);
}
const isWs = (n) => packages.has(n);

function closure(roots, kinds, skip = new Set()) {
  const seen = new Set(); const q = [...roots];
  while (q.length) {
    const n = q.shift();
    if (seen.has(n)) continue;
    seen.add(n);
    if (skip.has(n)) continue;
    const e = packages.get(n);
    if (!e) continue;
    for (const k of kinds) for (const d of e[k] ?? []) if (isWs(d) && !seen.has(d)) q.push(d);
  }
  return seen;
}

const CLI = '@deepseek-ai/dsh';
const runtime = closure(['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-headless'], ['deps', 'peerDeps', 'optionalDeps']);
const cliGlue = closure([
  '@deepseek-ai/dsh-app-boot', '@deepseek-ai/dsh-cmdline', '@deepseek-ai/dsh-home-paths',
  '@deepseek-ai/dsh-http-proxy', '@deepseek-ai/dsh-launch-environment',
  '@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/cordis-plugin-include',
  '@deepseek-ai/cordis-plugin-hmr', '@deepseek-ai/cordis-plugin-timer',
], ['deps', 'peerDeps', 'optionalDeps']);
const buildTime = closure(['@deepseek-ai/dsh-typert-generator'], ['deps', 'peerDeps', 'optionalDeps']);
const agentPlane = closure(
  ['@deepseek-ai/dsh-persona', '@deepseek-ai/dsh-tool-ask-user', '@deepseek-ai/dsh-agent-tool-presentation'],
  ['deps', 'peerDeps', 'optionalDeps'],
);
const core = new Set([...runtime, ...cliGlue, ...buildTime, ...agentPlane, CLI]);
const withDev = closure([...core], ['deps', 'peerDeps', 'optionalDeps', 'devDeps'], new Set([CLI]));

const KEEP = withDev;
const DELETE = [...packages.keys()].filter((n) => !KEEP.has(n));
const keptDirs = new Set([...KEEP].map((n) => packages.get(n).dir));

console.log(`KEEP ${KEEP.size} / DELETE ${DELETE.size} (of ${packages.size})`);

// ── 2. Reset output dir ──────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ── 3. Copy kept packages ────────────────────────────────────────────────────
const SKIP_ENTRIES = new Set(['node_modules', 'lib', 'dist', '.turbo']);
for (const name of KEEP) {
  const { dir } = packages.get(name);
  const from = join(SRC, dir);
  const to = join(OUT, dir);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, {
    recursive: true,
    filter: (src) => !SKIP_ENTRIES.has(src.split(/[\\/]/).pop()),
  });
}

// ── 4. Root config rewrites ──────────────────────────────────────────────────
// 4a. root package.json
const rootPkg = JSON.parse(readFileSync(join(SRC, 'package.json'), 'utf8'));
const newRootPkg = {
  name: '@deepseek-ai/dsh-kernel-root',
  version: rootPkg.version,
  license: 'MIT',
  private: true,
  type: 'module',
  packageManager: rootPkg.packageManager,
  engines: rootPkg.engines,
  workspaces: ['vendor/*', 'packages/*/*', 'native/landlock-run/packages/*', 'apps/cli'],
  scripts: {
    build: 'npm run build:lib:host',
    'build:lib:host': 'node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc -b tsconfig.host.json && tsdown --env.DSH_BUILD_FACE host',
    clean: 'tsx scripts/clean.ts',
    'gen-tsconfig-paths': 'tsx scripts/gen-tsconfig-paths.ts',
    'verify-tsconfig-paths': 'tsx scripts/gen-tsconfig-paths.ts --check',
    typecheck: 'npm run build:lib:host',
    test: 'vitest run',
    'test:coverage': 'vitest run --coverage',
    dsh: 'node --import tsx/esm apps/cli/src/bin.ts',
  },
  devDependencies: {
    '@types/js-yaml': rootPkg.devDependencies['@types/js-yaml'],
    '@types/node': rootPkg.devDependencies['@types/node'],
    '@vitest/coverage-v8': rootPkg.devDependencies['@vitest/coverage-v8'],
    execa: rootPkg.devDependencies.execa,
    'fast-check': rootPkg.devDependencies['fast-check'],
    'js-yaml': rootPkg.devDependencies['js-yaml'],
    tsdown: rootPkg.devDependencies.tsdown,
    tsx: rootPkg.devDependencies.tsx,
    typescript: rootPkg.devDependencies.typescript,
    'vite-tsconfig-paths': rootPkg.devDependencies['vite-tsconfig-paths'],
    vitest: rootPkg.devDependencies.vitest,
  },
};
writeFileSync(join(OUT, 'package.json'), JSON.stringify(newRootPkg, null, 2) + '\n');

// 4b. pnpm-workspace.yaml
const wsYaml = `# Kernel-trimmed workspace: see KERNEL.md for the keep/delete report.
packages:
  - vendor/*
  - packages/*/*
  - native/landlock-run/packages/*
  - apps/cli

linkWorkspacePackages: true

overrides:
  '@deepseek-ai/cosmokit': 'link:vendor/cosmokit'
  '@deepseek-ai/schemastery': 'link:vendor/schemastery'

peerDependencyRules:
  allowedVersions:
    typescript: '>=5 <7'

allowBuilds:
  esbuild: true
  node-pty: true
  '@google/genai': false
  protobufjs: false
  node-addon-require-builtin: false
  koffi: true
  '@deepseek-ai/dsh-subprocess-local@file:packages/subprocess/subprocess-local': true

minimumReleaseAgeExclude:
  - '@earendil-works/pi-ai@0.84.2'
  - node-addon-native-custom-loader@0.1.4
  - node-addon-require-builtin-darwin-arm64@0.1.4
  - node-addon-require-builtin-darwin-x64@0.1.4
  - node-addon-require-builtin-linux-arm64-gnu@0.1.4
  - node-addon-require-builtin-linux-x64-gnu@0.1.4
  - node-addon-require-builtin-win32-arm64-msvc@0.1.4
  - node-addon-require-builtin-win32-ia32-msvc@0.1.4
  - node-addon-require-builtin-win32-x64-msvc@0.1.4
  - node-addon-require-builtin@0.1.4

patchedDependencies:
  node-pty@1.2.0-beta.15: patches/node-pty@1.2.0-beta.15.patch
`;
writeFileSync(join(OUT, 'pnpm-workspace.yaml'), wsYaml);

// 4c. tsconfig.base.json — drop path entries pointing at deleted dirs
function filterTsconfigPaths(text) {
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) {
    const m = line.match(/^\s*"@[^"]+":\s*\["(\.[^"]+)"\]/);
    if (m) {
      // Map the aliased target back to a package dir by longest-prefix match.
      const target = m[1];
      let best = null;
      for (const dir of enumerateAllSourceDirs()) {
        if (target.startsWith('./' + dir + '/') || target === './' + dir) {
          if (!best || dir.length > best.length) best = dir;
        }
      }
      if (best && !keptDirs.has(best)) continue; // drop: deleted package
    }
    out.push(line);
  }
  return out.join('\n');
}
let allDirsCache = null;
function enumerateAllSourceDirs() {
  if (allDirsCache) return allDirsCache;
  allDirsCache = [...dirToName.keys()];
  return allDirsCache;
}
writeFileSync(
  join(OUT, 'tsconfig.base.json'),
  filterTsconfigPaths(readFileSync(join(SRC, 'tsconfig.base.json'), 'utf8')),
);

// 4d. tsconfig.host.json — drop references to deleted dirs and dead includes
function filterHostTsconfig(text) {
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) {
    const ref = line.match(/\{\s*"path":\s*"(\.[^"]+)"\s*\}/);
    if (ref) {
      const target = ref[1];
      let best = null;
      for (const dir of enumerateAllSourceDirs()) {
        if (target.startsWith('./' + dir + '/') || target === './' + dir) {
          if (!best || dir.length > best.length) best = dir;
        }
      }
      if (best && !keptDirs.has(best)) continue;
      out.push(line);
      continue;
    }
    if (/"(apps\/web|website)/.test(line)) continue;
    out.push(line);
  }
  return out.join('\n');
}
writeFileSync(
  join(OUT, 'tsconfig.host.json'),
  filterHostTsconfig(readFileSync(join(SRC, 'tsconfig.host.json'), 'utf8')),
);

// 4e. solution tsconfig — host only
writeFileSync(join(OUT, 'tsconfig.json'), `{
  "extends": "./tsconfig.base.json",
  "files": [],
  "references": [
    { "path": "./tsconfig.host.json" }
  ]
}
`);

// 4f. static root files
for (const f of ['tsdown.config.ts', 'vitest.config.ts', 'vitest.shared.ts', '.gitignore', '.editorconfig', 'LICENSE']) {
  copyFileSync(join(SRC, f), join(OUT, f));
}
// Upstream readme kept for provenance; kernel readme written below.
copyFileSync(join(SRC, 'README.md'), join(OUT, 'README.upstream.md'));

// 4g. patches — only node-pty (subprocess-local depends on node-pty)
mkdirSync(join(OUT, 'patches'), { recursive: true });
copyFileSync(
  join(SRC, 'patches', 'node-pty@1.2.0-beta.15.patch'),
  join(OUT, 'patches', 'node-pty@1.2.0-beta.15.patch'),
);

// ── 5. Trim apps/cli ─────────────────────────────────────────────────────────
const cliDir = join(OUT, 'apps/cli');
const cliPkg = JSON.parse(readFileSync(join(SRC, 'apps/cli/package.json'), 'utf8'));

// Preset rows resolve from the CLI installation, so direct deps cover the
// boot glue, both bundles, and every kept package the shipped presets mount.
const PRESET_REFERENCED = [
  '@deepseek-ai/dsh-persona', '@deepseek-ai/dsh-agent-instructions',
  '@deepseek-ai/dsh-agent-tool-presentation', '@deepseek-ai/dsh-plan-mode',
  '@deepseek-ai/dsh-skill-filesystem', '@deepseek-ai/dsh-tool-skill',
  '@deepseek-ai/dsh-tool-goal', '@deepseek-ai/dsh-tool-jobs', '@deepseek-ai/dsh-tool-todo',
  '@deepseek-ai/dsh-tool-web', '@deepseek-ai/dsh-tool-bash', '@deepseek-ai/dsh-tool-pwsh',
  '@deepseek-ai/dsh-tool-fs', '@deepseek-ai/dsh-tool-fs-search',
  '@deepseek-ai/dsh-tool-subagent', '@deepseek-ai/dsh-tool-subagent-control',
  '@deepseek-ai/dsh-tool-workflow', '@deepseek-ai/dsh-tool-ralph',
  '@deepseek-ai/dsh-tool-ask-user', '@deepseek-ai/dsh-workflow-worker-thread',
  '@deepseek-ai/dsh-command-compact', '@deepseek-ai/dsh-command-goal',
  '@deepseek-ai/dsh-compaction-basic', '@deepseek-ai/dsh-compaction-tool-result-pruner',
];
const CLI_BOOT = [
  '@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-hmr', '@deepseek-ai/cordis-plugin-include',
  '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/cordis-plugin-timer',
  '@deepseek-ai/dsh-app-boot', '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-cmdline',
  '@deepseek-ai/dsh-headless', '@deepseek-ai/dsh-home-paths', '@deepseek-ai/dsh-http-proxy',
  '@deepseek-ai/dsh-launch-environment',
];
const cliDeps = {};
for (const n of [...CLI_BOOT, ...PRESET_REFERENCED].sort()) {
  if (!KEEP.has(n)) { console.error(`CLI dep not in keep set: ${n}`); process.exitCode = 1; continue; }
  cliDeps[n] = 'workspace:^';
}
cliDeps['commander'] = cliPkg.dependencies['commander'];
cliDeps['js-yaml'] = cliPkg.dependencies['js-yaml'];
cliDeps['node-addon-require-builtin'] = cliPkg.dependencies['node-addon-require-builtin'];
cliPkg.dependencies = cliDeps;
cliPkg.devDependencies = {
  '@types/js-yaml': cliPkg.devDependencies['@types/js-yaml'],
  execa: cliPkg.devDependencies.execa,
};
cliPkg.scripts = { build: 'tsdown' };
writeFileSync(join(cliDir, 'package.json'), JSON.stringify(cliPkg, null, 2) + '\n');

// CLI tsconfig: keep only references to kept dirs
const cliTsconfig = JSON.parse(readFileSync(join(SRC, 'apps/cli/tsconfig.json'), 'utf8'));
cliTsconfig.references = cliTsconfig.references.filter((r) => {
  const rel = r.path.replace(/^\.\.\/\.\.\//, '');
  let best = null;
  for (const dir of enumerateAllSourceDirs()) {
    if (rel === dir || rel.startsWith(dir + '/')) if (!best || dir.length > best.length) best = dir;
  }
  return best && keptDirs.has(best);
});
writeFileSync(join(cliDir, 'tsconfig.json'), JSON.stringify(cliTsconfig, null, 2) + '\n');

// CLI src: drop the sdk-only patch asset (sdk bundles are deleted)
rmSync(join(cliDir, 'src/sdk-source.cordis.patch.yml'), { force: true });

// CLI tests: keep a spec only when every @deepseek-ai import resolves to KEEP.
const testsDir = join(cliDir, 'tests');
const keptTests = [];
const droppedTests = [];
for (const f of readdirSync(testsDir, { withFileTypes: true })) {
  if (!f.isFile() || !f.name.endsWith('.ts')) continue;
  const text = readFileSync(join(testsDir, f.name), 'utf8');
  const imports = [...text.matchAll(/from\s+['"](@deepseek-ai\/[^'"]+)['"]/g)].map((m) => m[1]);
  const npmBanned = /from\s+['"](ws|@agentclientprotocol\/sdk)['"]/.test(text);
  const ok = !npmBanned && imports.every((spec) => {
    const base = spec.split('/').slice(0, 2).join('/');
    return KEEP.has(base);
  });
  (ok ? keptTests : droppedTests).push(f.name);
  if (!ok) rmSync(join(testsDir, f.name), { force: true });
}
// Fixture data is inert unless a dropped suite loads it; keep the directories.
// Suites importing deleted packages are gone above, so stale fixtures never load.

// ── 6. scripts/ whitelist with transitive local imports ─────────────────────
const SCRIPT_WHITELIST = [
  'gen-tsconfig-paths.ts', 'clean.ts', 'coverage-exempt.ts', 'coverage-partitions.ts',
  'test-proxy-environment.ts', 'test-invariants.ts', 'coverage-uncovered-locations.cjs',
];
mkdirSync(join(OUT, 'scripts'), { recursive: true });
const copiedScripts = new Set();
const scriptQueue = [...SCRIPT_WHITELIST];
while (scriptQueue.length) {
  const rel = scriptQueue.shift();
  if (copiedScripts.has(rel)) continue;
  const abs = join(SRC, 'scripts', rel);
  if (!existsSync(abs)) { console.error(`script missing upstream: ${rel}`); continue; }
  copiedScripts.add(rel);
  mkdirSync(dirname(join(OUT, 'scripts', rel)), { recursive: true });
  copyFileSync(abs, join(OUT, 'scripts', rel));
  if (rel.endsWith('.ts')) {
    const text = readFileSync(abs, 'utf8');
    for (const m of text.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
      let target = m[1].replace(/^\.\//, '');
      if (m[1].startsWith('../')) continue; // outside scripts/
      if (!target.endsWith('.ts') && !target.endsWith('.cjs')) target += '.ts';
      if (!copiedScripts.has(target)) scriptQueue.push(target);
    }
  }
}
console.log(`scripts copied: ${[...copiedScripts].join(', ')}`);

// ── 7. Curated docs ─────────────────────────────────────────────────────────
const DOC_KEEP = ['architecture.md', 'cordis-primer.md', 'glossary.md', 'development.md', 'testing.md', 'defensive-patterns.md'];
mkdirSync(join(OUT, 'docs'), { recursive: true });
for (const d of DOC_KEEP) {
  const abs = join(SRC, 'docs', d);
  if (existsSync(abs)) copyFileSync(abs, join(OUT, 'docs', d));
}

// ── 8. Report + kernel README ────────────────────────────────────────────────
const groupOf = (dir) => dir.split('/').slice(0, -1).join('/') || '(root)';
const byGroup = (names) => {
  const m = new Map();
  for (const n of [...names].sort()) {
    const g = groupOf(packages.get(n).dir);
    if (!m.has(g)) m.set(g, []);
    m.get(g).push(n);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
};
const keepReport = byGroup(KEEP).map(([g, items]) => ({ group: g, packages: items }));
const deleteReport = byGroup(DELETE).map(([g, items]) => ({ group: g, packages: items }));
writeFileSync(join('D:/dsh', 'trim-report.json'), JSON.stringify({
  totals: { upstream: packages.size, keep: KEEP.size, delete: DELETE.length },
  keep: keepReport, delete: deleteReport,
  cliTestsKept: keptTests, cliTestsDropped: droppedTests,
}, null, 2));
console.log(`CLI tests kept: ${keptTests.join(', ') || '(none)'}`);
console.log(`CLI tests dropped: ${droppedTests.length}`);
console.log('DONE');
