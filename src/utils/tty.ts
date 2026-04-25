/**
 * Reliable synchronous terminal input.
 *
 * Problem: Node.js sets fd 0 (process.stdin) to non-blocking mode when the
 * stream object is created. Calling readSync(0, ...) then returns 0 bytes
 * immediately — even in a real TTY — so prompts appear to "skip" without
 * waiting for input.
 *
 * Fix: open /dev/tty as a separate fd. /dev/tty always refers to the
 * controlling terminal and opens in blocking mode, independent of how
 * Node.js has configured fd 0. On systems with no controlling terminal
 * (CI, `node -e`, subprocess) open() throws ENXIO — we use that as the
 * definitive TTY check instead of relying on process.stdin.isTTY.
 */
import { openSync, readSync, closeSync } from 'fs';

let _cachedIsTTY: boolean | undefined;

/** True only when a real interactive terminal is attached. */
export function isInteractiveTTY(): boolean {
    if (_cachedIsTTY !== undefined) return _cachedIsTTY;
    if (process.platform === 'win32') {
        _cachedIsTTY = Boolean(process.stdin.isTTY);
        return _cachedIsTTY;
    }
    // The definitive test: actually open /dev/tty.
    // Succeeds in a real terminal; throws ENXIO in CI / piped / node -e.
    try {
        const fd = openSync('/dev/tty', 'r');
        closeSync(fd);
        _cachedIsTTY = true;
    } catch {
        _cachedIsTTY = false;
    }
    return _cachedIsTTY;
}

/**
 * Read one line from the terminal synchronously.
 * Returns the trimmed string. Returns '' if not interactive.
 */
export function readTTYLine(): string {
    if (process.platform === 'win32') {
        try {
            const buf = Buffer.alloc(256);
            const n = readSync(0, buf, 0, 256, null);
            return buf.subarray(0, n).toString().trim();
        } catch {
            return '';
        }
    }
    // Unix: open /dev/tty fresh each time — always blocking
    try {
        const fd = openSync('/dev/tty', 'r');
        try {
            const buf = Buffer.alloc(256);
            const n = readSync(fd, buf, 0, 256, null);
            return buf.subarray(0, n).toString().trim();
        } finally {
            closeSync(fd);
        }
    } catch {
        return '';
    }
}
