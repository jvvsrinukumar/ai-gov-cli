# Design — [Feature Name]

## Hard Rules Compliance
| # | Rule | Compliant? | Justification if No |
|---|------|:----------:|---------------------|
| 1 | No skipping layers (Route → … → Model) | Yes / No | |
| 2 | No business logic in Routes | Yes / No | |
| 3 | No direct DB queries from Routes | Yes / No | |
| 4 | API responses use schemas, not ORM models | Yes / No | |
| 5 | Tenant-scoped queries include org_id | Yes / No | |
| 6 | No TODO in production code | Yes / No | |
| 7 | Every task has a test | Yes / No | |

## Layer Mapping
| Layer | Responsibility | Applies? |
|-------|---------------|----------|
| **Route** | HTTP request handling | Yes / No |
| **Model** | Database / infrastructure | Yes / No |
| **External Services** | External APIs, Database | Yes / No |

## File List
### New Files
| File | Layer | Purpose |
|------|-------|---------|

| `src/routes/<resource>routes.ts` | Route | HTTP handlers |
| `src/models/<resource>.ts` | Model | Business logic + data |

### Modified Files
| File | Change |
|------|--------|
| _e.g. routes file_ | _add route_ |

## API Flow
```
Request → Middleware (auth/RBAC) → Handler → Model/Service → Response
```

## Integration Points
| System | Purpose | Direction |
|--------|---------|-----------|
| _e.g. MySQL_ | _describe_ | in / out |
