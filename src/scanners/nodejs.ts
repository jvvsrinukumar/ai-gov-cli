import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { BaseProfile, ScanResult } from '../types.js';
import { pkgHas, findPackageJson, readFileSafe, fileExists, dirExists, findFilesRecursive, countFiles } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';

export function scanNodejs(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Node.js details');
    scanLanguageRuntime(projectDir, profile, scan);
    scanFramework(projectDir, profile, scan);
    scanDI(projectDir, profile, scan);
    scanDatabase(projectDir, profile, scan);
    scanAuth(projectDir, profile, scan);
    scanAPIDocs(projectDir, profile, scan);
    scanArchitecture(projectDir, profile, scan);
    scanRealtime(projectDir, scan);
    scanSchedulers(projectDir, scan);
    scanUploadMedia(projectDir, scan);
    scanEmail(projectDir, scan);
    scanCloud(projectDir, scan);
    scanLogging(projectDir, scan);
    scanToolingDX(projectDir, profile, scan);
    scanTesting(projectDir, profile, scan);
    scanNaming(projectDir, profile, scan);
    scanTemplateEngines(projectDir, scan);
    scanValidation(projectDir, scan);
    scanAPIType(projectDir, scan);
    scanSourceDir(projectDir, profile, scan);
    scanHighRiskNodejs(projectDir, profile, scan);
    scanScaffold(projectDir, scan);
    scanBuildCommands(projectDir, profile, scan);
    scanErrorPattern(profile, scan);
}

function scanLanguageRuntime(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Language & runtime');
    if (fileExists(projectDir, 'tsconfig.json') || pkgHas(projectDir, 'typescript')) {
        scan.detectedLang = 'TypeScript'; profile.fileExt = '.ts'; profile.formatExtensions = '.ts .js';
        log.detected('Language: TypeScript');
    } else {
        const srcDir = join(projectDir, 'src');
        const tsCount = existsSync(srcDir) ? countFiles(srcDir, /\.ts$/) : 0;
        const jsCount = existsSync(srcDir) ? countFiles(srcDir, /\.js$/) : 0;
        if (tsCount > jsCount && tsCount > 0) {
            scan.detectedLang = 'TypeScript'; profile.fileExt = '.ts'; profile.formatExtensions = '.ts .js';
            log.detected(`Language: TypeScript (${tsCount} .ts files)`);
        } else {
            scan.detectedLang = 'JavaScript'; profile.fileExt = '.js'; profile.formatExtensions = '.js';
            log.detected(`Language: JavaScript (${jsCount} .js files)`);
        }
    }

    // v14.2: ESM vs CommonJS — tsconfig.json is source of truth for TypeScript projects
    const pkgFile = findPackageJson(projectDir);
    const pkgContent = pkgFile ? readFileSafe(pkgFile) : '';
    const pkgType = pkgContent.match(/"type"\s*:\s*"(module|commonjs)"/)?.[1] || '';

    if (pkgType === 'module') {
        scan.detectedModuleSystem = 'ESM';
        profile.importStyle = 'import/export (ESM) — node builtins → third-party → project local';
        log.detected('Module system: ESM (package.json type=module)');
    } else if (pkgType === 'commonjs') {
        scan.detectedModuleSystem = 'CommonJS';
        profile.importStyle = 'require/module.exports (CJS) — node builtins → third-party → project local';
        log.detected('Module system: CommonJS (package.json type=commonjs)');
    } else if (scan.detectedLang === 'TypeScript' && fileExists(projectDir, 'tsconfig.json')) {
        // v14.2: Read tsconfig module field — authoritative for TypeScript
        const tsContent = readFileSafe(join(projectDir, 'tsconfig.json'));
        const tsModule = (tsContent.match(/"module"\s*:\s*"([^"]+)"/)?.[1] || '').toLowerCase();
        if (tsModule === 'commonjs') {
            scan.detectedModuleSystem = 'CommonJS';
            profile.importStyle = 'import/export (TS→CJS) — node builtins → third-party → project local';
            log.detected('Module system: CommonJS (tsconfig module=commonjs; TS import syntax compiles to require)');
        } else if (['esnext', 'es2020', 'es2022', 'nodenext', 'node16', 'preserve'].includes(tsModule)) {
            scan.detectedModuleSystem = 'ESM';
            profile.importStyle = 'import/export (ESM) — node builtins → third-party → project local';
            log.detected(`Module system: ESM (tsconfig module=${tsModule})`);
        } else {
            // Unknown or missing — fall back to .js file counting only (TS files always use import syntax)
            const srcDir = join(projectDir, 'src');
            const jsFiles = existsSync(srcDir) ? findFilesRecursive(srcDir, 4, f => /\.js$/.test(f)) : [];
            const esmCount = jsFiles.filter(f => /^(import |export )/.test(readFileSafe(f))).length;
            const cjsCount = jsFiles.filter(f => readFileSafe(f).includes('require(')).length;
            scan.detectedModuleSystem = esmCount > cjsCount ? 'ESM' : 'CommonJS';
            profile.importStyle = scan.detectedModuleSystem === 'ESM'
                ? 'import/export (ESM) — node builtins → third-party → project local'
                : 'import/export (TS→CJS) — node builtins → third-party → project local';
            log.detected(`Module system: ${scan.detectedModuleSystem} (inferred, tsconfig module=${tsModule || 'unset'})`);
        }
    } else {
        // Pure JS project — count .js files only (not .ts which always uses import syntax)
        const srcDir = join(projectDir, 'src');
        const jsFiles = existsSync(srcDir) ? findFilesRecursive(srcDir, 4, f => /\.js$/.test(f)) : [];
        const esmCount = jsFiles.filter(f => /^(import |export )/.test(readFileSafe(f))).length;
        const cjsCount = jsFiles.filter(f => readFileSafe(f).includes('require(')).length;
        if (esmCount > cjsCount) {
            scan.detectedModuleSystem = 'ESM';
            profile.importStyle = 'import/export (ESM) — node builtins → third-party → project local';
        } else {
            scan.detectedModuleSystem = 'CommonJS';
            profile.importStyle = 'require/module.exports (CJS) — node builtins → third-party → project local';
        }
        log.detected(`Module system: ${scan.detectedModuleSystem}`);
    }

    // Node version
    if (fileExists(projectDir, '.nvmrc')) {
        scan.detectedNodeVersion = readFileSafe(join(projectDir, '.nvmrc')).trim().replace(/^v/, '');
    } else if (fileExists(projectDir, '.node-version')) {
        scan.detectedNodeVersion = readFileSafe(join(projectDir, '.node-version')).trim().replace(/^v/, '');
    }
    if (scan.detectedNodeVersion) log.detected(`Node version: ${scan.detectedNodeVersion}`);
}

