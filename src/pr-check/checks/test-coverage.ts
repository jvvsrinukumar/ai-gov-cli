import { existsSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import type { GovernanceConfig } from '../../types.js';
import type { CheckResult } from '../types.js';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.dart', '.kt', '.py', '.swift'];
const TEST_SUFFIXES = ['.test.', '.spec.', '_test.', 'Test.'];
const TEST_DIRS = ['test', 'tests', '__tests__', 'spec'];

function isTestFile(file: string): boolean {
    return TEST_SUFFIXES.some(s => file.includes(s)) ||
        TEST_DIRS.some(d => file.includes(`/${d}/`) || file.includes(`\\${d}\\`));
}

function isSourceFile(file: string): boolean {
    const ext = extname(file);
    return SOURCE_EXTENSIONS.includes(ext) && !isTestFile(file);
}

function findTestFile(sourceFile: string, projectDir: string): boolean {
    const dir = dirname(sourceFile);
    const name = basename(sourceFile, extname(sourceFile));
    const ext = extname(sourceFile);

    const candidates = [
        join(projectDir, dir, `${name}.test${ext}`),
        join(projectDir, dir, `${name}.spec${ext}`),
        join(projectDir, dir, '__tests__', `${name}.test${ext}`),
        join(projectDir, dir, '__tests__', `${name}.spec${ext}`),
        join(projectDir, 'tests', dir, `${name}.test${ext}`),
        join(projectDir, 'test', dir, `${name}_test${ext}`),
    ];

    return candidates.some(c => existsSync(c));
}

export function checkTestCoverage(changedFiles: string[], projectDir: string, _config: GovernanceConfig | null): CheckResult {
    const items: CheckResult['items'] = [];

    const newSourceFiles = changedFiles.filter(isSourceFile);

    for (const file of newSourceFiles) {
        if (!findTestFile(file, projectDir)) {
            items.push({
                file,
                message: `No corresponding test file found — consider adding tests`,
                severity: 'warning',
            });
        }
    }

    if (items.length === 0) {
        return { name: 'Test Coverage', status: 'pass', details: 'All source files have corresponding tests', items: [] };
    }

    return {
        name: 'Test Coverage',
        status: 'warn',
        details: `${items.length} source file(s) without tests`,
        items,
    };
}
