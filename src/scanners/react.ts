import { existsSync } from 'fs';
import { join } from 'path';
import type { BaseProfile, ScanResult } from '../types.js';
import { pkgHas, fileExists, dirExists, readFileSafe, findFilesRecursive, countFiles } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';

export function scanReact(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('React details');

    // Next.js
    if (pkgHas(projectDir, 'next')) {
        if (dirExists(projectDir, 'app') || dirExists(projectDir, 'src', 'app')) {
            scan.detectedNextRouter = 'App Router'; scan.detectedBuildTool = 'next-app';
            log.detected('Next.js App Router');
            const dirs = [join(projectDir, 'src'), join(projectDir, 'app')].filter(d => existsSync(d));
            const rscCount = dirs.reduce((n, d) => n + findFilesRecursive(d, 6, f => /\.tsx?$/.test(f))
                .filter(f => readFileSafe(f).includes('"use client"')).length, 0);
            if (rscCount > 0) { scan.detectedRSC = true; log.detected(`RSC: ${rscCount} 'use client' files`); }
        } else if (dirExists(projectDir, 'pages') || dirExists(projectDir, 'src', 'pages')) {
            scan.detectedNextRouter = 'Pages Router'; scan.detectedBuildTool = 'next-pages';
            log.detected('Next.js Pages Router');
        }
        profile.stackDisplay = 'React (Next.js)';
    }

    // State — server + client
    let serverState = '', clientState = '';
    if (pkgHas(projectDir, '@tanstack/react-query') || pkgHas(projectDir, 'react-query')) {
        serverState = 'React Query'; log.detected('Server state: React Query');
    }
    if (pkgHas(projectDir, 'zustand')) clientState = 'Zustand';
    else if (pkgHas(projectDir, '@reduxjs/toolkit') || pkgHas(projectDir, 'redux')) clientState = 'Redux Toolkit';
    else if (pkgHas(projectDir, 'jotai')) clientState = 'Jotai';
    else if (pkgHas(projectDir, 'mobx')) clientState = 'MobX';
    if (clientState) log.detected(`Client state: ${clientState}`);

    if (serverState && clientState) {
        scan.detectedState = `${clientState} + ${serverState}`;
        profile.stateFramework = `${clientState} (client) + ${serverState} (server)`;
        profile.statePattern = `${clientState} for UI/client state, React Query useQuery/useMutation for server state`;
    } else if (serverState) {
        scan.detectedState = serverState; profile.stateFramework = serverState;
        profile.statePattern = 'useQuery(queryKey, queryFn) + useMutation() for server state; useState for local';
    } else if (clientState) {
        scan.detectedState = clientState; profile.stateFramework = clientState;
        const patterns: Record<string, string> = {
            Zustand: 'create<T>() store + useStore() selector hooks',
            'Redux Toolkit': 'createSlice + configureStore + useSelector + useDispatch',
            Jotai: 'atom() + useAtom() — no provider needed',
            MobX: '@observable + @action + @computed + observer() HOC',
        };
        profile.statePattern = patterns[clientState] || profile.statePattern;
    }

    // Router
    if (pkgHas(projectDir, '@tanstack/react-router')) { scan.detectedRouter = 'TanStack Router'; }
    else if (pkgHas(projectDir, 'react-router-dom')) { scan.detectedRouter = 'React Router DOM'; }
    if (scan.detectedRouter) log.detected(`Router: ${scan.detectedRouter}`);

    // Forms
    if (pkgHas(projectDir, 'react-hook-form')) scan.detectedFormLib = 'React Hook Form';
    else if (pkgHas(projectDir, 'formik')) scan.detectedFormLib = 'Formik';
    if (pkgHas(projectDir, 'zod')) scan.detectedFormLib = (scan.detectedFormLib ? scan.detectedFormLib + ' + ' : '') + 'Zod';

    // CSS
    if (pkgHas(projectDir, 'tailwindcss')) scan.detectedCSSApproach = 'Tailwind CSS';
    else if (pkgHas(projectDir, 'styled-components')) scan.detectedCSSApproach = 'styled-components';
    else if (pkgHas(projectDir, '@emotion/react')) scan.detectedCSSApproach = 'Emotion';
    if (scan.detectedCSSApproach) log.detected(`CSS: ${scan.detectedCSSApproach}`);

    // Build tool
    if (!scan.detectedBuildTool) {
        if (pkgHas(projectDir, 'vite')) { scan.detectedBuildTool = 'vite'; log.detected('Build: Vite'); }
        else if (pkgHas(projectDir, 'react-scripts')) { scan.detectedBuildTool = 'cra'; log.detected('Build: CRA'); }
    }

    // Source dir
    const hasSrc = dirExists(projectDir, 'src');
    if (hasSrc) {
        for (const c of ['src/features', 'src/pages', 'src/app', 'src']) {
            if (existsSync(join(projectDir, c))) { profile.sourceDir = `${c}/`; break; }
        }
    } else {
        for (const c of ['features', 'app', 'pages']) {
            if (existsSync(join(projectDir, c))) { profile.sourceDir = `${c}/`; break; }
        }
    }
    log.detected(`Source dir: ${profile.sourceDir}`);

    // Features dir
    if (dirExists(projectDir, 'features')) profile.featuresDir = 'features/';
    else if (dirExists(projectDir, 'src', 'features')) profile.featuresDir = 'src/features/';
    else profile.featuresDir = profile.sourceDir;

    // Service style
    const svcDirs = ['services', 'src/services', 'lib/services'].map(d => join(projectDir, d)).filter(d => existsSync(d));
    if (svcDirs.length) {
        const classCount = findFilesRecursive(svcDirs[0], 3, f => /\.tsx?$/.test(f))
            .filter(f => /^export class |^class /.test(readFileSafe(f))).length;
        if (classCount === 0) { scan.detectedServiceStyle = 'function'; log.detected('Services: function modules'); }
    }

    // Layer update for server state
    if (serverState) {
        profile.layerFlow = 'Component → Hook (React Query) → Service (fetch fns) → API client';
        profile.layerNames = ['Component', 'Hook', 'Service', 'API'];
    }

    // RM_BLOCK_DIRS
    const rmDirs = ['src', 'app', 'components', 'features', 'services', 'lib', 'hooks', 'types']
        .filter(d => dirExists(projectDir, d)).map(d => `${d}/`);
    rmDirs.push('public/');
    profile.rmBlockDirs = rmDirs.join(' ');

    // Clean cmd
    if (scan.detectedBuildTool === 'vite') profile.cleanCmd = `rm -rf dist node_modules && ${profile.installCmd}`;
    else if (scan.detectedBuildTool === 'cra') profile.cleanCmd = `rm -rf build node_modules && ${profile.installCmd}`;
    else profile.cleanCmd = `rm -rf .next node_modules && ${profile.installCmd}`;

    // High-risk
    const hrFiles = [
        'middleware.ts', 'middleware.js', 'next.config.js', 'next.config.mjs', 'next.config.ts',
        'src/main.tsx', 'src/index.tsx', 'src/App.tsx', 'app/layout.tsx', 'src/app/layout.tsx',
    ];
    for (const f of hrFiles) {
        if (fileExists(projectDir, f)) {
            const bn = f.split('/').pop()!;
            if (!scan.highRiskFiles.includes(bn)) scan.highRiskFiles.push(bn);
        }
    }

    // Scaffold
    if (fileExists(projectDir, 'plopfile.js') || fileExists(projectDir, 'plopfile.ts') || fileExists(projectDir, 'plopfile.mjs')) {
        scan.scaffoldTool = 'Plop'; scan.scaffoldCmdFeature = 'npx plop feature';
    } else if (fileExists(projectDir, '.hygen.js') || dirExists(projectDir, '_templates')) {
        scan.scaffoldTool = 'Hygen'; scan.scaffoldCmdFeature = 'npx hygen feature new';
    }
}