// v14.2: Framework detection with NestJS source verification
function scanFramework(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Framework');

    // v14.2: NestJS — verify @Module()/@Injectable() decorators exist in source
    let nestjsVerified = false;
    if (pkgHas(projectDir, '@nestjs/core')) {
        const srcDir = join(projectDir, 'src');
        if (existsSync(srcDir)) {
            const nestFiles = findFilesRecursive(srcDir, 6, f => /\.ts$/.test(f))
                .filter(f => /@(Module|Injectable|Controller)\(/.test(readFileSafe(f)));
            if (nestFiles.length > 0) {
                nestjsVerified = true;
                log.detected(`Framework: NestJS (verified: ${nestFiles.length} files with decorators)`);
            } else {
                log.detected('WARNING: @nestjs/core in deps but no @Module/@Injectable decorators in src/');
            }
        } else {
            nestjsVerified = true; // No src/ — trust the dependency
            log.detected('Framework: NestJS (from deps, no src/ to verify)');
        }
    }

    if (nestjsVerified) { scan.detectedSubtype = 'nestjs'; profile.diFramework = 'NestJS DI'; }
    else if (pkgHas(projectDir, 'fastify')) { scan.detectedSubtype = 'fastify'; }
    else if (pkgHas(projectDir, '@hapi/hapi')) { scan.detectedSubtype = 'hapi'; }
    else if (pkgHas(projectDir, 'koa')) { scan.detectedSubtype = 'koa'; }
    else if (pkgHas(projectDir, '@adonisjs/core')) { scan.detectedSubtype = 'adonis'; profile.diFramework = 'AdonisJS IoC'; }
    else if (pkgHas(projectDir, 'hono')) { scan.detectedSubtype = 'hono'; }
    else if (pkgHas(projectDir, 'express')) { scan.detectedSubtype = 'express'; }
    else { scan.detectedSubtype = 'plain'; }

    if (!nestjsVerified) log.detected(`Framework: ${scan.detectedSubtype}`);

    const subtypeDisplay: Record<string, string> = {
        nestjs: 'Node.js (NestJS)', express: 'Node.js (Express)', fastify: 'Node.js (Fastify)',
        koa: 'Node.js (Koa)', hapi: 'Node.js (Hapi)', adonis: 'Node.js (AdonisJS)', hono: 'Node.js (Hono)',
    };
    profile.stackDisplay = subtypeDisplay[scan.detectedSubtype] || 'Node.js';

    if (scan.detectedSubtype === 'nestjs') {
        profile.fileExt = '.ts'; profile.formatExtensions = '.ts .js'; scan.detectedLang = 'TypeScript';
        profile.errorPattern = 'HttpException subclasses + GlobalExceptionFilter';
        profile.importStyle = 'node: builtins → third-party → @app/ → relative';
        profile.namingFiles = 'kebab-case'; profile.namingUISuffix = 'Controller';
    }
}

// v14.2: DI detection for non-NestJS projects
function scanDI(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    if (profile.diFramework && profile.diFramework !== 'N/A') return; // Already set by framework
    if (pkgHas(projectDir, 'tsyringe')) { profile.diFramework = 'tsyringe'; log.detected('DI: tsyringe'); }
    else if (pkgHas(projectDir, 'inversify')) { profile.diFramework = 'Inversify'; log.detected('DI: Inversify'); }
    else if (pkgHas(projectDir, 'awilix')) { profile.diFramework = 'Awilix'; log.detected('DI: Awilix'); }
    else if (pkgHas(projectDir, 'typedi')) { profile.diFramework = 'TypeDI'; log.detected('DI: TypeDI'); }
    else if (pkgHas(projectDir, 'bottlejs')) { profile.diFramework = 'BottleJS'; log.detected('DI: BottleJS'); }
}

function scanDatabase(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Database');
    if (pkgHas(projectDir, '@prisma/client')) scan.detectedORM = 'Prisma';
    else if (pkgHas(projectDir, 'typeorm')) scan.detectedORM = 'TypeORM';
    else if (pkgHas(projectDir, 'drizzle-orm')) scan.detectedORM = 'Drizzle';
    else if (pkgHas(projectDir, 'mongoose')) scan.detectedORM = 'Mongoose';
    else if (pkgHas(projectDir, 'sequelize')) scan.detectedORM = 'Sequelize';
    else if (pkgHas(projectDir, 'mikro-orm') || pkgHas(projectDir, '@mikro-orm/core')) scan.detectedORM = 'MikroORM';
    else if (pkgHas(projectDir, 'objection')) scan.detectedORM = 'Objection.js';
    if (scan.detectedORM) log.detected(`ORM: ${scan.detectedORM}`);

    const drivers: string[] = [];
    if (pkgHas(projectDir, 'mysql2')) drivers.push('mysql2');
    if (pkgHas(projectDir, 'pg')) drivers.push('pg (PostgreSQL)');
    if (pkgHas(projectDir, 'better-sqlite3')) drivers.push('better-sqlite3');
    if (pkgHas(projectDir, 'mongodb')) drivers.push('mongodb (native)');
    if (pkgHas(projectDir, 'knex')) drivers.push('Knex.js (query builder)');
    if (pkgHas(projectDir, 'ioredis') || pkgHas(projectDir, 'redis')) {
        drivers.push(`Redis (${pkgHas(projectDir, 'ioredis') ? 'ioredis' : 'redis'})`);
    }
    if (drivers.length) { scan.detectedDBDriver = drivers.join(', '); log.detected(`DB driver: ${scan.detectedDBDriver}`); }
    profile.localStorageName = scan.detectedORM || scan.detectedDBDriver || profile.localStorageName;
}

function scanAuth(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Authentication');
    const parts: string[] = [];
    if (pkgHas(projectDir, 'passport') || pkgHas(projectDir, '@nestjs/passport')) parts.push('Passport');
    if (pkgHas(projectDir, 'passport-jwt')) parts.push('JWT');
    if (pkgHas(projectDir, 'auth0') || pkgHas(projectDir, '@auth0/auth0-react')) parts.push('Auth0');
    if (pkgHas(projectDir, 'firebase-admin')) parts.push('Firebase Auth');
    if (!parts.length && pkgHas(projectDir, 'jsonwebtoken')) parts.push('jsonwebtoken');
    if (parts.length) { scan.detectedAuth = parts.join(' + '); log.detected(`Auth: ${scan.detectedAuth}`); }

    const sec: string[] = [];
    if (pkgHas(projectDir, 'bcryptjs') || pkgHas(projectDir, 'bcrypt')) sec.push('bcrypt');
    if (pkgHas(projectDir, 'helmet')) sec.push('helmet');
    if (pkgHas(projectDir, 'cors')) sec.push('cors');
    if (pkgHas(projectDir, 'express-rate-limit')) sec.push('rate-limit');
    if (sec.length) { scan.detectedSecurityMiddleware = sec.join(', '); log.detected(`Security: ${scan.detectedSecurityMiddleware}`); }
}

// v14.2: Dedicated API docs scanner with style detection
function scanAPIDocs(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('API docs');
    if (pkgHas(projectDir, '@nestjs/swagger')) {
        scan.detectedSwagger = true; scan.detectedSwaggerStyle = 'decorators';
        log.detected('API docs: @nestjs/swagger (decorator-based: @ApiProperty, @ApiTags)');
    } else if (pkgHas(projectDir, 'tsoa')) {
        scan.detectedSwagger = true; scan.detectedSwaggerStyle = 'tsoa';
        log.detected('API docs: TSOA (controller decorators → auto-generated swagger)');
    } else if (pkgHas(projectDir, 'swagger-jsdoc')) {
        scan.detectedSwagger = true; scan.detectedSwaggerStyle = 'jsdoc';
        log.detected('API docs: swagger-jsdoc (JSDoc comments in source code)');
    } else if (pkgHas(projectDir, '@fastify/swagger')) {
        scan.detectedSwagger = true; scan.detectedSwaggerStyle = 'fastify-schema';
        log.detected('API docs: @fastify/swagger (JSON Schema route definitions)');
    } else if (pkgHas(projectDir, 'swagger-ui-express')) {
        scan.detectedSwagger = true; scan.detectedSwaggerStyle = 'manual';
        log.detected('API docs: swagger-ui-express (manual/static OpenAPI spec)');
    }
}

// v14.2: Architecture detection with recursive scanning at any depth
function scanArchitecture(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Architecture pattern');
    const srcDir = join(projectDir, 'src');

    if (scan.detectedSubtype === 'nestjs') {
        const hasUC = existsSync(srcDir) && (
            existsSync(join(srcDir, 'usecases')) || existsSync(join(srcDir, 'use-cases')) || existsSync(join(srcDir, 'domain'))
        );
        if (hasUC) {
            profile.layerFlow = 'Controller → Service → UseCase → Repository → DataSource';
            profile.layerNames = ['Controller', 'Service', 'UseCase', 'Repository', 'DataSource'];
            profile.layerLogic = 'UseCase'; profile.layerAdapter = 'Repository';
            scan.detectedArchPattern = 'nestjs-clean';
        } else {
            profile.layerFlow = 'Controller → Service → Repository → DataSource';
            profile.layerNames = ['Controller', 'Service', 'Repository', 'DataSource'];
            profile.layerUI = 'Controller'; profile.layerState = 'Service'; profile.layerLogic = 'Service';
            profile.layerAdapter = 'Repository'; profile.layerData = 'DataSource';
            scan.detectedArchPattern = 'nestjs-standard';
        }
        log.detected(`Architecture: ${scan.detectedArchPattern}`);
        return;
    }

    if (!existsSync(srcDir)) return;

    // v14.2: Recursive scan at any depth (up to 6 levels) instead of top-level only
    const findDirRecursive = (name: string | RegExp): boolean => {
        return findFilesRecursive(srcDir, 6, () => false).length >= 0 && // just need dir check
            existsSync(srcDir) && findDirsRecursive(srcDir, name, 6);
    };

    let hasCtrls = false, hasSvcs = false, hasRepos = false, hasRoutes = false, hasModels = false;

    // Check directories at any depth
    if (existsSync(srcDir)) {
        hasCtrls = hasDirNamed(srcDir, /^controllers?$/i, 6);
        hasSvcs = hasDirNamed(srcDir, /^services?$/i, 6);
        hasRepos = hasDirNamed(srcDir, /^(repo|repositories|repository)$/i, 6);
        hasRoutes = hasDirNamed(srcDir, /^routes?$/i, 6);
        hasModels = hasDirNamed(srcDir, /^models?$/i, 6);
    }

    // v14.2: Count files by name pattern at any depth (catches files even without matching dirs)
    const ext = profile.fileExt.replace('.', '\\.');
    const ctrlCount = countFiles(srcDir, new RegExp(`[Cc]ontroller.*${ext}$`), 6);
    const routeCount = countFiles(srcDir, new RegExp(`[Rr]oute.*${ext}$`), 6);
    const svcCount = countFiles(srcDir, new RegExp(`[Ss]ervice.*${ext}$`), 6);
    const repoCount = countFiles(srcDir, new RegExp(`[Rr]epositor.*${ext}$`), 6);

    // v14.2: Fallback — if no directory matches but file patterns exist, infer architecture
    if (!hasCtrls && ctrlCount > 2) { hasCtrls = true; log.detected(`Controllers: detected by file pattern (${ctrlCount} files)`); }
    if (!hasSvcs && svcCount > 2) { hasSvcs = true; log.detected(`Services: detected by file pattern (${svcCount} files)`); }
    if (!hasRepos && repoCount > 2) { hasRepos = true; log.detected(`Repositories: detected by file pattern (${repoCount} files)`); }

    if (hasCtrls && hasSvcs && hasRepos) {
        if (hasRoutes && hasModels && routeCount > ctrlCount * 3) {
            setRoutesModels(profile, scan);
            log.detected(`Architecture: Routes → Models (dominant: ${routeCount} vs ${ctrlCount})`);
        } else {
            setLayered(profile, scan);
            log.detected('Architecture: Layered (Controller → Service → Repository)');
        }
    } else if (hasCtrls && hasSvcs) {
        profile.layerFlow = 'Controller → Service → DataSource';
        profile.layerNames = ['Controller', 'Service', 'DataSource'];
        profile.layerUI = 'Controller'; profile.layerState = 'Service'; profile.layerLogic = 'Service';
        profile.layerAdapter = 'Service'; profile.layerData = 'DataSource';
        scan.detectedArchPattern = 'controller-service'; profile.namingUISuffix = 'Controller';
        log.detected('Architecture: Controller → Service');
    } else if (hasRoutes && hasModels) {
        setRoutesModels(profile, scan);
        log.detected('Architecture: Routes → Models');
    } else if (hasRoutes) {
        profile.layerFlow = 'Route → Handler'; profile.layerNames = ['Route', 'Handler'];
        scan.detectedArchPattern = 'routes-only';
        log.detected('Architecture: Routes only');
    }

    // Mixed arch detection
    if (scan.detectedArchPattern === 'routes-models' && hasCtrls) {
        scan.mixedArch = true;
        scan.mixedArchNote = `⚠️ Mixed architecture detected: Route→Model is dominant (${routeCount} routes vs ${ctrlCount} controllers) but controller/service/repo dirs also exist.`;
    } else if (scan.detectedArchPattern === 'layered' && hasRoutes && routeCount > 5) {
        scan.mixedArch = true;
        scan.mixedArchNote = `⚠️ Mixed architecture detected: Layered pattern is dominant but ${routeCount} legacy route files also exist.`;
    }
}

/** Check if a directory with matching name exists at any depth under root */
function hasDirNamed(root: string, pattern: RegExp, maxDepth: number, depth = 0): boolean {
    if (depth > maxDepth || !existsSync(root)) return false;
    try {
        const { readdirSync } = require('fs');
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
            if (entry.isDirectory()) {
                if (pattern.test(entry.name)) return true;
                if (depth < maxDepth && hasDirNamed(join(root, entry.name), pattern, maxDepth, depth + 1)) return true;
            }
        }
    } catch { /* permission errors */ }
    return false;
}

