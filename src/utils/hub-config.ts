import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

/** Hub connection configuration read from .ai-gov/config.json */
export interface HubConfig {
    hub: string;       // Hub server URL
    project: string;   // Project name
    team: string;      // Team name
    platform: string;  // Platform identifier
}

/**
 * Reads hub configuration from <projectDir>/.ai-gov/config.json.
 * Returns a HubConfig with defaults for missing fields, or null if the file
 * is missing, contains unparseable JSON, or parses to a non-object value.
 */
export function readHubConfig(projectDir: string): HubConfig | null {
    const configPath = join(projectDir, '.ai-gov', 'config.json');

    if (!existsSync(configPath)) return null;

    let raw: string;
    try {
        raw = readFileSync(configPath, 'utf-8');
    } catch {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    // Must be a plain object (not array, null, string, number, etc.)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }

    const obj = parsed as Record<string, unknown>;

    return {
        hub: typeof obj.hub === 'string' ? obj.hub : '',
        project: typeof obj.project === 'string' ? obj.project : basename(projectDir),
        team: typeof obj.team === 'string' ? obj.team : 'ungrouped',
        platform: typeof obj.platform === 'string' ? obj.platform : 'unknown',
    };
}
