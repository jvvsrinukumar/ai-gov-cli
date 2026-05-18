/**
 * Produce a ScannerSnapshot from existing ScanResult + BaseProfile.
 *
 * Scope (v20 plan §3.1, narrowed per review): wraps only the 15 fields audit
 * actually compares against in Step 5 gap analysis. Other ScanResult fields
 * stay flat strings — full-scan wrapping is explicitly deferred to v21.
 *
 * Confidence rules:
 *   - 'high'    — concrete value derived from a manifest file or unambiguous file pattern
 *   - 'medium'  — value derived from a heuristic with reasonable evidence
 *   - 'low'     — value defaulted from profile because scanner found nothing concrete
 *   - 'unknown' — blank or sentinel value; the scanner did not detect this attribute
 */
import type { BaseProfile, ScanResult } from '../types.js';
import type { ConfidenceField, ScannerSnapshot, Confidence, EvidenceSource } from '../schemas/governance-state.schema.js';

function field(value: string | null, source: EvidenceSource): ConfidenceField {
    const cleaned = value && value.trim() ? value.trim() : null;
    let confidence: Confidence;
    if (cleaned === null) confidence = 'unknown';
    else if (source === 'manifest') confidence = 'high';
    else if (source === 'file-pattern') confidence = 'high';
    else if (source === 'heuristic') confidence = 'medium';
    else confidence = 'low';
    return { value: cleaned, confidence, source };
}

function arrayField(value: string[] | null, source: EvidenceSource): ConfidenceField<string[]> {
    const cleaned = value && value.length ? value : null;
    const confidence: Confidence = cleaned === null ? 'unknown'
        : source === 'manifest' ? 'high'
        : source === 'file-pattern' ? 'high'
        : 'medium';
    return { value: cleaned, confidence, source };
}

export function scanResultToSnapshot(scan: ScanResult, profile: BaseProfile): ScannerSnapshot {
    return {
        stateFramework:        field(profile.stateFramework || scan.detectedState, profile.stateFramework ? 'manifest' : 'file-pattern'),
        diFramework:           field(profile.diFramework && profile.diFramework !== 'N/A' ? profile.diFramework : scan.detectedDI, 'manifest'),
        detectedORM:           field(scan.detectedORM, 'manifest'),
        detectedTestFramework: field(scan.detectedTestFramework, 'manifest'),
        detectedLinter:        field(scan.detectedLinter, 'manifest'),
        detectedFormatter:     field(scan.detectedFormatter, 'manifest'),
        detectedRouter:        field(scan.detectedRouter, 'file-pattern'),
        httpClient:            field(scan.detectedHTTPClient || scan.detectedNetwork, 'manifest'),
        archPattern:           field(scan.detectedArchPattern, 'heuristic'),
        serviceStyle:          field(scan.detectedServiceStyle, 'heuristic'),
        featuresDir:           field(profile.featuresDir, 'manifest'),
        sourceDir:             field(profile.sourceDir, 'manifest'),
        layerNames:            arrayField(profile.layerNames, 'manifest'),
        localStorageName:      field(profile.localStorageName, 'manifest'),
        scaffoldTool:          field(scan.scaffoldTool, 'manifest'),
    };
}

/**
 * Compute a delta between the snapshot stored in governance-state and what an
 * audit just observed. Used by /audit Step 5 (v20+) to record scanner gaps as
 * structured data rather than narrative prose.
 *
 * Returns one entry per field where stored.value differs from observed.value.
 */
export interface ScannerDelta {
    attribute: keyof ScannerSnapshot;
    scannerSaid: string | string[] | null;
    realityIs: string | string[] | null;
    storedConfidence: Confidence;
}

export function diffSnapshot(stored: ScannerSnapshot, observed: ScannerSnapshot): ScannerDelta[] {
    const deltas: ScannerDelta[] = [];
    const keys = Object.keys(stored) as (keyof ScannerSnapshot)[];
    for (const k of keys) {
        const s = stored[k];
        const o = observed[k];
        if (!valuesEqual(s.value, o.value)) {
            deltas.push({
                attribute: k,
                scannerSaid: s.value,
                realityIs: o.value,
                storedConfidence: s.confidence,
            });
        }
    }
    return deltas;
}

function valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((v, i) => v === b[i]);
    }
    return false;
}
