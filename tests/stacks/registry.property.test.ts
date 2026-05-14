/**
 * Property-based tests for the Adapter Registry.
 *
 * Feature: project-init
 * Uses jest.resetModules() to get a fresh registry state for each test.
 */
import * as fc from 'fast-check';
import type { StackAdapter } from '../../src/stacks/adapter.js';
import type { Stack, ScanResult } from '../../src/types.js';

const ALL_STACKS: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];

/** Create a minimal mock StackAdapter for a given Stack id */
function createMockAdapter(id: Stack, displayName?: string): StackAdapter {
    return {
        id,
        displayName: displayName ?? `Mock ${id}`,
        nameHint: 'test-hint',
        validateName: () => true,
        runPrompts: async (base) => base,
        scaffold: async () => { },
        scanHints: () => ({} as Partial<ScanResult>),
        postSetup: async () => { },
    };
}

/** Arbitrary that picks a unique subset of Stack IDs (at least 1) */
const uniqueStackSubset = fc.shuffledSubarray(ALL_STACKS, { minLength: 1 });

/** Arbitrary that generates a string NOT in the ALL_STACKS set */
const unregisteredString = fc.string({ minLength: 1 }).filter(
    (s) => !ALL_STACKS.includes(s as Stack)
);

describe('Feature: project-init, Property 1: Registry Lookup Invariant', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    /**
     * **Validates: Requirements 1.3, 1.5, 1.6, 3.8**
     *
     * For any StackAdapter registered via registerAdapter(adapter),
     * getAdapter(adapter.id) returns that exact instance,
     * getAllAdapters() includes it, and
     * getSupportedStackIds() includes adapter.id.
     */
    it('registered adapter is retrievable by id, included in getAllAdapters, id in getSupportedStackIds', async () => {
        await fc.assert(
            fc.asyncProperty(uniqueStackSubset, async (stackIds) => {
                // Fresh registry for each run
                jest.resetModules();
                const { registerAdapter, getAdapter, getAllAdapters, getSupportedStackIds } =
                    await import('../../src/stacks/registry.js');

                const adapters = stackIds.map((id) => createMockAdapter(id));

                // Register all adapters
                for (const adapter of adapters) {
                    registerAdapter(adapter);
                }

                // Verify each adapter
                for (const adapter of adapters) {
                    // getAdapter returns the exact same instance
                    const retrieved = getAdapter(adapter.id);
                    expect(retrieved).toBe(adapter);

                    // getAllAdapters includes it
                    const all = getAllAdapters();
                    expect(all).toContain(adapter);

                    // getSupportedStackIds includes the id
                    const ids = getSupportedStackIds();
                    expect(ids).toContain(adapter.id);
                }
            }),
            { numRuns: 100 }
        );
    });
});

describe('Feature: project-init, Property 2: Registry Error on Unknown Identifier', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    /**
     * **Validates: Requirements 1.4**
     *
     * For any string value not present in the set of registered stack identifiers,
     * getAdapter(id) throws an Error whose message contains the exact string attempted.
     */
    it('getAdapter throws for any unregistered string', async () => {
        await fc.assert(
            fc.asyncProperty(
                uniqueStackSubset,
                unregisteredString,
                async (registeredIds, unknownId) => {
                    jest.resetModules();
                    const { registerAdapter, getAdapter } =
                        await import('../../src/stacks/registry.js');

                    // Register a subset of adapters
                    for (const id of registeredIds) {
                        registerAdapter(createMockAdapter(id));
                    }

                    // Attempting to get an unregistered id should throw
                    expect(() => getAdapter(unknownId as Stack)).toThrow(
                        `No adapter registered for stack: ${unknownId}`
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Feature: project-init, Property 3: Registry Preserves Registration Order', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    /**
     * **Validates: Requirements 1.7**
     *
     * For any sequence of StackAdapter registrations,
     * getAllAdapters() returns adapters in the same order they were registered.
     */
    it('getAllAdapters returns adapters in registration order', async () => {
        await fc.assert(
            fc.asyncProperty(uniqueStackSubset, async (stackIds) => {
                jest.resetModules();
                const { registerAdapter, getAllAdapters, getSupportedStackIds } =
                    await import('../../src/stacks/registry.js');

                const adapters = stackIds.map((id) => createMockAdapter(id));

                for (const adapter of adapters) {
                    registerAdapter(adapter);
                }

                const allAdapters = getAllAdapters();
                const allIds = getSupportedStackIds();

                // Same length
                expect(allAdapters).toHaveLength(stackIds.length);
                expect(allIds).toHaveLength(stackIds.length);

                // Same order
                for (let i = 0; i < stackIds.length; i++) {
                    expect(allAdapters[i]).toBe(adapters[i]);
                    expect(allIds[i]).toBe(stackIds[i]);
                }
            }),
            { numRuns: 100 }
        );
    });
});

describe('Feature: project-init, Property 4: Duplicate Registration Error', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    /**
     * **Validates: Requirements 3.9**
     *
     * For any StackAdapter that has already been registered,
     * calling registerAdapter again with an adapter having the same id
     * throws an Error with message "Adapter already registered for stack: {id}".
     */
    it('re-registering same id throws with correct message', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...ALL_STACKS),
                async (stackId) => {
                    jest.resetModules();
                    const { registerAdapter } =
                        await import('../../src/stacks/registry.js');

                    const adapter1 = createMockAdapter(stackId, 'First');
                    const adapter2 = createMockAdapter(stackId, 'Second');

                    // First registration succeeds
                    registerAdapter(adapter1);

                    // Second registration with same id throws
                    expect(() => registerAdapter(adapter2)).toThrow(
                        `Adapter already registered for stack: ${stackId}`
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
