import type { GovernanceConfig } from '../types.js';

export function generateRootClaudeMd(): string {
    return `# CLAUDE.md — Redirect

> **All rules, architecture, and process are defined in \`.claude/CLAUDE.md\`. Start there.**
`;
}

export function generateMasterClaudeMd(c: GovernanceConfig): string {
    const p = c.profile, b = c.blocks, proj = c.project;
    const scaffoldRow = c.scan.scaffoldTool ? `| Generate feature | \`${c.scan.scaffoldCmdFeature}\` |\n` : '';
    const codegenRow = p.codegenCmd ? `| Code generation | \`${p.codegenCmd}\` |\n` : '';
    const analyzeRow = p.analyzeCmd ? `| Analyze | \`${p.analyzeCmd}\` |\n` : '';
    const buildRow = p.buildCmd ? `| Build   | \`${p.buildCmd}\` |\n` : '';
    const formatRow = p.formatCmdFull ? `| Format  | \`${p.formatCmdFull}\` |\n` : '';
    const legacySection = proj.legacyDescription !== 'No legacy code'
        ? `### Legacy Codebase\n${proj.legacyDescription}\n\n` : '';

    const newFeatureStep1 = c.specFirstEnabled
        ? `1. Check \`specs/<feature>/\` exists. If not: \`cp -r specs/_template specs/<feature>\``
        : `1. (Spec-first not enforced — no existing specs. To opt in: create \`specs/<feature>/\` using \`cp -r specs/_template specs/<feature>\`)`;

    return `# CLAUDE.md — You MUST follow these rules

> **You are Claude Code working on ${proj.appName}.**
> **These are your operating rules. Follow them exactly. Do not skip steps.**
> **If a hook blocks you, follow its instructions — do not work around it.**

**App:** ${proj.appName}${proj.appDescription ? ` — ${proj.appDescription}` : ''}
**Package:** \`${proj.packageName}\`
**Stack:** ${p.stackDisplay}

---

## Commands
| Action | Command |
|--------|---------|
| Install | \`${p.installCmd}\` |
| Run     | \`${p.runCmd}\` |
${buildRow}${codegenRow}${analyzeRow}${formatRow}| Test    | \`${p.testCmd}\` |
| Clean   | \`${p.cleanCmd}\` |
${scaffoldRow}
${legacySection}### High-Risk Files (confirm before editing)
${b.highRiskDisplay}

### Key Packages (do not add/remove without approval)
${b.keyPackages}

---

## When You Receive ANY Task — Do This First

### 1. State the task type out loud
| Type | When the user says |
|------|---------|
| **New Feature** | "create", "add feature", "build X" |
| **Edit Feature** | "update feature", "add X to Y", "extend", "modify feature", "enhance" |
| **Bug Fix**     | "fix", "broken", "not working" |
| **Refactor**    | "refactor", "clean up", "reorganise" |
| **Hotfix**      | "urgent", "prod issue", "critical" |

Say: "This is a [type] task." Then proceed to step 2.

### 2. Architecture you must follow

**Layer flow — never skip a layer:**
\`\`\`
${p.layerFlow}
\`\`\`
${b.layerResps}
${b.diText}

**Naming:**
- Classes: ${p.namingClasses}
- Methods/Variables: ${p.namingMethods}
- Constants: ${p.namingConstants}
- Files: ${p.namingFiles}

**Error handling:** ${p.errorPattern}

**File size:** Every source file under 200 lines. Test files, generated files, and config files are exempt.

**Type naming:**
${b.typeNaming}

> Full details in \`steering/architecture.md\` and \`steering/coding-standards.md\` — read them when working on complex structural changes.

### 3. Follow the workflow for that task type

**New Feature — you MUST do ALL of these in order:**
${newFeatureStep1}
2. Fill \`requirements.md\` — replace every \`_replace_\` placeholder, write real user stories with Given/When/Then, select data source
3. Fill \`design.md\` — fill hard rules compliance table (Yes/No in every cell), list actual files you will create
4. Fill \`tasks.md\` — write phased tasks with \`[S]\` \`[M]\` \`[L]\` size estimates
5. Show the user your filled spec files and your implementation plan
6. **STOP. Wait for the user to say "go ahead" or confirm. Do NOT write code until they confirm.**
7. Implement in tasks.md phase order: Data → Logic → State → UI → Tests
8. Check off tasks in tasks.md as you complete them
9. After finishing: list files, update tasks.md, confirm architecture, summarise, flag risks, confirm tests

**Edit Feature (update/extend existing feature) — you MUST do ALL of these in order:**
1. Read the EXISTING spec: \`specs/<feature>/requirements.md\` → \`design.md\` → \`tasks.md\`
2. Read the feature README at \`${p.featuresDir}<feature>/README.md\`
3. UPDATE \`requirements.md\` — add new user stories, update data source if changed
4. UPDATE \`design.md\` — add new files to file list, re-check hard rules compliance table
5. UPDATE \`tasks.md\` — add new tasks to existing phases (append, don't replace completed tasks)
6. Show the user what changed in each spec file
7. **STOP. Wait for the user to confirm the spec changes before writing any code.**
8. Implement only the NEW/CHANGED tasks (do not redo completed work)
9. Update tasks.md checkboxes and feature README as you go
10. After finishing: list files, summarise changes, flag risks

**Bug Fix — do this:**
1. Read the broken file BEFORE changing anything
2. State the root cause in 1-2 sentences
3. Propose the minimal fix (fewest files possible)
4. If fix touches more than 3 files → STOP and wait for user confirmation
5. Do NOT refactor surrounding code — fix only what is broken
6. After fixing: list files modified, summarise the fix, flag if high-risk files were touched

**Refactor — do this:**
1. List ALL files that will be affected
2. For each file state: what changes, which layer
3. STOP and wait for user confirmation
4. After refactoring: confirm all tests pass, list files, flag risks

**Hotfix — do this:**
1. Fix immediately — no plan needed
2. After fixing: state what changed and why
3. Flag for post-fix review

---

## While Coding — Rules You Must Not Break

- Never skip a layer — \`${p.layerFlow}\`
- Never put business logic in ${p.layerNames[0]}s
- Never exceed 200 lines per file — decompose instead
- If a hook blocks you, follow its instructions exactly — do not work around it
- If a hook gives you a warning, act on it before continuing

---

## Hard Rules
${b.hardRules}
`;
}
