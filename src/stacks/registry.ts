import type { StackAdapter } from './adapter.js';
import type { Stack } from '../types.js';

const _adapters: Map<Stack, StackAdapter> = new Map();

/**
 * Register a stack adapter. Adapters self-register by calling this
 * at module load time (top-level side effect).
 *
 * @throws Error if an adapter with the same id is already registered.
 */
export function registerAdapter(adapter: StackAdapter): void {
    if (_adapters.has(adapter.id)) {
        throw new Error(`Adapter already registered for stack: ${adapter.id}`);
    }
    _adapters.set(adapter.id, adapter);
}

/**
 * Retrieve a registered adapter by stack identifier.
 *
 * @throws Error if no adapter is registered for the given id.
 */
export function getAdapter(id: Stack): StackAdapter {
    const adapter = _adapters.get(id);
    if (!adapter) {
        throw new Error(`No adapter registered for stack: ${id}`);
    }
    return adapter;
}

/**
 * Return all registered adapters in registration order.
 */
export function getAllAdapters(): StackAdapter[] {
    return Array.from(_adapters.values());
}

/**
 * Return all registered stack identifiers in registration order.
 */
export function getSupportedStackIds(): Stack[] {
    return Array.from(_adapters.keys());
}
