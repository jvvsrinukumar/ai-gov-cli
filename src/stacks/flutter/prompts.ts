import { input, confirm } from '@inquirer/prompts';
import type { ScaffoldContext } from '../adapter.js';

export interface FlutterEndpoint {
    method: string;
    path: string;
}

export interface FlutterService {
    name: string;
    urls: {
        local: string;
        dev: string;
        qa: string;
        staging: string;
        prod: string;
    };
    headers: string;
    endpoints: FlutterEndpoint[];
}

export interface FlutterContext extends ScaffoldContext {
    androidPackageId: string;
    iosBundleId: string;
    flutterVersion: string;
    services: FlutterService[];
}

const ENVS = ['local', 'dev', 'qa', 'staging', 'prod'] as const;
type Env = (typeof ENVS)[number];

function defaultUrl(env: string, svcName: string): string {
    if (env === 'local') return 'http://localhost:3000';
    return `https://${env}-${svcName}-api.example.com`;
}

async function collectServiceUrls(
    svcName: string,
): Promise<Record<Env, string>> {
    const urls: Partial<Record<Env, string>> = {};
    for (const env of ENVS) {
        const fallback = defaultUrl(env, svcName);
        const val = await input({
            message: `  ${env} URL [${fallback}]:`,
            default: fallback,
        });
        urls[env] = val.trim() || fallback;
    }
    return urls as Record<Env, string>;
}

async function collectEndpoints(): Promise<FlutterEndpoint[]> {
    const endpoints: FlutterEndpoint[] = [];
    console.log("    Format: METHOD /path (e.g. POST /auth/login). Blank to stop.");
    while (true) {
        const line = await input({ message: '    endpoint:' });
        const trimmed = line.trim();
        if (!trimmed) break;
        const parts = trimmed.split(/\s+/, 2);
        if (parts.length === 2) {
            endpoints.push({ method: parts[0].toUpperCase(), path: parts[1] });
        } else {
            endpoints.push({ method: 'GET', path: parts[0] });
        }
    }
    return endpoints;
}

async function collectServices(): Promise<FlutterService[]> {
    const services: FlutterService[] = [];
    console.log('\n── API Services (optional) ────────────────────────');
    console.log('  Configure backend services now, or skip and add later.');
    console.log('  Press Enter with no name to skip/finish.');
    console.log(`  Environments: ${ENVS.join(', ')}\n`);

    let idx = 1;
    while (true) {
        const rawName = await input({
            message: `Service ${idx} name (snake_case, e.g. node) [skip]:`,
        });
        const svcName = rawName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!svcName) break;

        console.log(`  Base URLs for '${svcName}' per environment:`);
        const urls = await collectServiceUrls(svcName);

        const rawHeaders = await input({
            message: '  Custom headers? (key:value,key:value) [none]:',
        });

        const addEps = await confirm({
            message: '  Add endpoints now?',
            default: false,
        });
        const endpoints = addEps ? await collectEndpoints() : [];

        services.push({
            name: svcName,
            urls,
            headers: rawHeaders.trim(),
            endpoints,
        });
        idx++;
    }

    if (services.length === 0) {
        console.log('  → Using default services (api + node). See NETWORK_GUIDE.md to update later.');
        services.push({
            name: 'api',
            urls: {
                local: 'http://localhost:3000',
                dev: 'https://dev-api.example.com',
                qa: 'https://qa-api.example.com',
                staging: 'https://staging-api.example.com',
                prod: 'https://api.example.com',
            },
            headers: '',
            endpoints: [],
        });
        services.push({
            name: 'node',
            urls: {
                local: 'http://localhost:3001',
                dev: 'https://dev-node.example.com',
                qa: 'https://qa-node.example.com',
                staging: 'https://staging-node.example.com',
                prod: 'https://node.example.com',
            },
            headers: '',
            endpoints: [],
        });
    }

    return services;
}

export function validateFlutterName(name: string): string | true {
    return /^[a-z][a-z0-9_]*$/.test(name)
        ? true
        : 'App name must be snake_case (lowercase letters, digits, underscores; must start with a letter).';
}

function validateAndroidPackageId(id: string): string | true {
    if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(id)) {
        return 'Android package ID must be reverse-domain notation with at least 3 segments (e.g. com.example.myapp).';
    }
    return true;
}

function validateIosBundleId(id: string): string | true {
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(id)) {
        return 'iOS bundle ID must contain only letters, digits, hyphens, and dots.';
    }
    return true;
}

function validateFlutterVersion(ver: string): string | true {
    if (!/^\d+\.\d+\.\d+$/.test(ver)) {
        return 'Flutter version must be in semver format (e.g. 3.41.6).';
    }
    return true;
}

export async function collectFlutterPrompts(base: ScaffoldContext): Promise<FlutterContext> {
    const androidPackageId = await input({
        message: 'Android package ID (e.g. com.example.myapp):',
        validate(v: string): string | true {
            return validateAndroidPackageId(v.trim());
        },
        transformer: (v: string) => v.trim(),
    });

    const defaultIos = androidPackageId.trim();
    const iosBundleId = await input({
        message: `iOS bundle ID [${defaultIos}]:`,
        default: defaultIos,
        validate(v: string): string | true {
            return validateIosBundleId(v.trim());
        },
        transformer: (v: string) => v.trim(),
    });

    const flutterVersion = await input({
        message: 'Flutter version (e.g. 3.41.6):',
        validate(v: string): string | true {
            return validateFlutterVersion(v.trim());
        },
        transformer: (v: string) => v.trim(),
    });

    const services = await collectServices();

    return {
        ...base,
        androidPackageId: androidPackageId.trim(),
        iosBundleId: iosBundleId.trim(),
        flutterVersion: flutterVersion.trim(),
        services,
    };
}

