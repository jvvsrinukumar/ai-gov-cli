export function generateSilentCaptureInstructionNewFeature(): string {
   return `
---

## SILENT KNOWLEDGE CAPTURE — After Gate 1 Approval

When the developer approves Gate 1 (says ok / approved / yes / lgtm / proceed):

1. Derive slug: feature name, lowercase, spaces → hyphens
2. Target file: \`knowledge/product-[slug].md\`
3. Extract from the approved requirements:
   - **User Flows** — from Overview + Acceptance Criteria (what the user does, in observable steps)
   - **Domain Objects** — entities, models, or data types explicitly named
   - **Permissions & Roles** — any role or access rule stated
   - **Business States** — conditions, status values, or state transitions in acceptance criteria
4. Merge with \`knowledge/product-[slug].md\` if it exists:
   - \`[CONFIRMED]\` entries — never overwrite. Skip.
   - \`[INFERRED]\` entries the requirements confirm — upgrade to \`[CONFIRMED]\`
   - \`[INFERRED]\` entries requirements don't address — leave unchanged
   - New entries not in file — append to the relevant section as \`[CONFIRMED]\`
   - File doesn't exist — create it using the Phase 1 product knowledge structure:
     \`\`\`
     # Product Knowledge — [feature] | [stack]

     > ⚠ Auto-generated. Do not add secrets, PII, or credentials.

     Generated: [today's date]

     ---

     ## User Flows
     ## Domain Objects
     ## Permissions & Roles
     ## Business States
     ## Needs Clarification
     \`\`\`
5. Create the \`knowledge/\` directory if it doesn't exist.
6. Write the file. Output exactly one line:
   \`↳ Knowledge captured: knowledge/product-[slug].md ([N] entries added, [N] upgraded)\`

If nothing is extractable from the requirements:
   \`↳ Knowledge capture: no extractable entries in requirements.\`

Do not ask the developer for input. Do not explain the process. One status line only.

Proceed to Gate 2.

---
`;
}

export function generateSilentCaptureInstructionFix(): string {
   return `
---

## SILENT KNOWLEDGE CAPTURE — After Fix Applied

After the fix is written (ExitPlanMode already called):

**DO NOT CAPTURE if the fix is any of:**
- null/undefined check, off-by-one, typo, missing await, type coercion
- wrong import path, wrong constant value with no business meaning
- test-only change, log/format change, lint cleanup
- dependency upgrade, config tweak, build fix
- race condition fix with no domain-level implication

**Default to "no business rules extracted."** Only capture when the root cause is a
misunderstood requirement, an unenforced business constraint, or a missing role/permission check.

If the fix falls into the DO-NOT-CAPTURE list above, skip directly to step 6 and output:
   \`↳ Knowledge capture: fix was technical — no business rules extracted.\`

Otherwise, proceed:

1. Derive slug from the primary fixed file path — use the feature folder name.
   Example: \`src/features/payments/payment.service.ts\` → slug = \`payments\`
   If the fix spans multiple features, use the feature most responsible for the broken behaviour.
2. Target file: \`knowledge/product-[slug].md\`
3. Extract from the root cause + what the fix enforces:
   - **Business rule** — what the correct behaviour is (what this fix now enforces)
   - **Constraint** — any threshold, role requirement, or condition the bug exposed
   - **Edge case** — the specific scenario that was broken and is now handled
   Tag everything \`[INFERRED]\`. Source line: \`bug fix · /fix · [today's date]\`
4. Merge with \`knowledge/product-[slug].md\` if it exists:
   - \`[CONFIRMED]\` entries — never overwrite. Skip.
   - \`[INFERRED]\` entries already present that match — skip (no duplicates).
   - New entries — append under a \`## Business Rules\` section (create section if missing).
   - File does not exist — create a minimal file:
     \`\`\`
     # Product Knowledge — [feature] | [stack]

     > ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.

     Generated: [today's date]

     ---

     ## Business Rules
     \`\`\`
5. Create the \`knowledge/\` directory if it does not exist.
6. Write the file. Output exactly one line:
   \`↳ Knowledge captured: knowledge/product-[slug].md ([N] rule(s) added from bug fix)\`

If the fix is purely technical (null pointer, off-by-one, typo) with no business meaning:
   \`↳ Knowledge capture: fix was technical — no business rules extracted.\`

Do not ask the developer for input. Do not explain the process. One status line only.

---
`;
}

export function generateSilentCaptureInstructionEditFeature(): string {
   return `
---

## SILENT KNOWLEDGE CAPTURE — After Gate 1 Approval

When the developer approves Gate 1 (says ok / approved / yes / lgtm / proceed):

1. Derive slug: feature name, lowercase, spaces → hyphens
2. Target file: \`knowledge/product-[slug].md\`
3. Extract ONLY from items marked \`<!-- NEW -->\` or \`<!-- CHANGED: ... -->\` in the approved requirements:
   - **User Flows** — from new/changed Overview + Acceptance Criteria steps
   - **Domain Objects** — new/changed entities, models, or data types
   - **Permissions & Roles** — new/changed role or access rules
   - **Business States** — new/changed conditions, status values, or state transitions

   Do not re-capture existing unchanged requirements — those are already in the knowledge file.
4. Merge with \`knowledge/product-[slug].md\` if it exists:
   - \`[CONFIRMED]\` entries — never overwrite. Skip.
   - \`[INFERRED]\` entries the requirements confirm — upgrade to \`[CONFIRMED]\`
   - \`[INFERRED]\` entries requirements don't address — leave unchanged
   - New entries not in file — append to the relevant section as \`[CONFIRMED]\`
   - File doesn't exist — create it using the Phase 1 product knowledge structure
5. Create the \`knowledge/\` directory if it doesn't exist.
6. Write the file. Output exactly one line:
   \`↳ Knowledge captured: knowledge/product-[slug].md ([N] entries added, [N] upgraded)\`

If nothing is extractable (no \`<!-- NEW -->\` or \`<!-- CHANGED -->\` markers, or markers contain no domain-level information):
   \`↳ Knowledge capture: no extractable entries in requirements.\`

Do not ask the developer for input. Do not explain the process. One status line only.

Proceed to Gate 2.

---
`;
}
