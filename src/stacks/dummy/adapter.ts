import fs from 'node:fs';
import path from 'node:path';
import type { StackAdapter, ScaffoldContext } from '../adapter.js';
import type { ScanResult } from '../../types.js';
import { registerAdapter } from '../registry.js';

/**
 * Test-only DummyAdapter used for orchestrator integration testing.
 * Uses 'nodejs' as its stack id — a valid Stack value with no production adapter.
 */
export class DummyAdapter implements StackAdapter {
    readonly id = 'nodejs' as const;
    readonly displayName = 'Node.js (Dummy)';
    readonly nameHint = 'kebab-case (e.g. my-app)';

    validateName(_name: string): string | true {
        return true;
    }

    async runPrompts(base: ScaffoldContext): Promise<ScaffoldContext> {
        return { ...base, dummyFlag: true };
    }

    async scaffold(ctx: ScaffoldContext): Promise<void> {
        fs.mkdirSync(ctx.projectDir, { recursive: true });

        fs.writeFileSync(
            path.join(ctx.projectDir, 'README.md'),
            `# ${ctx.displayName}\n`,
        );

        fs.writeFileSync(
            path.join(ctx.projectDir, 'package.json'),
            JSON.stringify({ name: ctx.appName, version: '0.1.0' }, null, 2) + '\n',
        );
    }

    scanHints(_ctx: ScaffoldContext): Partial<ScanResult> {
        return { detectedPackageManager: 'npm', detectedSSR: false };
    }

    async postSetup(_ctx: ScaffoldContext): Promise<void> {
        // no-op
    }
}

registerAdapter(new DummyAdapter());
