/**
 * Corrected kernel closure: apps/cli is a LEAF (its manifest deps exist for
 * runtime bundle resolution and are trimmed separately, not followed).
 * Also reports, for every dev-only addition, which kept package references it.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('D:/dsh/deepseek-harness');

function enumeratePackages() {
  const dirs = [];
  const push = (rel) => { const abs = join(ROOT, rel); if (existsSync(join(abs, 'package.json'))) dirs.push(rel); };
  for (const d of readdirSync(join(ROOT, 'vendor'), { withFileTypes: true }))
    if (d.isDirectory()) push(`vendor/${d.name}`);
  for (const g of readdirSync(join(ROOT, 'packages'), { withFileTypes: true }))
    if (g.isDirectory())
      for (const p of readdirSync(join(ROOT, 'packages', g.name), { withFileTypes: true }))
        if (p.isDirectory()) push(`packages/${g.name}/${p.name}`);
  push('native/landlock-run');
  const nl = join(ROOT, 'native/landlock-run/packages');
  if (existsSync(nl))
    for (const p of readdirSync(nl, { withFileTypes: true }))
      if (p.isDirectory()) push(`native/landlock-run/packages/${p.name}`);
  for (const d of readdirSync(join(ROOT, 'apps'), { withFileTypes: true }))
    if (d.isDirectory()) push(`apps/${d.name}`);
  push('website');
  push('python/sdk-runtime');
  return dirs;
}

const packages = new Map();
for (const dir of enumeratePackages()) {
  const pkg = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'));
  if (!pkg.name) continue;
  packages.set(pkg.name, {
    dir,
    deps: Object.keys(pkg.dependencies ?? {}),
    devDeps: Object.keys(pkg.devDependencies ?? {}),
    peerDeps: Object.keys(pkg.peerDependencies ?? {}),
    optionalDeps: Object.keys(pkg.optionalDependencies ?? {}),
    pkg,
  });
}
const isWorkspace = (name) => packages.has(name);

function closure(roots, edgeKinds, { skipEdgesFrom = new Set(), referrers = null } = {}) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    if (skipEdgesFrom.has(name)) continue;
    const entry = packages.get(name);
    if (!entry) continue;
    for (const k of edgeKinds) {
      for (const n of (entry[k] ?? [])) {
        if (!isWorkspace(n)) continue;
        if (referrers && !seen.has(n)) {
          if (!referrers.has(n)) referrers.set(n, new Set());
          referrers.get(n).add(`${name} (${k})`);
        }
        if (!seen.has(n)) queue.push(n);
      }
    }
  }
  return seen;
}

const CLI = '@deepseek-ai/dsh';

// Pass 1: kernel runtime closure from the two bundles
const runtime = closure(
  ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-headless'],
  ['deps', 'peerDeps', 'optionalDeps'],
);

// Pass 2: CLI leaf + its source imports (follow edges from those, not from CLI)
const cliSourceNeeds = [
  '@deepseek-ai/dsh-app-boot', '@deepseek-ai/dsh-cmdline', '@deepseek-ai/dsh-home-paths',
  '@deepseek-ai/dsh-http-proxy', '@deepseek-ai/dsh-launch-environment',
  '@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/cordis-plugin-include',
  '@deepseek-ai/cordis-plugin-hmr', '@deepseek-ai/cordis-plugin-timer',
];
const cliClosure = closure(cliSourceNeeds, ['deps', 'peerDeps', 'optionalDeps']);

// Pass 3: build-time (tsdown.config.ts imports the typert generator)
const buildClosure = closure(['@deepseek-ai/dsh-typert-generator'], ['deps', 'peerDeps', 'optionalDeps']);

const core = new Set([...runtime, ...cliClosure, ...buildClosure, CLI]);

// Pass 4: dev closure from core (skip CLI edges — its tests target deleted profiles)
const referrers = new Map();
const withDev = closure([...core], ['deps', 'peerDeps', 'optionalDeps', 'devDeps'],
  { skipEdgesFrom: new Set([CLI]), referrers });

const devOnly = [...withDev].filter((n) => !core.has(n)).sort();
const kept = [...withDev].sort();
const deleted = [...packages.keys()].filter((n) => !withDev.has(n)).sort();

console.log(`workspace packages: ${packages.size}`);
console.log(`runtime closure (base+headless): ${runtime.size}`);
console.log(`+ cli source needs: +${[...cliClosure].filter((n) => !runtime.has(n)).length}`);
console.log(`+ build (typert-generator): +${[...buildClosure].filter((n) => !runtime.has(n) && !cliClosure.has(n)).length}`);
console.log(`+ dev/test additions: +${devOnly.length}`);
console.log(`KEEP: ${kept.length}   DELETE: ${deleted.length}`);

console.log('\n=== DEV-ONLY ADDITIONS (referrers) ===');
for (const n of devOnly) {
  const refs = [...(referrers.get(n) ?? [])].join(', ');
  console.log(`  ${n}\n      <- ${refs}`);
}

console.log('\n=== DELETE LIST by dir ===');
const groups = new Map();
for (const n of deleted) {
  const dir = packages.get(n).dir;
  const g = dir.split('/').slice(0, -1).join('/') || '(root)';
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(n);
}
for (const [g, items] of [...groups.entries()].sort()) {
  console.log(`\n[${g}] (${items.length})`);
  for (const n of items) console.log(`  ${n}`);
}

// Which groups are fully/partially kept — for the report
console.log('\n=== KEEP by dir ===');
const kg = new Map();
for (const n of kept) {
  const dir = packages.get(n).dir;
  const g = dir.split('/').slice(0, -1).join('/') || '(root)';
  if (!kg.has(g)) kg.set(g, []);
  kg.get(g).push(n);
}
for (const [g, items] of [...kg.entries()].sort()) {
  console.log(`[${g}] (${items.length})`);
}

writeFileSync('D:/dsh/trim-report.json', JSON.stringify({
  totals: { workspace: packages.size, keep: kept.length, delete: deleted.length },
  keep, delete: deleted,
  devOnly,
  keepDirs: [...kg.entries()].map(([g, items]) => ({ group: g, packages: items })),
  deleteDirs: [...groups.entries()].map(([g, items]) => ({ group: g, packages: items })),
}, null, 2));
console.log('\nWritten: D:/dsh/trim-report.json');
