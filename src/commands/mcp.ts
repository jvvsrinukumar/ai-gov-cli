import { join, resolve } from 'path';
import { log } from '../utils/logger.js';
import { readTTYLine } from '../utils/tty.js';
import { MCP_CATALOG, getToolById, getTokenTools, getValidToolIds } from '../mcp/catalog.js';
import { buildMcpConfig, readMcpConfig, writeMcpConfig } from '../mcp/mcp-json.js';
import { generateEnvExample, generateEnvrc, readEnvFile, readMergedEnv, writeEnvFile } from '../mcp/env-files.js';
import { readGlobalEnv, writeGlobalEnv } from '../mcp/global-env.js';
import { ensureMcpGitignore } from '../mcp/gitignore.js';
import { writeFileSync, existsSync } from 'fs';
import type { McpCommandOptions, McpToolDefinition } from '../mcp/types.js';

function prompt(question: string): string {
    process.stdout.write(`  ${question} `);
    return readTTYLine();
}

function promptNonBlank(question: string): string {
    let value = '';
    while (!value) {
        value = prompt(question);
        if (!value) console.log('  Value cannot be empty. Please try again.');
    }
    return value;
}

// ---------------------------------------------------------------------------
// mcp init
// ---------------------------------------------------------------------------

export async function runMcpInit(options: McpCommandOptions): Promise<void> {
    const projectDir = resolve(options.dir);
    const mcpJsonPath = join(projectDir, '.mcp.json');

    log.header('AI Governance — MCP Init');

    if (existsSync(mcpJsonPath) && !options.overwrite) {
        const answer = prompt('.mcp.json already exists. Overwrite? (yes/no):');
        if (!answer.toLowerCase().startsWith('y')) {
            log.info('Aborted. Use --overwrite to force.');
            return;
        }
    }

    // Tool selection
    console.log('\n  Available MCP tools:\n');
    MCP_CATALOG.forEach((t, i) => {
        const label = t.isOAuth ? '(OAuth — no token setup needed)' : '';
        console.log(`  ${i + 1}. ${t.displayName} [${t.id}] ${label}`);
    });
    console.log('');

    const rawSelection = promptNonBlank('Enter tool IDs to include (space-separated, e.g. jira figma postgres):');
    const selectedIds = rawSelection.split(/\s+/).filter(Boolean);

    if (selectedIds.length === 0) {
        log.info('No tools selected. Nothing to write.');
        return;
    }

    const invalidIds = selectedIds.filter(id => !getValidToolIds().has(id));
    if (invalidIds.length > 0) {
        log.error(`Unknown tool IDs: ${invalidIds.join(', ')}. Valid IDs: ${[...getValidToolIds()].join(', ')}`);
        process.exit(1);
    }

    const selectedTools = selectedIds.map(id => MCP_CATALOG.find(t => t.id === id)!);

    // Collect org var values
    const orgValuesByTool: Record<string, Record<string, string>> = {};
    for (const tool of selectedTools) {
        if (tool.orgVars.length === 0) continue;
        console.log(`\n  Org vars for ${tool.displayName} (baked as literals into .mcp.json):`);
        orgValuesByTool[tool.id] = {};
        for (const v of tool.orgVars) {
            const value = promptNonBlank(`  ${v.name} (${v.description}, e.g. ${v.example}):`);
            orgValuesByTool[tool.id][v.name] = value;
        }
    }

    // Write .mcp.json
    const config = buildMcpConfig(selectedTools, orgValuesByTool);
    if (!options.dryRun) {
        writeMcpConfig(projectDir, config);
        log.created('.mcp.json');
    } else {
        log.dryNew('.mcp.json', 10);
    }

    // Write .env.mcp.example
    const exampleContent = generateEnvExample(selectedTools);
    if (!options.dryRun) {
        writeFileSync(join(projectDir, '.env.mcp.example'), exampleContent, 'utf-8');
        log.created('.env.mcp.example');
    } else {
        log.dryNew('.env.mcp.example', exampleContent.split('\n').length);
    }

    // Write .envrc
    const envrcContent = generateEnvrc();
    if (!options.dryRun) {
        writeFileSync(join(projectDir, '.envrc'), envrcContent, 'utf-8');
        log.created('.envrc');
    } else {
        log.dryNew('.envrc', envrcContent.split('\n').length);
    }

    // Add .env.mcp to .gitignore
    if (!options.dryRun) {
        ensureMcpGitignore(projectDir);
        log.info('  .env.mcp added to .gitignore');
    } else {
        log.dryNew('.gitignore (append)', 1);
    }

    console.log('\n  Next steps:');
    console.log('  1. Run: npx ai-gov mcp onboard   (each developer sets their tokens)');
    console.log('  2. Commit .mcp.json, .env.mcp.example, .envrc (never commit .env.mcp)');
    console.log('  3. Install direnv if not present: https://direnv.net\n');
}

// ---------------------------------------------------------------------------
// mcp onboard
// ---------------------------------------------------------------------------

