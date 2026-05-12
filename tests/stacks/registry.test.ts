import { registerAdapter, getAdapter, getAllAdapters, getSupportedStackIds } from '../../src/stacks/registry.js';
import type { StackAdapter } from '../../src/stacks/adapter.js';
import type { Stack, ScanResult } from '../../src/types.js';

function createMockAdapter(id: Stack, displayName = 'Mock'): StackAdapter {
    return {
        id,
        displayName,
        nameHint: 'test-hint',
        validateName: () => true,
        runPrompts: async (base) => base,
        scaffold: async () => { },
        scanHints: () => ({} as Partial<ScanResult>),
        postSetup: async () => { },
    };
}

describe('Adapter Registry', () => {
    // Note: Since the registry uses module-level state, tests run in sequence
    // and build on each other. The first adapter registered is 'flutter'.

    const flutterAdapter = createMockAdapter('flutter', 'Flutter');
    const nextAdapter = createMockAdapter('next', 'Next.js');

    describe('registerAdapter', () => {
        it('should register an adapter successfully', () => {
            expect(() => registerAdapter(flutterAdapter)).not.toThrow();
        });

        it('should register a second adapter successfully', () => {
            expect(() => registerAdapter(nextAdapter)).not.toThrow();
        });

        it('should throw on duplicate id with correct message', () => {
            const duplicate = createMockAdapter('flutter', 'Flutter Duplicate');
            expect(() => registerAdapter(duplicate)).toThrow(
                'Adapter already registered for stack: flutter'
            );
        });
    });

    describe('getAdapter', () => {
        it('should return the registered adapter by id', () => {
            const result = getAdapter('flutter');
            expect(result).toBe(flutterAdapter);
        });

        it('should return the correct adapter for each id', () => {
            expect(getAdapter('next')).toBe(nextAdapter);
        });

        it('should throw on unknown id with correct message', () => {
            expect(() => getAdapter('kotlin')).toThrow(
                'No adapter registered for stack: kotlin'
            );
        });
    });

    describe('getAllAdapters', () => {
        it('should return all registered adapters', () => {
            const all = getAllAdapters();
            expect(all).toHaveLength(2);
            expect(all).toContain(flutterAdapter);
            expect(all).toContain(nextAdapter);
        });

        it('should return adapters in registration order', () => {
            const all = getAllAdapters();
            expect(all[0]).toBe(flutterAdapter);
            expect(all[1]).toBe(nextAdapter);
        });
    });

    describe('getSupportedStackIds', () => {
        it('should return all registered stack ids', () => {
            const ids = getSupportedStackIds();
            expect(ids).toEqual(['flutter', 'next']);
        });

        it('should return ids in registration order', () => {
            const ids = getSupportedStackIds();
            expect(ids[0]).toBe('flutter');
            expect(ids[1]).toBe('next');
        });
    });
});