/** Compatibility shim — not used but kept for findDirRecursive reference */
function findDirsRecursive(root: string, _name: string | RegExp, _maxDepth: number): boolean {
    return false; // hasDirNamed is used instead
}

function setLayered(profile: BaseProfile, scan: ScanResult): void {
    profile.layerFlow = 'Controller → Service → Repository → DataSource';
    profile.layerNames = ['Controller', 'Service', 'Repository', 'DataSource'];
    profile.layerUI = 'Controller'; profile.layerState = 'Service'; profile.layerLogic = 'Service';
    profile.layerAdapter = 'Repository'; profile.layerData = 'DataSource';
    scan.detectedArchPattern = 'layered'; profile.namingUISuffix = 'Controller';
}

function setRoutesModels(profile: BaseProfile, scan: ScanResult): void {
    profile.layerFlow = 'Route → Model'; profile.layerNames = ['Route', 'Model'];
    profile.layerUI = 'Route'; profile.layerState = 'Model'; profile.layerLogic = 'Model';
    profile.layerAdapter = 'Model'; profile.layerData = 'Model';
    scan.detectedArchPattern = 'routes-models'; profile.namingUISuffix = 'Route';
}

function scanRealtime(projectDir: string, scan: ScanResult): void {
    log.scanning('Real-time & messaging');
    const parts: string[] = [];
    if (pkgHas(projectDir, 'socket.io')) parts.push('Socket.IO');
    if (pkgHas(projectDir, 'ws')) parts.push('ws (WebSocket)');
    if (pkgHas(projectDir, '@nestjs/websockets')) parts.push('NestJS WebSockets');
    if (parts.length) { scan.detectedRealtime = parts.join(', '); log.detected(`Real-time: ${scan.detectedRealtime}`); }

    if (pkgHas(projectDir, 'bullmq')) { scan.detectedQueue = 'BullMQ'; }
    else if (pkgHas(projectDir, 'bull')) { scan.detectedQueue = 'Bull'; }
    else if (pkgHas(projectDir, 'amqplib')) { scan.detectedQueue = 'RabbitMQ'; }
    else if (pkgHas(projectDir, 'kafkajs')) { scan.detectedQueue = 'Kafka'; }
    else if (pkgHas(projectDir, 'sqs-consumer') || pkgHas(projectDir, '@aws-sdk/client-sqs')) { scan.detectedQueue = 'AWS SQS'; }
    if (scan.detectedQueue) log.detected(`Queue: ${scan.detectedQueue}`);
}

