import { join } from 'path';
import type { BaseProfile, ScanResult } from '../types.js';
import { fileExists, dirExists, readFileSafe } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';

export function scanPython(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Python details');
    const pyFiles = [
        fileExists(projectDir, 'pyproject.toml') ? join(projectDir, 'pyproject.toml') : null,
        fileExists(projectDir, 'requirements.txt') ? join(projectDir, 'requirements.txt') : null,
    ].filter(Boolean) as string[];
    const pyContent = pyFiles.map(f => readFileSafe(f).toLowerCase()).join('\n');
    const has = (pkg: string) => pyContent.includes(pkg.toLowerCase());

    // Framework
    if (has('fastapi')) {
        scan.detectedSubtype = 'fastapi'; profile.stackDisplay = 'Python (FastAPI)';
        profile.diFramework = 'FastAPI Depends()';
        profile.layerFlow = 'Router → Service → Model → DB';
        profile.layerNames = ['Router', 'Service', 'Model', 'DB'];
        log.detected('Framework: FastAPI');
    } else if (has('django')) {
        scan.detectedSubtype = 'django'; profile.stackDisplay = 'Python (Django)';
        profile.diFramework = 'N/A';
        profile.layerFlow = 'View → Service → Model → DB';
        profile.layerNames = ['View', 'Service', 'Model', 'DB'];
        profile.layerUI = 'View';
        profile.runCmd = 'python manage.py runserver'; profile.testCmd = 'python manage.py test';
        log.detected('Framework: Django');
    } else if (has('flask')) {
        scan.detectedSubtype = 'flask'; profile.stackDisplay = 'Python (Flask)';
        profile.diFramework = 'N/A';
        profile.layerFlow = 'Blueprint → Service → Model → DB';
        profile.layerNames = ['Blueprint', 'Service', 'Model', 'DB'];
        profile.layerUI = 'Blueprint';
        log.detected('Framework: Flask');
    }

    // ORM
    if (has('sqlmodel')) { scan.detectedORM = 'SQLModel'; log.detected('ORM: SQLModel'); }
    else if (has('sqlalchemy')) { scan.detectedORM = 'SQLAlchemy'; log.detected('ORM: SQLAlchemy'); }
    else if (has('tortoise-orm')) { scan.detectedORM = 'Tortoise ORM'; log.detected('ORM: Tortoise'); }
    else if (has('peewee')) { scan.detectedORM = 'Peewee'; log.detected('ORM: Peewee'); }

    // Migrations
    if (dirExists(projectDir, 'alembic') || fileExists(projectDir, 'alembic.ini')) log.detected('Migrations: Alembic');

    // Auth
    if (has('python-jose') || has('pyjwt') || has('authlib')) { scan.detectedAuth = 'JWT'; log.detected('Auth: JWT'); }
    else if (has('passlib')) { scan.detectedAuth = 'passlib'; log.detected('Auth: passlib'); }

    // Cache / queue
    if (has('redis')) { scan.detectedLocalDB = 'Redis'; log.detected('Cache: Redis'); }
    if (has('celery')) { scan.detectedQueue = 'Celery'; log.detected('Queue: Celery'); }

    // Linter / formatter
    if (has('ruff')) {
        scan.detectedLinter = 'ruff'; scan.detectedFormatter = 'ruff';
        profile.formatCmd = 'ruff format'; profile.formatCmdFull = 'ruff format app/ tests/';
        profile.analyzeCmd = 'ruff check app/'; profile.analyzeCmdFile = 'ruff check';
        log.detected('Linter/Formatter: ruff');
    } else if (has('black')) {
        scan.detectedFormatter = 'black'; profile.formatCmd = 'black'; profile.formatCmdFull = 'black app/ tests/';
        log.detected('Formatter: black');
    }

    // Test
    if (has('pytest')) { scan.detectedTestFramework = 'pytest'; profile.testCmd = 'pytest'; log.detected('Test: pytest'); }

    // Validation
    if (has('pydantic')) { scan.detectedValidator = true; log.detected('Validation: Pydantic'); }

    // Logging
    if (has('structlog')) { scan.detectedLogger = 'structlog'; log.detected('Logging: structlog'); }
    else if (has('loguru')) { scan.detectedLogger = 'loguru'; log.detected('Logging: loguru'); }

    // HTTP client
    if (has('httpx')) { scan.detectedHTTPClient = 'httpx'; log.detected('HTTP client: httpx'); }
    else if (has('aiohttp')) { scan.detectedHTTPClient = 'aiohttp'; log.detected('HTTP client: aiohttp'); }

    // Source dir
    for (const c of ['app', 'src', 'api']) {
        if (dirExists(projectDir, c)) { profile.sourceDir = `${c}/`; log.detected(`Source dir: ${profile.sourceDir}`); break; }
    }

    // Features dir (v14.1 — deeper scan)
    for (const c of ['app/api/v2/endpoints', 'app/api/v1/endpoints', 'app/api/v2', 'app/api/v1', 'app/api', 'app/routers', 'app/routes', 'src/api/v1', 'src/api']) {
        if (dirExists(projectDir, c)) { profile.featuresDir = `${c}/`; log.detected(`API dir: ${profile.featuresDir}`); break; }
    }
    profile.featuresDir = profile.featuresDir || profile.sourceDir;

    // Architecture depth
    const hasSvcs = dirExists(projectDir, 'app', 'services') || dirExists(projectDir, 'src', 'services');
    if (hasSvcs && scan.detectedSubtype === 'fastapi') {
        profile.layerFlow = 'Router → Depends → Service → Model → DB';
        profile.layerNames = ['Router', 'Depends', 'Service', 'Model', 'DB'];
        profile.layerUI = 'Router'; profile.layerState = 'Depends'; profile.layerLogic = 'Service';
        profile.layerAdapter = 'Model'; profile.layerData = 'DB';
        log.detected('Architecture: Router → Depends → Service → Model → DB');
    }

    // High-risk
    const hrFiles = [
        'app/main.py', 'app/config.py', 'alembic/env.py', 'alembic.ini',
        'app/core/security.py', 'app/core/middleware.py', 'app/api/deps.py',
        'app/db/engine.py', 'docker/docker-compose.yml',
    ];
    for (const f of hrFiles) {
        if (fileExists(projectDir, f)) {
            const bn = f.split('/').pop()!;
            if (!scan.highRiskFiles.includes(bn)) scan.highRiskFiles.push(bn);
        }
    }

    // Package manager
    if (fileExists(projectDir, 'poetry.lock')) {
        scan.detectedPackageManager = 'poetry';
        profile.installCmd = 'poetry install'; profile.runCmd = 'poetry run uvicorn app.main:app --reload';
        profile.testCmd = 'poetry run pytest'; log.detected('Package manager: Poetry');
    } else if (fileExists(projectDir, 'uv.lock')) {
        scan.detectedPackageManager = 'uv';
        profile.installCmd = 'uv sync'; profile.runCmd = 'uv run uvicorn app.main:app --reload';
        profile.testCmd = 'uv run pytest'; log.detected('Package manager: uv');
    } else if (fileExists(projectDir, 'Pipfile')) {
        scan.detectedPackageManager = 'pipenv';
        profile.installCmd = 'pipenv install --dev'; profile.runCmd = 'pipenv run uvicorn app.main:app --reload';
        profile.testCmd = 'pipenv run pytest'; log.detected('Package manager: Pipenv');
    } else {
        scan.detectedPackageManager = 'pip'; log.detected('Package manager: pip');
    }
}
