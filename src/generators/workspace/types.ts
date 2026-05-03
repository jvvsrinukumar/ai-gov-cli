export interface WorkspaceProject {
    name: string;
    relativePath: string;   // e.g. "backend/corporate_node"
    stack: string;
    group: string;          // e.g. "backend", "frontend", "" for flat
}

export interface WorkspaceConfig {
    workspaceName: string;
    workspaceDir: string;
    projects: WorkspaceProject[];
    dryRun: boolean;
    overwrite: boolean;
    hookVersion: string;
    agent?: 'claude-code' | 'kiro';
}
