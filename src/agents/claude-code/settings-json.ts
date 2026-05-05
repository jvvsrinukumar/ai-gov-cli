import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { GovernanceConfig } from '../../types.js';
import { safeWrite, type WriteOptions } from '../../utils/safe-write.js';
import { log } from '../../utils/logger.js';

export function generateSettingsJson(config: GovernanceConfig, opts: WriteOptions): void {
    const dir = config.projectDir;
    const customFile = join(dir, '.claude', 'custom-hooks.json');

    // Create custom-hooks.json if it doesn't exist (never overwritten)
    if (!existsSync(customFile)) {
        mkdirSync(dirname(customFile), { recursive: true });
        writeFileSync(customFile, JSON.stringify({
            _comment: 'v13: Add your custom hooks here. This file is NEVER overwritten by the governance script.',
            _usage: 'Add entries to PreToolUse, PostToolUse, or Stop arrays. They will be merged into settings.json on each run.',
            PreToolUse: [], PostToolUse: [], Stop: [],
        }, null, 2));
        log.created('.claude/custom-hooks.json (user-owned, never overwritten)');
    } else {
        log.kept('.claude/custom-hooks.json (user-owned)');
    }

    // v14.3: All commands use bash prefix for Windows compatibility
    const bp = 'bash "$CLAUDE_PROJECT_DIR"/.claude';

    const userPromptSubmitHooks = [
        {
            hooks: [
                { type: 'command', command: `${bp}/hooks/require-task-type.sh`, timeout: 5, statusMessage: 'Checking task classification...' },
            ],
        },
    ];

    const preToolUseHooks: object[] = [
        { type: 'command', command: `${bp}/hooks/protect-files.sh`, timeout: 10, statusMessage: 'Checking file protection...' },
        { type: 'command', command: `${bp}/hooks/check-secrets.sh`, timeout: 10, statusMessage: 'Scanning for secrets...' },
        { type: 'command', command: `${bp}/hooks/session-continuity.sh`, timeout: 10, statusMessage: 'Checking session continuity...' },
        { type: 'command', command: `${bp}/hooks/block-dangerous-commands.sh`, timeout: 10, statusMessage: 'Validating command safety...' },
    ];
    if (config.specFirstEnabled) {
        preToolUseHooks.push({ type: 'command', command: `${bp}/hooks/check-spec-exists.sh`, timeout: 10, statusMessage: 'Checking spec exists...' });
    }
    const baseSettings = {
        hooks: {
            UserPromptSubmit: userPromptSubmitHooks,
            PreToolUse: [
                {
                    matcher: 'Edit|Write|Bash',
                    hooks: preToolUseHooks,
                },
            ],
            PostToolUse: [
                {
                    matcher: 'Edit|Write',
                    hooks: [
                        { type: 'command', command: `${bp}/hooks/format-code.sh`, timeout: 30, statusMessage: 'Formatting...' },
                        { type: 'command', command: `${bp}/hooks/analyze-code.sh`, timeout: 60, statusMessage: 'Analyzing...' },
                        { type: 'command', command: `${bp}/hooks/check-feature-readme.sh`, timeout: 10, statusMessage: 'Checking README...' },
                        { type: 'command', command: `${bp}/hooks/check-consistency.sh`, timeout: 10, statusMessage: 'Checking consistency...' },
                        { type: 'command', command: `${bp}/hooks/check-file-size.sh`, timeout: 10, statusMessage: 'Checking file size...' },
                        { type: 'command', command: `${bp}/extensions/load-extensions.sh PostToolUse`, timeout: 15, statusMessage: 'Running extensions...' },
                    ],
                },
            ],
            Stop: [
                {
                    hooks: [
                        { type: 'command', command: `${bp}/hooks/post-task-checklist.sh`, timeout: 5 },
                        { type: 'command', command: `${bp}/extensions/load-extensions.sh Stop`, timeout: 15, statusMessage: 'Running extensions...' },
                    ],
                },
            ],
        },
    };

    // Merge custom hooks if available
    if (existsSync(customFile)) {
        try {
            const custom = JSON.parse(readFileSync(customFile, 'utf-8'));
            for (const trigger of ['PreToolUse', 'PostToolUse', 'Stop'] as const) {
                const arr = custom[trigger];
                if (Array.isArray(arr) && arr.length > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (baseSettings.hooks as any)[trigger].push(...arr);
                    log.merged(`custom-hooks.json ${trigger} into settings.json`);
                }
            }
        } catch { /* ignore parse errors */ }
    }

    safeWrite(
        join(dir, '.claude', 'settings.json'),
        JSON.stringify(baseSettings, null, 2) + '\n',
        opts
    );
}
