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