function scanSchedulers(projectDir: string, scan: ScanResult): void {
    log.scanning('Schedulers');
    const parts: string[] = [];
    if (pkgHas(projectDir, 'node-cron')) parts.push('node-cron');
    if (pkgHas(projectDir, 'node-schedule')) parts.push('node-schedule');
    if (pkgHas(projectDir, '@nestjs/schedule')) parts.push('@nestjs/schedule');
    if (pkgHas(projectDir, 'agenda')) parts.push('Agenda');
    if (parts.length) { scan.detectedScheduler = parts.join(', '); log.detected(`Scheduler: ${scan.detectedScheduler}`); }
}

function scanUploadMedia(projectDir: string, scan: ScanResult): void {
    log.scanning('Upload & media');
    const up: string[] = [];
    if (pkgHas(projectDir, 'multer')) up.push('multer');
    if (pkgHas(projectDir, 'busboy')) up.push('busboy');
    if (pkgHas(projectDir, 'formidable')) up.push('formidable');
    if (up.length) { scan.detectedUpload = up.join(', '); log.detected(`Upload: ${scan.detectedUpload}`); }

    const media: string[] = [];
    if (pkgHas(projectDir, 'sharp')) media.push('sharp');
    if (pkgHas(projectDir, 'fluent-ffmpeg')) media.push('fluent-ffmpeg');
    if (pkgHas(projectDir, 'cloudinary')) media.push('Cloudinary');
    if (media.length) { scan.detectedMedia = media.join(', '); log.detected(`Media: ${media.join(', ')}`); }
}

