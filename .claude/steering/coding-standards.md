# Coding Standards — Node.js

## Naming
- **Classes:** PascalCase
- **Methods/Variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE
- **Files:** camelCase

## Type Naming
| Type | Pattern | Example |
|------|---------|---------|
| Route | `<resource>routes.ts` | `userroutes.ts` |
| Model | `<resource>.ts` | `user.ts` |

## State Pattern
N/A (server-side)

## Error Handling
try/catch + error handler middleware


## Comments
- No inline "what" comments — code is self-documenting
- Only "why" comments for non-obvious reasons
- No TODO in production — create a Jira ticket

## Testing

- Every service must have unit tests
- API endpoints must have integration tests (supertest)
- Auth + RBAC flows must have dedicated tests

## Imports
import/export (ESM) — node builtins → third-party → project local
