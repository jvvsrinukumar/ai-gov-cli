import type { GovernanceConfig } from '../../types.js';

export function generateAuditCommand(c: GovernanceConfig): string {
    const { profile, scan, project } = c;
    const hookVer = c.hookVersion;

    // Exact filenames as generated on disk
    const expectedHooks = [
        'protect-files.sh',
        'block-dangerous-commands.sh',
        'check-secrets.sh',
        'session-continuity.sh',
        'format-code.sh',
        'analyze-code.sh',
        'check-feature-readme.sh',
        'check-consistency.sh',
        'check-file-size.sh',
        'post-task-checklist.sh',
    ].join(', ');

    const specHookNote = `check-spec-exists.sh — conditional: only registered in settings.json when \`specs/\` has feature directories beyond \`_template/\`. On a fresh project this is intentionally absent. It activates automatically once you create your first spec.`;

    const highRisk = scan.highRiskFiles.length
        ? scan.highRiskFiles.slice(0, 8).join(', ')
        : 'none detected';

    const detectedTools = [
        profile.stateFramework && `state: ${profile.stateFramework}`,
        profile.diFramework && profile.diFramework !== 'N/A' && `DI: ${profile.diFramework}`,
        scan.detectedORM && `ORM: ${scan.detectedORM}`,
        scan.detectedTestFramework && `tests: ${scan.detectedTestFramework}`,
        scan.detectedLinter && `linter: ${scan.detectedLinter}`,
        scan.detectedFormatter && `formatter: ${scan.detectedFormatter}`,
        scan.detectedRouter && `router: ${scan.detectedRouter}`,
        scan.detectedAuth && `auth: ${scan.detectedAuth}`,
    ].filter(Boolean).join(' · ') || 'standard';

    const ormCheck = scan.detectedORM
        ? `- **${scan.detectedORM}** (detected ORM) — look for model definitions, query patterns`
        : '- The data access patterns for this stack (model/repository/query style)';

    const testCheck = scan.detectedTestFramework
        ? `- **${scan.detectedTestFramework}** (detected test framework) — look for test commands and coverage rules`
        : '- Testing patterns and test commands';

    const linterCheck = scan.detectedLinter
        ? `- **${scan.detectedLinter}** (detected linter) — look for lint command, rules, or config reference. If \`${scan.detectedLinter}\` appears in \`package.json\` scripts that counts.`
        : '- Linting approach and formatter config';

    const featuresDir = profile.featuresDir || profile.sourceDir || 'src/features/';
    const sourceDir = profile.sourceDir || 'src/';
    const layerFlow = profile.layerFlow;
    const taskTypes = 'New Feature · Edit Feature · Bug Fix · Refactor · Hotfix';

    const specExample = featuresDir.includes('api') || featuresDir.includes('routes')
        ? `specs/user-auth/`
        : `specs/user-profile/`;

    const specActivationCmd = `cp -r specs/_template/ ${specExample}`;

    // Spec workflow — built entirely from scanned values, no hardcoding
    const layerNames = profile.layerNames?.length
        ? profile.layerNames
        : layerFlow.split('→').map(s => s.trim());
    const logicLayer = profile.layerLogic || layerNames[Math.floor(layerNames.length / 2)] || 'Service';
    const dataLayer  = profile.layerData  || layerNames[layerNames.length - 1] || 'DataSource';
    const uiLayer    = profile.layerUI    || layerNames[0] || 'Component';

    const stateInfo  = scan.detectedState ? ` · state: ${scan.detectedState}` : '';
    const ormInfo    = scan.detectedORM   ? ` · ORM: ${scan.detectedORM}`     : '';
    const testInfo   = scan.detectedTestFramework ? ` · tests: ${scan.detectedTestFramework}` : '';

    const specWorkflowDetail =
        `Code lives in \`${featuresDir}\`${stateInfo}${ormInfo}${testInfo}.\n\n` +
        `Each feature follows the scanned layer flow:\n\n` +
        `\`\`\`\n${layerFlow}\n\`\`\`\n\n` +
        `Before writing code, spec:\n` +
        `- **${uiLayer} layer** — inputs, outputs, events the user triggers\n` +
        `- **${logicLayer} layer** — business rules, validation, what can fail\n` +
        `- **${dataLayer} layer** — data shape, queries, external calls`;

    return `# /audit — Governance Health Check

> **Project:** ${project.appName}
> **Stack:** ${profile.stackDisplay}
> **Arch:** ${profile.layerFlow}
> **Detected tools:** ${detectedTools}
> **Hook version:** v${hookVer}
> **High-risk files:** ${highRisk}

---

You are performing a governance health audit for this project. Do NOT scan source files deeply. Focus only on the \`.claude/\` directory and the items listed below.

## Step 1 — Read governance files

Read these files and confirm they exist and are non-empty:

- \`.claude/CLAUDE.md\`
- \`.claude/settings.json\`
- \`.claude/steering/constitution.md\`
- \`.claude/steering/architecture.md\`
- \`.claude/steering/coding-standards.md\`
- \`.claude/steering/workflow.md\`

## Step 2 — Check hooks

**Expected hooks** (always present):
\`\`\`
${expectedHooks}
\`\`\`

**Conditional hook:**
${specHookNote}

For each expected hook, check:
1. File exists in \`.claude/hooks/\`
2. First line contains \`HOOK_VERSION=${hookVer}\` — if version differs, report as STALE
3. File is not empty (0 bytes)

**Extra hooks** (files in \`.claude/hooks/\` not in the expected list above): these are custom hooks added by the team. List them as CUSTOM — do not flag as errors. Note whether they are registered in \`settings.json\` or not.

## Step 3 — Check architecture alignment

The detected architecture is: **${profile.layerFlow}**
Pattern: \`${scan.detectedArchPattern || 'standard'}\`

Read \`.claude/steering/architecture.md\` and confirm:
- The "Layer flow" section matches \`${profile.layerFlow}\`
- The directory structure shown matches the pattern above
- High-risk files listed include: \`${highRisk}\`

If these are wrong, flag as **STALE** — re-run \`ai-gov init --overwrite\` to regenerate.

## Step 4 — Check settings.json hooks registration

Read \`.claude/settings.json\`. Confirm the 10 core hooks are registered:

\`\`\`
${expectedHooks}
\`\`\`

For \`check-spec-exists.sh\`: check if \`specs/\` has any subdirectories besides \`_template/\`.
- If yes → it should be registered in PreToolUse. Flag if missing.
- If no → its absence is **expected and correct** (spec-first opt-in mode).

Custom hooks found on disk but not in settings.json: flag as **NOT WIRED** — they exist but will never fire.

## Step 5 — Spot-check steering freshness

Read \`.claude/steering/coding-standards.md\` and confirm it mentions:
${ormCheck}
${testCheck}
${linterCheck}

If clearly missing or contradictory, flag as **STALE**. Minor wording differences are fine — look for intent, not exact strings.

## Step 6 — Output audit report

Use this exact format. At the end compute a **Health Score**:
- Start at 100
- Each STALE hook: −5
- Each missing core hook: −15
- Each NOT WIRED custom hook: −5
- Each STALE steering file: −10
- check-spec-exists absent with no spec history: 0 (expected, no penalty)

Grade: A (90-100) · B (75-89) · C (60-74) · D (below 60)

\`\`\`
GOVERNANCE AUDIT — ${project.appName}
Stack: ${profile.stackDisplay} | Hook version: v${hookVer}
Date: <today>

FILES
  ✓/✗  .claude/CLAUDE.md
  ✓/✗  .claude/settings.json
  ✓/✗  .claude/steering/constitution.md
  ✓/✗  .claude/steering/architecture.md
  ✓/✗  .claude/steering/coding-standards.md
  ✓/✗  .claude/steering/workflow.md

HOOKS  (expected version: v${hookVer})
  ✓/STALE/✗  <hook-name>.sh  [version found or "missing"]
  ... (one line per expected hook)

  CUSTOM hooks (team additions):
    • <hook-name>.sh  [registered in settings.json: yes/no]

SPEC-FIRST
  ✓/—  check-spec-exists.sh  [registered | absent — expected, no spec history yet]

ARCHITECTURE
  ✓/✗  Layer flow matches: ${profile.layerFlow}
  ✓/✗  High-risk files present

SETTINGS.JSON
  ✓/✗  10 core hooks registered
  note any custom hooks wired or not wired

STEERING FRESHNESS
  ✓/✗  coding-standards.md covers ORM/data patterns
  ✓/✗  coding-standards.md covers test framework
  ✓/✗  coding-standards.md covers linter

HEALTH SCORE
  <score>/100  Grade: <A/B/C/D>
  Deductions: <list what was deducted and why, or "none">

VERDICT
  [PASS — governance is current]
  OR
  [ACTION NEEDED]
    • <specific issue with exact fix command or step>
  Run: ai-gov init --update-hooks   (stale hook versions only)
  Run: ai-gov init --overwrite      (stale steering files)
\`\`\`

---

## How specs work in ${project.appName}

${specWorkflowDetail}

**Task types supported:** ${taskTypes}

**Spec-first is currently:** opt-in (activates on first spec creation)

### To start using spec-first workflow:

\`\`\`bash
# 1. Create your first spec from the template
${specActivationCmd}

# 2. Fill in the three files
#    ${specExample}requirements.md  — what to build and why
#    ${specExample}design.md        — architecture decisions, layer breakdown
#    ${specExample}tasks.md         — [ ] task checklist Claude will follow

# 3. Tell Claude to implement it
#    "implement the spec at ${specExample}"
\`\`\`

Once \`${specExample}\` exists, \`check-spec-exists.sh\` auto-registers on next \`ai-gov init\`.
From that point Claude is blocked from writing to \`${sourceDir}\` without a matching spec.

### Spec files explained

| File | Purpose |
|---|---|
| \`requirements.md\` | User stories, acceptance criteria, non-goals |
| \`design.md\` | Layer breakdown (${layerNames.join(' → ')}), data models, API contracts |
| \`tasks.md\` | \`- [ ] task\` checklist — Claude tracks progress here |

**session-continuity.sh** reads \`tasks.md\` at every session start and tells Claude exactly where it left off.
`;
}