function scanEmail(projectDir: string, scan: ScanResult): void {
    log.scanning('Email');
    const parts: string[] = [];
    if (pkgHas(projectDir, 'nodemailer')) parts.push('nodemailer');
    if (pkgHas(projectDir, '@sendgrid/mail')) parts.push('SendGrid');
    if (pkgHas(projectDir, '@nestjs-modules/mailer')) parts.push('@nestjs/mailer');
    if (parts.length) { scan.detectedEmail = parts.join(', '); log.detected(`Email: ${scan.detectedEmail}`); }
}

function scanCloud(projectDir: string, scan: ScanResult): void {
    log.scanning('Cloud & infrastructure');
    const services: string[] = [];
    if (pkgHas(projectDir, 'aws-sdk') || pkgHas(projectDir, '@aws-sdk/client-s3') || pkgHas(projectDir, '@aws-sdk/client-dynamodb')) {
        scan.detectedCloudProvider = 'AWS';
        if (pkgHas(projectDir, '@aws-sdk/client-s3')) services.push('S3 (v3)');
        if (pkgHas(projectDir, '@aws-sdk/client-dynamodb')) services.push('DynamoDB (v3)');
        log.detected('Cloud: AWS');
    }
    if (pkgHas(projectDir, 'firebase-admin')) {
        scan.detectedCloudProvider = (scan.detectedCloudProvider ? scan.detectedCloudProvider + ' + ' : '') + 'Firebase';
        services.push('Firebase Admin');
    }
    if (services.length) scan.detectedCloudServices = services.join(', ');

    const infra: string[] = [];
    for (const df of ['Dockerfile', 'src/Dockerfile', 'docker/Dockerfile']) {
        if (fileExists(projectDir, df)) { infra.push('Docker'); break; }
    }
    if (fileExists(projectDir, 'docker-compose.yml') || fileExists(projectDir, 'docker-compose.yaml')) infra.push('docker-compose');
    if (fileExists(projectDir, 'serverless.yml') || fileExists(projectDir, 'serverless.ts')) infra.push('Serverless Framework');
    if (fileExists(projectDir, 'cdk.json')) infra.push('AWS CDK');
    if (infra.length) { scan.detectedInfra = infra.join(', '); log.detected(`Infra: ${scan.detectedInfra}`); }
}

