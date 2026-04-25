# Workflow

## New Feature
```
Ticket → spec (_template) → requirements.md → design.md → tasks.md
→ approval → implement → tests → PR
```

## Edit Feature (update/extend existing)
```
Ticket → read existing spec → update requirements.md → update design.md
→ update tasks.md → show changes → approval → implement new tasks only → tests → PR
```

## Bug Fix
```
Ticket → reproduce → root cause → minimal fix → verify → PR
```

## Refactor
```
Ticket → impact analysis → approval (if >10 files) → refactor → tests → PR
```

## Hotfix
```
Fix → verify → PR → ticket after
```

## Layer Build Order
```
1. Model layer
2. Route layer
3. Tests — unit + integration
```

## Commands
| Step | Command |
|------|---------|
| Install | `npm install` |
| Run     | `npm run dev` |
| Build   | `npm run build` |
| Analyze | `npx eslint src/` |
| Test    | `npm test` |
