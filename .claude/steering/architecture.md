# Architecture — Node.js

## Layer Flow
```
Route → Model
```

### Route (API / Entry Point)
- Receives HTTP requests; validates input via request schemas
- Delegates to services; returns response schemas; no business logic

### Model (Data / Infrastructure)
- Database engine, connection pool, session factory
- External service clients (HTTP, blob storage, message queues)



---

## Project Structure
```
src/
├── controller/    # HTTP handlers
├── service/       # Business logic
├── models/        # Data models
└── config/        # Configuration
```



---

## State Pattern
N/A (server-side)

---

## General Rules
- Never skip a layer
- Never expose raw DTOs to Route layer
- Dependencies flow inward: Route → Model