function scanLogging(projectDir: string, scan: ScanResult): void {
    log.scanning('Logging');
    const parts: string[] = [];
    if (pkgHas(projectDir, 'winston')) parts.push('winston');
    if (pkgHas(projectDir, 'pino')) parts.push('pino');
    if (pkgHas(projectDir, 'morgan')) parts.push('morgan');
    if (parts.length) { scan.detectedLogger = parts.join(', '); log.detected(`Logger: ${scan.detectedLogger}`); }
}

function scanToolingDX(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Tooling & DX');
    if (scan.detectedLinter === 'eslint') {
        const configs = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.ts'];
        scan.detectedHasLinterConfig = configs.some(c => fileExists(projectDir, c));
        if (!scan.detectedHasLinterConfig) {
            const pkg = readFileSafe(findPackageJson(projectDir) || '');
            scan.detectedHasLinterConfig = pkg.includes('"eslintConfig"');
        }
        if (scan.detectedHasLinterConfig) {
            profile.analyzeCmd = 'npx eslint src/'; profile.analyzeCmdFile = 'npx eslint';
        } else {
            profile.analyzeCmd = ''; profile.analyzeCmdFile = '';
            log.detected('WARNING: eslint in deps but no config file found');
        }
    }

    if (scan.detectedFormatter === 'prettier') {
        const configs = ['.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml', 'prettier.config.js', 'prettier.config.mjs'];
        scan.detectedHasFormatterConfig = configs.some(c => fileExists(projectDir, c));
        if (scan.detectedHasFormatterConfig) {
            profile.formatCmd = 'npx prettier --write';
            profile.formatCmdFull = `npx prettier --write 'src/**/*${profile.fileExt}'`;
        }
    } else if (scan.detectedFormatter === 'biome') {
        profile.formatCmd = 'npx biome format --write';
        profile.formatCmdFull = 'npx biome format --write src/';
    }

    if (pkgHas(projectDir, 'dotenv')) scan.detectedDotenv = true;

    if (fileExists(projectDir, 'lerna.json')) { scan.detectedMonorepo = 'Lerna'; }
    else if (fileExists(projectDir, 'nx.json')) { scan.detectedMonorepo = 'Nx'; }
    else if (fileExists(projectDir, 'turbo.json')) { scan.detectedMonorepo = 'Turborepo'; }
    else if (fileExists(projectDir, 'pnpm-workspace.yaml')) { scan.detectedMonorepo = 'pnpm workspaces'; }
    if (scan.detectedMonorepo) log.detected(`Monorepo: ${scan.detectedMonorepo}`);
}

