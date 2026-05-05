# Contributing

Thanks for considering contributing. This guide covers setup, conventions, and how to add support for new stacks or detections.

---

## Dev Setup

```bash
git clone <repo-url>
cd ai-governance
npm install
npm run build
npm test

# Link globally for local testing
npm link

# Now ai-gov command points to your local build
ai-gov --version

# Run in dev mode (no build step needed)
npx tsx src/cli.ts init --stack flutter --dry-run
```

### Prerequisites

- Node.js >= 18
- jq (for testing hooks manually)

---

## Project Layout

The codebase follows a strict one-way data flow:

```
detect_stack → load_base_profile → scan_project → compute_content_blocks → generate_all_files
```

| Directory | What lives here |
|-----------|----------------|
| `src/scanners/` | One file per stack. Reads project files, sets detection flags on `ScanResult` and overrides on `BaseProfile`. Pure side-effect-free logic (reads files, sets properties). |
| `src/profiles.ts` | Default values per stack. Scanners override these. |
| `src/content-blocks.ts` | Transforms `ScanResult` + `BaseProfile` into template strings used by generators. |
| `src/generators/` | One file per output file. Each takes `GovernanceConfig`, returns a string. |
| `src/generators/hooks/` | Same pattern — each returns a bash script as a string. |
| `src/utils/` | File helpers, safe-write with diff/dry-run, colored logger. |
| `tests/fixtures/` | Minimal manifest files (pubspec.yaml, package.json, etc.) for scanner tests. |

---

## Adding a New Detection

Example: detecting a new Flutter package.

### 1. Add to the scanner

```typescript
// src/scanners/flutter.ts
if (pubspecHas(projectDir, 'new_package')) {
  scan.detectedSomething = 'new_package';
  log.detected('Something: new_package');
}
```

### 2. Add the field to ScanResult (if new)

```typescript
// src/types.ts — add to ScanResult interface
detectedSomething: string;

// src/types.ts — add to createDefaultScanResult()
detectedSomething: '',
```

### 3. Wire it into content blocks (if it affects output)

```typescript
// src/content-blocks.ts — in buildKeyPackages()
add(scan.detectedSomething, 'something');
```

### 4. Add a test

```yaml
# tests/fixtures/flutter-bloc/pubspec.yaml — add the dependency
dependencies:
  new_package: ^1.0.0
```

```typescript
// tests/scanners.test.ts
test('detects new_package', () => {
  expect(scan.detectedSomething).toBe('new_package');
});
```

### 5. Run tests

```bash
npm test
```

---

## Adding a New Stack

Bigger lift. Here's the checklist:

1. Add the stack name to the `Stack` type in `src/types.ts`
2. Add a base profile function in `src/profiles.ts`
3. Create `src/scanners/<stack>.ts` with a `scan<Stack>()` function
4. Register it in `src/scanners/index.ts` (switch case in `scanProject`)
5. Add detection logic in `src/detect-stack.ts`
6. Create a test fixture in `tests/fixtures/<stack>/`
7. Add scanner tests in `tests/scanners.test.ts`
8. Run `npm test` and `npm run build`

The content blocks and generators should work automatically — they read from `BaseProfile` and `ScanResult` which are stack-agnostic.

---

## Adding a New Hook

1. Create `src/generators/hooks/<hook-name>.ts`:

```typescript
import type { GovernanceConfig } from '../../types.js';

export function generateMyHook(c: GovernanceConfig): string {
  return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
# ... hook logic ...
exit 0
`;
}
```

2. Register it in `src/generators/hooks/index.ts`
3. Add it to `src/generators/settings-json.ts` (PreToolUse or PostToolUse)
4. Update the hooks README generator in `src/generators/hooks/hooks-readme.ts`

---

## Adding a New Steering File

1. Create `src/generators/<name>.ts`:

```typescript
import type { GovernanceConfig } from '../types.js';

export function generateMyFile(c: GovernanceConfig): string {
  return `# Title
Content using ${c.profile.stackDisplay}, ${c.blocks.hardRules}, etc.
`;
}
```

2. Import and call it in `src/generators/index.ts`

---

## Code Conventions

- Every source file should stay under 200 lines (we enforce this for generated projects — we should follow it ourselves)
- Use `log.detected()`, `log.scanning()`, `log.warn()` for scanner output — keeps formatting consistent
- Scanner functions are pure: they read files and set properties. No file writes, no side effects beyond logging.
- Generator functions are pure: they take config, return a string. `safeWrite` handles the actual I/O.
- All file paths use `join()` from `path` — no string concatenation for paths
- Hooks stay as bash scripts (they're executed by Claude Code's shell). The TypeScript just generates them as template literals.

---

## Testing

```bash
# Run all tests
npm test

# Run with verbose output
npx jest --config jest.config.cjs --verbose

# Run a specific test
npx jest --config jest.config.cjs -t "Flutter BLoC"
```

### Test fixtures

Each fixture in `tests/fixtures/` is a minimal project — just the manifest file (pubspec.yaml, package.json, etc.) with enough dependencies to trigger detections. No actual source code needed.

### What to test

- Scanner tests: verify that detections match expected values for each fixture
- If you add a new detection, add a fixture dependency and a test assertion
- Generator tests are optional — the output is markdown/bash, hard to assert on meaningfully. Dry-run integration tests are more useful.

---

## Commit Messages

Use conventional commits:

```
feat(scanner): detect new_package in Flutter scanner
fix(nodejs): NestJS architecture detection without src/ directory
docs: add CONTRIBUTING.md
test: add fixture for Flutter Riverpod + Drift
```

---

## Pull Request Checklist

- [ ] `npm run build` passes (zero TypeScript errors)
- [ ] `npm test` passes (284+ tests)
- [ ] New detections have test coverage
- [ ] New hooks are registered in settings-json.ts and hooks-readme.ts
- [ ] CHANGELOG.md updated
