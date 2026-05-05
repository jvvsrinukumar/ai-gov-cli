import type { WorkspaceProject } from '../types.js';

export function backendProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
    return projects.filter(p =>
        p.group === 'backend' ||
        p.stack === 'nodejs' || p.stack === 'python' || p.stack === 'java'
    );
}

export function frontendProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
    return projects.filter(p =>
        p.group === 'frontend' ||
        p.stack === 'react' || p.stack === 'angular' ||
        p.stack === 'flutter' || p.stack === 'kotlin' || p.stack === 'swiftui'
    );
}