function scanTesting(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Testing');
    const pkgFile = findPackageJson(projectDir);
    if (pkgFile) {
        const content = readFileSafe(pkgFile);
        const testScript = content.match(/"test"\s*:\s*"([^"]+)"/)?.[1] || '';
        if (testScript.includes('no test specified') || testScript.includes('exit 1')) {
            scan.detectedHasTests = false;
            log.detected('WARNING: No test framework configured');
        }
    }
}

function scanNaming(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Naming conventions');
    const srcDir = join(projectDir, 'src');
    if (!existsSync(srcDir)) return;
    const ext = profile.fileExt.replace('.', '\\.');
    const kebab = countFiles(srcDir, new RegExp(`.*-.*${ext}$`), 3);
    const camel = countFiles(srcDir, new RegExp(`[a-z].*[A-Z].*${ext}$`), 3);
    if (kebab > camel) { profile.namingFiles = 'kebab-case'; log.detected('File naming: kebab-case'); }
    else if (camel > 0) { profile.namingFiles = 'camelCase'; log.detected('File naming: camelCase'); }
}

function scanTemplateEngines(projectDir: string, scan: ScanResult): void {
    log.scanning('Template engines');
    const parts: string[] = [];
    if (pkgHas(projectDir, 'hbs') || pkgHas(projectDir, 'handlebars')) parts.push('Handlebars');
    if (pkgHas(projectDir, 'ejs')) parts.push('EJS');
    if (pkgHas(projectDir, 'pug')) parts.push('Pug');
    if (parts.length) { scan.detectedTemplateEngine = parts.join(', '); log.detected(`Templates: ${scan.detectedTemplateEngine}`); }
}

function scanValidation(projectDir: string, scan: ScanResult): void {
    log.scanning('Validation');
    const parts: string[] = [];
    if (pkgHas(projectDir, 'class-validator')) parts.push('class-validator');
    if (pkgHas(projectDir, 'joi')) parts.push('Joi');
    if (pkgHas(projectDir, 'zod')) parts.push('Zod');
    if (pkgHas(projectDir, 'yup')) parts.push('Yup');
    if (pkgHas(projectDir, 'express-validator')) parts.push('express-validator');
    if (parts.length) { scan.detectedValidator = true; scan.detectedValidationLib = parts.join(', '); log.detected(`Validation: ${scan.detectedValidationLib}`); }
}

function scanAPIType(projectDir: string, scan: ScanResult): void {
    if (pkgHas(projectDir, '@nestjs/graphql') || pkgHas(projectDir, 'graphql') || pkgHas(projectDir, 'apollo-server-express')) {
        scan.detectedAPIType = 'GraphQL'; log.detected('API: GraphQL');
    } else if (pkgHas(projectDir, '@grpc/grpc-js')) {
        scan.detectedAPIType = 'gRPC'; log.detected('API: gRPC');
    }
    if (pkgHas(projectDir, '@nestjs/microservices')) { scan.detectedMicroservices = true; log.detected('Microservices'); }
}

