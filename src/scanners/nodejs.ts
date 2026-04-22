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

    // ESM vs CommonJS
    const pkgFile = findPackageJson(projectDir);
    const pkgContent = pkgFile ? readFileSafe(pkgFile) : '';
    const pkgType = pkgContent.match(/"type"\s*:\s*"(module|commonjs)"/)?.[1] || '';
    if (pkgType === 'module') {
        scan.detectedModuleSystem = 'ESM';
        profile.importStyle = 'import/export (ESM) — node builtins → third-party → project local';
        log.detected('Module system: ESM');
    } else {
        const srcDir = join(projectDir, 'src');
        const esmCount = existsSync(srcDir) ? findFilesRecursive(srcDir, 4, f => /\.(js|ts)$/.test(f))
            .filter(f => /^(import |export )/.test(readFileSafe(f))).length : 0;
        const cjsCount = existsSync(srcDir) ? findFilesRecursive(srcDir, 4, f => /\.(js|ts)$/.test(f))
            .filter(f => readFileSafe(f).includes('require(')).length : 0;
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

function scanFramework(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Framework');
    if (pkgHas(projectDir, '@nestjs/core')) { scan.detectedSubtype = 'nestjs'; profile.diFramework = 'NestJS DI'; }
    else if (pkgHas(projectDir, 'fastify')) { scan.detectedSubtype = 'fastify'; }
    else if (pkgHas(projectDir, '@hapi/hapi')) { scan.detectedSubtype = 'hapi'; }
    else if (pkgHas(projectDir, 'koa')) { scan.detectedSubtype = 'koa'; }
    else if (pkgHas(projectDir, '@adonisjs/core')) { scan.detectedSubtype = 'adonis'; profile.diFramework = 'AdonisJS IoC'; }
    else if (pkgHas(projectDir, 'hono')) { scan.detectedSubtype = 'hono'; }
    else if (pkgHas(projectDir, 'express')) { scan.detectedSubtype = 'express'; }
    else { scan.detectedSubtype = 'plain'; }
    log.detected(`Framework: ${scan.detectedSubtype}`);

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

function scanAPIDocs(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('API docs');
    if (pkgHas(projectDir, '@nestjs/swagger') || pkgHas(projectDir, 'swagger-jsdoc') ||
        pkgHas(projectDir, 'swagger-ui-express') || pkgHas(projectDir, '@fastify/swagger')) {
        scan.detectedSwagger = true; log.detected('Swagger/OpenAPI');
    }
}

function scanArchitecture(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    log.scanning('Architecture pattern');
    const srcDir = join(projectDir, 'src');

    // NestJS always uses Controller → Service pattern regardless of directory structure
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

    const hasCtrls = existsSync(join(srcDir, 'controllers')) || existsSync(join(srcDir, 'controller'));
    const hasSvcs = existsSync(join(srcDir, 'services')) || existsSync(join(srcDir, 'service'));
    const hasRepos = existsSync(join(srcDir, 'repositories')) || existsSync(join(srcDir, 'repository')) || existsSync(join(srcDir, 'repo'));
    const hasRoutes = existsSync(join(srcDir, 'routes'));
    const hasModels = existsSync(join(srcDir, 'models'));

    const ctrlCount = countFiles(srcDir, new RegExp(`controller.*\\${profile.fileExt}$`), 3);
    const routeCount = countFiles(srcDir, new RegExp(`route.*\\${profile.fileExt}$`), 3);

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
        scan.mixedArchNote = `⚠️ Mixed architecture detected: Route→Model is dominant but controller/service/repo dirs also exist.`;
    } else if (scan.detectedArchPattern === 'layered' && hasRoutes && routeCount > 5) {
        scan.mixedArch = true;
        scan.mixedArchNote = `⚠️ Mixed architecture detected: Layered pattern is dominant but ${routeCount} legacy route files also exist.`;
    }
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
    if (media.length) { scan.detectedMedia = media.join(', '); log.detected(`Media: ${scan.detectedMedia}`); }
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
        log.detected(`Cloud: AWS`);
    }
    if (pkgHas(projectDir, 'firebase-admin')) {
        scan.detectedCloudProvider = (scan.detectedCloudProvider ? scan.detectedCloudProvider + ' + ' : '') + 'Firebase';
        services.push('Firebase Admin');
    }
    if (services.length) scan.detectedCloudServices = services.join(', ');

    // Infrastructure
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

    // Monorepo
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
    const kebab = countFiles(srcDir, new RegExp(`.*-.*\\${profile.fileExt}$`), 3);
    const camel = countFiles(srcDir, new RegExp(`[a-z].*[A-Z].*\\${profile.fileExt}$`), 3);
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

function scanHighRiskNodejs(projectDir: string, profile: BaseProfile, scan: ScanResult): void {
    const entries = ['src/app.js', 'src/app.ts', 'src/server.js', 'src/server.ts', 'src/index.js', 'src/index.ts', 'src/main.ts', 'src/main.js'];
    for (const f of entries) {
        if (fileExists(projectDir, f) && f.endsWith(profile.fileExt)) {
            const bn = f.split('/').pop()!;
            if (!scan.highRiskFiles.includes(bn)) scan.highRiskFiles.push(bn);
        }
    }
    if (fileExists(projectDir, 'src', 'app.module.ts')) scan.highRiskFiles.push('app.module.ts');
    if (fileExists(projectDir, 'prisma', 'schema.prisma')) scan.highRiskFiles.push('schema.prisma');
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