export async function runMcpOnboard(options: McpCommandOptions): Promise<void> {
    const projectDir = resolve(options.dir);

    log.header('AI Governance — MCP Onboard');

    const mcpConfig = readMcpConfig(projectDir);
    if (!mcpConfig) {
        log.error('No .mcp.json found. Run `ai-gov mcp init` first.');
        process.exit(1);
    }

    const selectedIds = mcpConfig._aigov.tools;
    const tokenTools = selectedIds
        .map(id => {
            try { return getToolById(id); } catch { return null; }
        })
        .filter((t): t is McpToolDefinition => t !== null && !t.isOAuth);

    if (tokenTools.length === 0) {
        log.info('All selected tools use OAuth — no token setup needed.');
        log.info('Authenticate each OAuth tool via Claude Code or your browser.');
        return;
    }

    const globalEnv = readGlobalEnv();
    const newGlobal: Record<string, string> = {};
    const newProject: Record<string, string> = {};

    for (const tool of tokenTools) {
        const globalVars = tool.personalVars.filter(v => v.scope === 'global');
        const projectVars = tool.personalVars.filter(v => v.scope === 'project');

        if (globalVars.length > 0) {
            console.log(`\n  ${tool.displayName} — global tokens (stored in ~/.config/ai-gov/.env.mcp.global):`);
            for (const v of globalVars) {
                const existing = globalEnv[v.name];
                if (existing) {
                    const keep = prompt(`  ${v.name} already set. Keep existing? (yes/no):`);
                    if (!keep.toLowerCase().startsWith('n')) continue;
                }
                const value = promptNonBlank(`  ${v.name} (${v.description}):`);
                newGlobal[v.name] = value;
            }
        }

        if (projectVars.length > 0) {
            console.log(`\n  ${tool.displayName} — project tokens (stored in .env.mcp):`);
            for (const v of projectVars) {
                const value = promptNonBlank(`  ${v.name} (${v.description}):`);
                newProject[v.name] = value;
            }
        }
    }

    if (Object.keys(newGlobal).length > 0) {
        if (!options.dryRun) {
            writeGlobalEnv(newGlobal);
            log.created('~/.config/ai-gov/.env.mcp.global (updated)');
        } else {
            log.dryNew('~/.config/ai-gov/.env.mcp.global', Object.keys(newGlobal).length);
        }
    }

    if (Object.keys(newProject).length > 0) {
        if (!options.dryRun) {
            writeEnvFile(join(projectDir, '.env.mcp'), newProject);
            log.created('.env.mcp');
        } else {
            log.dryNew('.env.mcp', Object.keys(newProject).length);
        }
    }

    console.log('\n  Token setup complete.');
    console.log('  Run `direnv allow` if prompted, or restart your terminal.\n');
}

// ---------------------------------------------------------------------------
// mcp validate
// ---------------------------------------------------------------------------

export async function runMcpValidate(options: McpCommandOptions): Promise<void> {
    const projectDir = resolve(options.dir);

    log.header('AI Governance — MCP Validate');

    const mcpConfig = readMcpConfig(projectDir);
    if (!mcpConfig) {
        log.error('No .mcp.json found. Run `ai-gov mcp init` first.');
        process.exit(1);
    }

    const mergedEnv = readMergedEnv(projectDir);
    const selectedIds = mcpConfig._aigov.tools;
    let missing = 0;

    for (const id of selectedIds) {
        let tool: McpToolDefinition;
        try { tool = getToolById(id); } catch {
            log.warn(`Tool "${id}" not in catalog — skipping`);
            continue;
        }

        if (tool.isOAuth) {
            console.log(`  ✓ ${tool.displayName} (OAuth — no tokens to check)`);
            continue;
        }

        const requiredVars = tool.personalVars;
        const allPresent = requiredVars.every(v => Boolean(mergedEnv[v.name]));

        if (allPresent) {
            console.log(`  ✓ ${tool.displayName}`);
        } else {
            for (const v of requiredVars) {
                if (!mergedEnv[v.name]) {
                    console.log(`  ✗ ${tool.displayName}: missing ${v.name}`);
                    missing++;
                }
            }
        }
    }

    if (missing > 0) {
        console.log(`\n  ${missing} missing token(s). Run \`ai-gov mcp onboard\` to set them.\n`);
        process.exit(1);
    } else {
        console.log('\n  All tokens present.\n');
    }
}

// ---------------------------------------------------------------------------
// mcp update-token
// ---------------------------------------------------------------------------

export async function runMcpUpdateToken(options: McpCommandOptions): Promise<void> {
    const projectDir = resolve(options.dir);

    if (!options.tool) {
        log.error('--tool <id> is required. Example: ai-gov mcp update-token --tool jira');
        process.exit(1);
    }

    if (!getValidToolIds().has(options.tool)) {
        log.error(`Unknown tool: "${options.tool}". Valid IDs: ${[...getValidToolIds()].join(', ')}`);
        process.exit(1);
    }

    const tool = getToolById(options.tool);

    if (tool.isOAuth) {
        log.info(`${tool.displayName} uses OAuth — no token update needed. Re-authenticate via your browser.`);
        return;
    }

    log.header(`AI Governance — Update ${tool.displayName} Tokens`);

    const globalVars = tool.personalVars.filter(v => v.scope === 'global');
    const projectVars = tool.personalVars.filter(v => v.scope === 'project');

    if (globalVars.length > 0) {
        console.log(`\n  Global tokens for ${tool.displayName}:`);
        const newValues: Record<string, string> = {};
        for (const v of globalVars) {
            const value = promptNonBlank(`  New value for ${v.name}:`);
            newValues[v.name] = value;
        }
        writeGlobalEnv(newValues);
        log.info('~/.config/ai-gov/.env.mcp.global updated');
    }

    if (projectVars.length > 0) {
        console.log(`\n  Project tokens for ${tool.displayName}:`);
        const newValues: Record<string, string> = {};
        for (const v of projectVars) {
            const value = promptNonBlank(`  New value for ${v.name}:`);
            newValues[v.name] = value;
        }
        writeEnvFile(join(projectDir, '.env.mcp'), newValues);
        log.info('.env.mcp updated');
    }

    console.log(`\n  ${tool.displayName} tokens updated.\n`);
}
