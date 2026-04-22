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
| **Bug Fix**     | "fix", "broken", "not working" |
| **Refactor**    | "refactor", "clean up", "reorganise" |
| **Hotfix**      | "urgent", "prod issue", "critical" |

Say: "This is a [type] task." Then proceed to step 2.

### 2. Read these steering files BEFORE doing anything
| File | Feature | Bug Fix | Refactor | Hotfix |
|------|:-------:|:-------:|:--------:|:------:|
| \`architecture.md\`       | ✓ | ✓ | ✓ | ✓ |
| \`coding-standards.md\`   | ✓ | ✓ | ✓ | — |
| \`spec-first-workflow.md\` | ✓ | — | — | — |
| \`feature-readme.md\`     | ✓ | if editing feature | if editing feature | — |
| \`ai-usage-policy.md\`    | ✓ | — | if >5 files | — |

Do NOT write any code until you have read the required files.

### 3. Follow the workflow for that task type

**New Feature — you MUST do ALL of these in order:**
1. Check \`specs/<feature>/\` exists. If not: \`cp -r specs/_template specs/<feature>\`
2. Fill \`requirements.md\` — replace every \`_replace_\` placeholder
3. Fill \`design.md\` — fill hard rules compliance table
4. Fill \`tasks.md\` — write phased tasks with \`[S]\` \`[M]\` \`[L]\` size estimates
5. Show the user your filled spec files and your implementation plan
6. **STOP. Wait for the user to say "go ahead" or confirm.**
7. Implement in tasks.md phase order: Data → Logic → State → UI → Tests
8. Check off tasks in tasks.md as you complete them
9. After finishing: list files, update tasks.md, confirm architecture, summarise, flag risks

**Bug Fix:** Read broken file → state root cause → propose minimal fix → if >3 files STOP → fix → summarise

**Refactor:** List ALL files → state changes per file → STOP for confirmation → refactor → confirm tests pass

**Hotfix:** Fix immediately → state what changed → flag for review

---

## While Coding — Rules You Must Not Break

- Never skip a layer — \`${p.layerFlow}\`
- Never put business logic in ${p.layerNames[0]}s
- Follow naming from \`coding-standards.md\`
- **Keep every file under 200 lines.**
- If a hook gives you a warning, you MUST act on it immediately
- If a hook blocks you, follow its instructions exactly

---

## Hard Rules
${b.hardRules}
`;
}
