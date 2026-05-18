/**
 * ScannerSnapshot tests. Verifies the 15-field wrapper and the diff function
 * used by /audit Step 5 to emit scanner-deltas.
 */
import { scanResultToSnapshot, diffSnapshot } from '../src/utils/scanner-snapshot.js';
import { createDefaultScanResult } from '../src/types.js';
import { loadBaseProfile } from '../src/profiles.js';
import type { Stack } from '../src/types.js';

function mkProfile(stack: Stack = 'react') { return loadBaseProfile(stack); }

describe('scanResultToSnapshot', () => {
    it('returns all 15 expected fields', () => {
        const snap = scanResultToSnapshot(createDefaultScanResult(), mkProfile());
        const keys = Object.keys(snap).sort();
        expect(keys).toEqual([
            'archPattern', 'detectedFormatter', 'detectedLinter', 'detectedORM',
            'detectedRouter', 'detectedTestFramework', 'diFramework', 'featuresDir',
            'httpClient', 'layerNames', 'localStorageName', 'scaffoldTool',
            'serviceStyle', 'sourceDir', 'stateFramework',
        ]);
    });

    it('marks every field as unknown when scan and profile are fully blank', () => {
        const scan = createDefaultScanResult();
        // createDefaultScanResult() seeds detectedServiceStyle='class' — blank it
        // for this test so we can verify the unknown path.
        scan.detectedServiceStyle = '';
        const profile = mkProfile();
        profile.stateFramework = '';
        profile.diFramework = '';
        profile.featuresDir = '';
        profile.sourceDir = '';
        profile.layerNames = [];
        profile.localStorageName = '';
        const snap = scanResultToSnapshot(scan, profile);
        for (const [, f] of Object.entries(snap)) {
            expect(f.value).toBeNull();
            expect(f.confidence).toBe('unknown');
        }
    });

    it('marks profile-derived fields as high confidence', () => {
        const profile = mkProfile();
        profile.featuresDir = 'src/features/';
        profile.sourceDir = 'src/';
        profile.layerNames = ['Component', 'Hook', 'Service'];
        const snap = scanResultToSnapshot(createDefaultScanResult(), profile);
        expect(snap.featuresDir.confidence).toBe('high');
        expect(snap.featuresDir.source).toBe('manifest');
        expect(snap.sourceDir.confidence).toBe('high');
        expect(snap.layerNames.confidence).toBe('high');
        expect(snap.layerNames.value).toEqual(['Component', 'Hook', 'Service']);
    });

    it('marks scan-derived ORM/test/linter/formatter as high when present', () => {
        const scan = createDefaultScanResult();
        scan.detectedORM = 'Prisma';
        scan.detectedTestFramework = 'Jest';
        scan.detectedLinter = 'ESLint';
        scan.detectedFormatter = 'Prettier';
        const snap = scanResultToSnapshot(scan, mkProfile());
        expect(snap.detectedORM.value).toBe('Prisma');
        expect(snap.detectedORM.confidence).toBe('high');
        expect(snap.detectedTestFramework.confidence).toBe('high');
        expect(snap.detectedLinter.confidence).toBe('high');
        expect(snap.detectedFormatter.confidence).toBe('high');
    });

    it('marks heuristic-derived archPattern/serviceStyle as medium when present', () => {
        const scan = createDefaultScanResult();
        scan.detectedArchPattern = 'clean';
        scan.detectedServiceStyle = 'class';
        const snap = scanResultToSnapshot(scan, mkProfile());
        expect(snap.archPattern.confidence).toBe('medium');
        expect(snap.serviceStyle.confidence).toBe('medium');
    });

    it('prefers scan.detectedHTTPClient over scan.detectedNetwork for httpClient', () => {
        const scan = createDefaultScanResult();
        scan.detectedHTTPClient = 'axios';
        scan.detectedNetwork = 'fetch';
        const snap = scanResultToSnapshot(scan, mkProfile());
        expect(snap.httpClient.value).toBe('axios');
    });

    it('falls back to scan.detectedNetwork when detectedHTTPClient is empty', () => {
        const scan = createDefaultScanResult();
        scan.detectedHTTPClient = '';
        scan.detectedNetwork = 'fetch';
        const snap = scanResultToSnapshot(scan, mkProfile());
        expect(snap.httpClient.value).toBe('fetch');
    });

    it('treats DI=N/A as not set (falls back to scan.detectedDI)', () => {
        const profile = mkProfile();
        profile.diFramework = 'N/A';
        const scan = createDefaultScanResult();
        scan.detectedDI = 'tsyringe';
        const snap = scanResultToSnapshot(scan, profile);
        expect(snap.diFramework.value).toBe('tsyringe');
    });

    it('every value field is either a string, string[], or null', () => {
        const snap = scanResultToSnapshot(createDefaultScanResult(), mkProfile());
        for (const [, f] of Object.entries(snap)) {
            const v = f.value;
            const ok = v === null || typeof v === 'string' || Array.isArray(v);
            expect(ok).toBe(true);
        }
    });
});

describe('diffSnapshot', () => {
    it('returns no deltas when both snapshots are identical', () => {
        const snap = scanResultToSnapshot(createDefaultScanResult(), mkProfile());
        expect(diffSnapshot(snap, snap)).toEqual([]);
    });

    it('detects a single field divergence', () => {
        const a = scanResultToSnapshot(createDefaultScanResult(), mkProfile());
        const scanB = createDefaultScanResult();
        scanB.detectedORM = 'Drizzle';
        const b = scanResultToSnapshot(scanB, mkProfile());
        const deltas = diffSnapshot(a, b);
        expect(deltas.length).toBe(1);
        expect(deltas[0].attribute).toBe('detectedORM');
        expect(deltas[0].scannerSaid).toBeNull();
        expect(deltas[0].realityIs).toBe('Drizzle');
    });

    it('records stored confidence in the delta entry', () => {
        const scanA = createDefaultScanResult();
        scanA.detectedORM = 'Prisma';
        const a = scanResultToSnapshot(scanA, mkProfile());
        const scanB = createDefaultScanResult();
        scanB.detectedORM = 'Drizzle';
        const b = scanResultToSnapshot(scanB, mkProfile());
        const deltas = diffSnapshot(a, b);
        expect(deltas[0].storedConfidence).toBe('high');
    });

    it('handles array fields (layerNames) correctly', () => {
        const profileA = mkProfile();
        profileA.layerNames = ['A', 'B'];
        const profileB = mkProfile();
        profileB.layerNames = ['A', 'B', 'C'];
        const a = scanResultToSnapshot(createDefaultScanResult(), profileA);
        const b = scanResultToSnapshot(createDefaultScanResult(), profileB);
        const deltas = diffSnapshot(a, b);
        const layerDelta = deltas.find(d => d.attribute === 'layerNames');
        expect(layerDelta).toBeDefined();
        expect(layerDelta!.realityIs).toEqual(['A', 'B', 'C']);
    });

    it('considers equal-length arrays with same items as equal', () => {
        const profileA = mkProfile();
        profileA.layerNames = ['A', 'B'];
        const profileB = mkProfile();
        profileB.layerNames = ['A', 'B'];
        const a = scanResultToSnapshot(createDefaultScanResult(), profileA);
        const b = scanResultToSnapshot(createDefaultScanResult(), profileB);
        const deltas = diffSnapshot(a, b);
        const layerDelta = deltas.find(d => d.attribute === 'layerNames');
        expect(layerDelta).toBeUndefined();
    });
});
