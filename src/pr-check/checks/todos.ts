import type { CheckResult } from '../types.js';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/;

export function checkTodos(diff: string, _changedFiles: string[]): CheckResult {
    const items: CheckResult['items'] = [];
    const addedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));

    for (const line of addedLines) {
        if (TODO_PATTERN.test(line)) {
            const match = line.match(TODO_PATTERN);
            items.push({
                file: 'diff',
                message: `${match?.[1] || 'TODO'} found in added lines: ${line.substring(1, 80).trim()}`,
                severity: 'warning',
            });
        }
    }

    if (items.length === 0) {
        return { name: 'TODOs', status: 'pass', details: 'No TODO/FIXME/HACK/XXX in added lines', items: [] };
    }

    return {
        name: 'TODOs',
        status: 'warn',
        details: `${items.length} TODO/FIXME/HACK/XXX found in added lines`,
        items,
    };
}
