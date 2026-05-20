import type { GovernanceConfig } from '../types.js';

function buildDomainConcepts(domain: string): string {
    switch (domain) {
        case 'healthcare':
            return `- Patient, Encounter, Episode of Care
- Facility, Practitioner, Schedule
- Screening, Assessment, Clinical Note
- PHI (Protected Health Information), Consent, Compliance`;
        case 'fintech':
            return `- Account, Balance, Transaction, Settlement
- KYC (Know Your Customer), AML, Audit Trail
- Payment Method, Ledger Entry, Reconciliation
- Risk Score, Limit, Authorisation`;
        case 'logistics':
            return `- Order, Shipment, Tracking Event
- Carrier, Route, Fulfilment Centre
- Inventory, SKU, Dispatch, Delivery
- SLA, ETA, Exception, Proof of Delivery`;
        default:
            return `- [Team: document your core domain objects here]
- [e.g. User, Organisation, Product, Order, Event]`;
    }
}

function buildDomainLabel(domain: string): string {
    const labels: Record<string, string> = {
        healthcare: 'Healthcare — clinical / patient workflow',
        fintech: 'Fintech — payments / banking',
        logistics: 'Logistics — supply chain / fulfilment',
        general: 'General',
    };
    return labels[domain] ?? 'General';
}

function buildSensitivityBlock(sensitivity: string): string {
    const general = `- No API keys, tokens, or secrets in source code — use environment variables
- No credentials in log output or error messages
- Sensitive config values must come from .env / secrets manager`;

    if (sensitivity === 'health') {
        return `- **PHI Rule:** Protected Health Information must never appear in logs, crash reports, or analytics events
- Encrypt PHI at rest and in transit — no plaintext patient identifiers anywhere
- No patient IDs, names, or dates-of-birth in error messages or stack traces
- Biometric data: no plaintext storage; use platform secure enclave APIs only
- Comply with HIPAA minimum-necessary principle — only access PHI required for the task
${general}`;
    }
    if (sensitivity === 'pii') {
        return `- **PII Rule:** No Personally Identifiable Information in server logs, console output, or analytics events
- Mask or hash user identifiers in error messages and stack traces
- GDPR: respect right-to-erasure — no shadow copies of user data in logs or caches
- Encrypt PII fields at rest; never log raw email, phone, or national ID
${general}`;
    }
    return general;
}

function buildStackSecurityBlock(stack: string): string {
    switch (stack) {
        case 'kotlin':
            return `\n### Android-Specific\n- No PII in Crashlytics / Firebase Analytics custom parameters\n- No biometric templates stored in SharedPreferences or external storage\n- Use Android Keystore for cryptographic keys`;
        case 'nodejs':
            return `\n### Node.js-Specific\n- No PII in \`console.log\` / \`console.error\` / stdout — use a structured logger with field redaction\n- Never log \`req.body\` or \`req.headers\` in full — redact sensitive fields\n- Validate all environment variables at startup; fail fast if required vars are missing`;
        case 'react':
        case 'next':
            return `\n### Web-Specific\n- No PII in \`localStorage\` or \`sessionStorage\` — use httpOnly cookies for auth tokens\n- Enforce Content-Security-Policy headers; never use \`eval()\` or \`dangerouslySetInnerHTML\` with user input\n- Strip PII from analytics payloads before dispatch`;
        case 'python':
            return `\n### Python-Specific\n- No PII in structlog / loguru log fields — use field redaction middleware\n- Never log request payloads in full; use a request-sanitizer\n- FastAPI: do not include sensitive data in OpenAPI schema examples`;
        case 'java':
            return `\n### Java/Spring-Specific\n- No PII in SLF4J MDC context — clear MDC on request completion\n- Spring Security audit log must redact passwords and tokens\n- Never serialise entity objects directly to logs`;
        default:
            return '';
    }
}

export function generateConstitution(c: GovernanceConfig): string {
    const priorityChain = c.agent === 'kiro'
        ? 'constitution.md > steering files > specs'
        : 'constitution.md > CLAUDE.md > steering files > specs';

    const domain = c.scan.detectedDomainContext || 'general';
    const sensitivity = c.scan.detectedDataSensitivity || 'general';
    const domainLabel = buildDomainLabel(domain);
    const domainConcepts = buildDomainConcepts(domain);
    const sensitivityBlock = buildSensitivityBlock(sensitivity);
    const stackSecurityBlock = buildStackSecurityBlock(c.stack);

    return `# Constitution — ${c.project.appName}

> **These rules are ABSOLUTE. You must never violate them.**
> **Priority: ${priorityChain}**

## Project Context
**App:** ${c.project.appName}${c.project.appDescription ? ` — ${c.project.appDescription}` : ''}
**Domain:** ${domainLabel}
**Stack:** ${c.profile.stackDisplay}

### Key Domain Concepts
${domainConcepts}

## Hard Rules — You Must Obey These
${c.blocks.hardRules}

## Architecture Invariants — Never Deviate
**Layer flow:** ${c.profile.layerFlow}
${c.blocks.layerResps}

## Data Security Rules
${sensitivityBlock}${stackSecurityBlock}

## High-Risk Files — Confirm Before Editing
${c.blocks.highRiskDisplay}
`;
}
