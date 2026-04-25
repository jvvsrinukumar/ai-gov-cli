export function generateGitHooksConfig(): string {
    const config = {
        "pre-commit": {
            "file-size": {
                "enabled": true,
                "max-lines": 300,
                "frontend-only": true,
                "frontend-extensions": [".dart", ".tsx", ".jsx", ".ts", ".kt"],
                "exclude-patterns": []
            },
            "secrets": {
                "enabled": true,
                "skip-dirs": ["test", "tests", "__tests__", "spec", "fixtures", "mocks", "__mocks__", "factories", "seeds"],
                "skip-extensions": [".md", ".txt", ".env.example", ".env.template"]
            },
            "no-todos": {
                "enabled": true,
                "allow-with-ticket": true,
                "ticket-pattern": "[A-Z]+-[0-9]+"
            },
            "no-debug": {
                "enabled": true
            },
            "format-check": {
                "enabled": false
            },
            "lint-check": {
                "enabled": false
            }
        },
        "commit-msg": {
            "conventional-commits": true,
            "allowed-types": ["feat", "fix", "refactor", "hotfix", "docs", "test", "chore", "style", "perf", "ci", "build"],
            "min-description-length": 10,
            "require-ticket-ref": false,
            "ticket-pattern": "[A-Z]+-[0-9]+"
        }
    };
    return JSON.stringify(config, null, 2);
}
