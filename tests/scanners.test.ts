import { join } from 'path';
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { scanProject } from '../src/scanners/index.js';
import type { Stack } from '../src/types.js';

const FIXTURES = join(__dirname, 'fixtures');

function runScan(stack: Stack, fixture: string) {
    const dir = join(FIXTURES, fixture);
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();
    // Suppress console output during tests
    const origLog = console.log;
    console.log = () => { };
    scanProject(stack, dir, profile, scan);
    console.log = origLog;
    return { profile, scan };
}

describe('Flutter BLoC scanner', () => {
    const { profile, scan } = runScan('flutter', 'flutter-bloc');

    test('detects BLoC state management', () => {
        expect(scan.detectedState).toBe('BLoC');
        expect(profile.stateFramework).toBe('flutter_bloc / Cubit');
    });

    test('detects get_it + injectable DI', () => {
        expect(profile.diFramework).toBe('get_it + injectable');
    });

    test('detects go_router', () => {
        expect(scan.detectedRouter).toBe('go_router');
    });

    test('detects Dio network', () => {
        expect(scan.detectedNetwork).toBe('Dio');
    });

    test('detects Hive local DB', () => {
        expect(scan.detectedLocalDB).toBe('Hive');
    });

    test('detects code generation', () => {
        expect(scan.detectedCodegen).toBe(true);
        expect(scan.detectedCodegenCmd).toContain('build_runner');
    });

    test('has high-risk files', () => {
        expect(scan.highRiskFiles).toContain('main.dart');
    });
});

describe('Flutter Riverpod scanner', () => {
    const { profile, scan } = runScan('flutter', 'flutter-riverpod');

    test('detects Riverpod state', () => {
        expect(scan.detectedState).toBe('Riverpod');
        expect(profile.stateFramework).toBe('Riverpod');
    });

    test('sets Riverpod DI', () => {
        expect(profile.diFramework).toBe('Riverpod (ProviderScope)');
    });

    test('detects auto_route', () => {
        expect(scan.detectedRouter).toBe('auto_route');
    });

    test('detects Drift DB', () => {
        expect(scan.detectedLocalDB).toBe('Drift');
    });

    test('detects easy_localization', () => {
        expect(scan.detectedI18N).toBe('easy_localization');
    });
});

describe('React Next.js scanner', () => {
    const { profile, scan } = runScan('react', 'react-nextjs');

    test('detects React Query + Zustand', () => {
        expect(scan.detectedState).toBe('Zustand + React Query');
    });

    test('detects Tailwind CSS', () => {
        expect(scan.detectedCSSApproach).toBe('Tailwind CSS');
    });

    test('detects vitest', () => {
        expect(scan.detectedTestFramework).toBe('vitest');
    });

    test('detects prettier + eslint', () => {
        expect(scan.detectedFormatter).toBe('prettier');
        expect(scan.detectedLinter).toBe('eslint');
    });

    test('detects React Hook Form + Zod', () => {
        expect(scan.detectedFormLib).toContain('React Hook Form');
        expect(scan.detectedFormLib).toContain('Zod');
    });
});

describe('Node.js NestJS scanner', () => {
    const { profile, scan } = runScan('nodejs', 'nodejs-nestjs');

    test('detects NestJS framework', () => {
        expect(scan.detectedSubtype).toBe('nestjs');
        expect(profile.stackDisplay).toBe('Node.js (NestJS)');
    });

    test('detects Prisma ORM', () => {
        expect(scan.detectedORM).toBe('Prisma');
    });

    test('detects Swagger', () => {
        expect(scan.detectedSwagger).toBe(true);
    });

    test('detects Passport + JWT auth', () => {
        expect(scan.detectedAuth).toContain('Passport');
        expect(scan.detectedAuth).toContain('JWT');
    });

    test('detects BullMQ queue', () => {
        expect(scan.detectedQueue).toBe('BullMQ');
    });

    test('detects winston logger', () => {
        expect(scan.detectedLogger).toContain('winston');
    });

    test('detects class-validator', () => {
        expect(scan.detectedValidator).toBe(true);
        expect(scan.detectedValidationLib).toContain('class-validator');
    });

    test('sets TypeScript as language', () => {
        expect(scan.detectedLang).toBe('TypeScript');
        expect(profile.fileExt).toBe('.ts');
    });
});

describe('Angular 17 scanner', () => {
    const { profile, scan } = runScan('angular', 'angular-17');

    test('detects Angular version', () => {
        expect(scan.detectedAngularVersion).toBe('17.1.0');
    });

    test('detects NgRx state', () => {
        expect(scan.detectedState).toBe('NgRx');
        expect(profile.stateFramework).toBe('NgRx');
    });

    test('detects Angular Material', () => {
        expect(scan.detectedUILibs).toContain('Angular Material');
    });

    test('detects ngx-translate', () => {
        expect(scan.detectedI18N).toBe('ngx-translate');
    });

    test('detects SSR', () => {
        expect(scan.detectedSSR).toBe(true);
    });

    test('detects Karma + Jasmine', () => {
        expect(scan.detectedTestFramework).toBe('Karma + Jasmine');
    });
});

describe('Python FastAPI scanner', () => {
    const { profile, scan } = runScan('python', 'python-fastapi');

    test('detects FastAPI framework', () => {
        expect(scan.detectedSubtype).toBe('fastapi');
        expect(profile.stackDisplay).toBe('Python (FastAPI)');
    });

    test('detects SQLAlchemy ORM', () => {
        expect(scan.detectedORM).toBe('SQLAlchemy');
    });

    test('detects JWT auth', () => {
        expect(scan.detectedAuth).toBe('JWT');
    });

    test('detects Redis cache', () => {
        expect(scan.detectedLocalDB).toBe('Redis');
    });

    test('detects Celery queue', () => {
        expect(scan.detectedQueue).toBe('Celery');
    });

    test('detects ruff linter/formatter', () => {
        expect(scan.detectedLinter).toBe('ruff');
        expect(scan.detectedFormatter).toBe('ruff');
    });

    test('detects pytest', () => {
        expect(scan.detectedTestFramework).toBe('pytest');
    });

    test('detects httpx HTTP client', () => {
        expect(scan.detectedHTTPClient).toBe('httpx');
    });

    test('detects Pydantic validation', () => {
        expect(scan.detectedValidator).toBe(true);
    });
});

describe('Flutter legacy zone scanner', () => {
    const { scan } = runScan('flutter', 'flutter-legacy');

    test('detects legacy zones (lib/screens, lib/models, lib/services)', () => {
        expect(scan.hasLegacyZones).toBe(true);
        expect(scan.legacyZones).toContain('lib/screens/');
        expect(scan.legacyZones).toContain('lib/models/');
        expect(scan.legacyZones).toContain('lib/services/');
    });

    test('detects clean zone (lib/features)', () => {
        expect(scan.cleanZones).toContain('lib/features/');
    });

    test('legacyZoneNote describes dual-mode', () => {
        expect(scan.legacyZoneNote).toContain('Dual-mode');
        expect(scan.legacyZoneNote).toContain('lib/features/');
    });
});