function scanSourceDir(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    for (const c of ['src/modules', 'src/features', 'src/api', 'src']) {
        if (existsSync(join(projectDir, c))) { profile.sourceDir = `${c}/`; log.detected(`Source dir: ${profile.sourceDir}`); break; }
    }
    profile.rmBlockDirs = 'src/';
    if (dirExists(projectDir, 'dist')) profile.rmBlockDirs += ' dist/';
    if (dirExists(projectDir, 'build')) profile.rmBlockDirs += ' build/';
}

// v14.2: High-risk files with relative paths + entry point from package.json main
function scanHighRiskNodejs(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    // Entry point from package.json "main" field
    const pkgFile = findPackageJson(projectDir);
    if (pkgFile) {
        const content = readFileSafe(pkgFile);
        const mainField = content.match(/"main"\s*:\s*"([^"]+)"/)?.[1];
        if (mainField && fileExists(projectDir, mainField) && !scan.highRiskFiles.includes(mainField)) {
            scan.highRiskFiles.push(mainField);
            log.detected(`Entry point: ${mainField} (from package.json main)`);
        }
    }

    // Standard entry points — store relative paths
    const entries = ['src/app.js', 'src/app.ts', 'src/server.js', 'src/server.ts', 'src/index.js', 'src/index.ts', 'src/main.ts', 'src/main.js'];
    for (const f of entries) {
        if (fileExists(projectDir, f) && f.endsWith(profile.fileExt)) {
            if (!scan.highRiskFiles.includes(f)) scan.highRiskFiles.push(f);
        }
    }

    // NestJS specific
    if (fileExists(projectDir, 'src', 'app.module.ts') && !scan.highRiskFiles.includes('src/app.module.ts')) {
        scan.highRiskFiles.push('src/app.module.ts');
    }

    // DB config files with relative paths
    if (fileExists(projectDir, 'prisma', 'schema.prisma')) scan.highRiskFiles.push('prisma/schema.prisma');
    for (const f of ['src/database.ts', 'src/database.js', 'src/db.ts', 'src/db.js', 'src/config/database.ts', 'src/config/database.js']) {
        if (fileExists(projectDir, f) && !scan.highRiskFiles.includes(f)) scan.highRiskFiles.push(f);
    }

    // v14.2: Router aggregator files
    for (const f of ['src/routes/index.ts', 'src/routes/index.js', 'src/api/index.ts', 'src/api/index.js', 'src/router.ts', 'src/router.js']) {
        if (fileExists(projectDir, f) && !scan.highRiskFiles.includes(f)) scan.highRiskFiles.push(f);
    }

    if (fileExists(projectDir, '.env')) scan.highRiskFiles.push('.env');
}

function scanScaffold(projectDir: string, scan: ScanResult): void {
    if (scan.detectedSubtype === 'nestjs') {
        scan.scaffoldTool = 'NestJS CLI'; scan.scaffoldCmdFeature = 'nest generate resource';
    } else if (fileExists(projectDir, 'plopfile.js') || fileExists(projectDir, 'plopfile.ts')) {
        scan.scaffoldTool = 'Plop'; scan.scaffoldCmdFeature = 'npx plop feature';
    } else if (fileExists(projectDir, '.hygen.js') || dirExists(projectDir, '_templates')) {
        scan.scaffoldTool = 'Hygen'; scan.scaffoldCmdFeature = 'npx hygen feature new';
    }
    if (scan.scaffoldTool) log.detected(`Scaffold: ${scan.scaffoldTool}`);
}

function scanBuildCommands(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    const pkgFile = findPackageJson(projectDir);
    if (pkgFile) {
        const content = readFileSafe(pkgFile);
        if (!content.includes('"build"')) profile.buildCmd = '';
        if (!/("dev"|"start"|"serve"|"start:dev")/.test(content)) {
            for (const f of ['src/app.js', 'src/server.js', 'src/index.js', 'app.js', 'server.js', 'index.js']) {
                if (fileExists(projectDir, f)) { profile.runCmd = `node ${f}`; break; }
            }
        }
    }
}

function scanErrorPattern(profile: BaseProfile, scan: ScanResult): void {
    const patterns: Record<string, string> = {
        nestjs: 'HttpException subclasses + GlobalExceptionFilter',
        express: 'Express error middleware (err, req, res, next)',
        fastify: 'Fastify setErrorHandler + custom error classes',
        koa: 'Koa error middleware (try/catch in middleware chain)',
    };
    profile.errorPattern = patterns[scan.detectedSubtype] || 'try/catch + error handler middleware';
}
