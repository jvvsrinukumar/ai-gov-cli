import type { GovernanceConfig } from '../types.js';
import { generateFeatureReadme } from './feature-readme.js';
import { generatePromptTemplates } from './prompt-templates.js';
import { generateTaskEstimates } from './task-estimates.js';

export function generateDeveloperReference(c: GovernanceConfig): string {
    return `# Developer Reference — ${c.project.appName}

${generateFeatureReadme(c)}

---

${generatePromptTemplates(c)}

---

${generateTaskEstimates(c)}`;
}
