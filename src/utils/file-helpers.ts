import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

/** Cached parsed package.json — avoids re-reading/re-parsing on every pkgHas call */
const pkgJsonCache = new Map<string, { deps: Set<string>; raw: string }>();

function getPkgData(projectDir: string): { deps: Set<string>; raw: string } | null {
    if (pkgJsonCache.has(projectDir)) return pkgJsonCache.get(projectDir)!;
    const f = findPackageJson(projectDir);
    if (!f) return null;
    const raw = readFileSync(f, 'utf-8');
    const deps = new Set<string>();
    try {
        const pkg = JSON.parse(raw);
        for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
            if (pkg[section] && typeof pkg[section] === 'object') {
                for (const name of Object.keys(pkg[section])) deps.add(name);
            }
        }
    } catch { /* malformed JSON — fall back to empty */ }
    const result = { deps, raw };
    pkgJsonCache.set(projectDir, result);
    return result;
}

/** v14.2: Check if package.json dependency sections contain a package (parsed JSON, not regex) */
export function pkgHas(projectDir: string, pkg: string): boolean {
    const data = getPkgData(projectDir);
    if (!data) return false;
    return data.deps.has(pkg);
}

/** Extract version of a dependency from package.json */
export function pkgVersion(projectDir: string, pkg: string): string {
    const f = findPackageJson(projectDir);
    if (!f) return '';
    const content = readFileSync(f, 'utf-8');
    const m = content.match(new RegExp(`"${escapeRegex(pkg)}"\\s*:\\s*"([^"]+)"`));
    if (!m) return '';
    return m[1].replace(/[^0-9.].*$/, '');
}

/** Extract package name from package.json */
export function pkgName(projectDir: string): string {
    const f = findPackageJson(projectDir);
    if (!f) return '';
    const content = readFileSync(f, 'utf-8');
    const m = content.match(/"name"\s*:\s*"([^"]+)"/);
    return m ? m[1] : '';
}

/** Check if pubspec.yaml contains a dependency */
export function pubspecHas(projectDir: string, pkg: string): boolean {
    const pubspec = join(projectDir, 'pubspec.yaml');
    if (!existsSync(pubspec)) return false;
    const content = readFileSync(pubspec, 'utf-8');
    return new RegExp(`^\\s+${escapeRegex(pkg)}\\s*:`, 'm').test(content);
}

/** Check if any gradle file contains a pattern */
export function gradleHas(projectDir: string, pattern: string): boolean {
    return findFilesRecursive(projectDir, 3, f =>
        f.endsWith('.gradle') || f.endsWith('.gradle.kts')
    ).some(f => {
        const content = readFileSync(f, 'utf-8');
        return new RegExp(pattern).test(content);
    });
}

/** Check if Package.swift contains a string */
export function swiftPkgHas(projectDir: string, pattern: string): boolean {
    const pkg = join(projectDir, 'Package.swift');
    if (!existsSync(pkg)) return false;
    const content = readFileSync(pkg, 'utf-8');
    return new RegExp(pattern).test(content);
}

/** Find package.json, checking src/package.json as fallback */
export function findPackageJson(projectDir: string): string | null {
    const primary = join(projectDir, 'package.json');
    if (existsSync(primary)) return primary;
    const fallback = join(projectDir, 'src', 'package.json');
    if (existsSync(fallback)) return fallback;
    return null;
}

/** Read file content or return empty string */
export function readFileSafe(filePath: string): string {
    try { return readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

/** Recursively find files up to maxDepth */
export function findFilesRecursive(
    dir: string, maxDepth: number, filter: (f: string) => boolean, depth = 0
): string[] {
    if (depth > maxDepth || !existsSync(dir)) return [];
    const results: string[] = [];
    try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.name === 'node_modules' || entry.name === '.dart_tool' ||
                entry.name === 'build' || entry.name === '__pycache__') continue;
            if (entry.isFile() && filter(full)) results.push(full);
            if (entry.isDirectory() && depth < maxDepth) {
                results.push(...findFilesRecursive(full, maxDepth, filter, depth + 1));
            }
        }
    } catch { /* permission errors, etc. */ }
    return results;
}

/** Count files matching a pattern in a directory */
export function countFiles(dir: string, pattern: RegExp, maxDepth = 4): number {
    return findFilesRecursive(dir, maxDepth, f => pattern.test(f)).length;
}

/** Check if a directory exists */
export function dirExists(projectDir: string, ...parts: string[]): boolean {
    return existsSync(join(projectDir, ...parts)) &&
        statSync(join(projectDir, ...parts)).isDirectory();
}

/** Check if a file exists */
export function fileExists(projectDir: string, ...parts: string[]): boolean {
    return existsSync(join(projectDir, ...parts));
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
