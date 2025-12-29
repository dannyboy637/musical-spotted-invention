# Coding Standards

## General Principles

1. **Clarity over cleverness** - Write readable code
2. **DRY but not prematurely** - Repeat twice, abstract third time
3. **Fail fast** - Validate early, return early
4. **Document why, not what** - Code shows what, comments explain why

## Naming

```
# Files: kebab-case
user-profile.tsx
menu-engineering.py

# Components: PascalCase
UserProfile.tsx
MenuEngineering.tsx

# Functions/Variables: camelCase (TS) or snake_case (Python)
getUserProfile()
get_user_profile()

# Constants: SCREAMING_SNAKE_CASE
MAX_RETRIES = 3
API_BASE_URL = "..."
```

## Code Organization

```
# Group imports
1. External packages
2. Internal absolute imports
3. Relative imports

# Group code
1. Types/interfaces
2. Constants
3. Helper functions
4. Main export
```

## Error Handling

```typescript
// Always handle errors explicitly
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error });
  throw new AppError('USER_FRIENDLY_MESSAGE', error);
}
```

```python
# Use specific exceptions
try:
    risky_operation()
except ValidationError as e:
    raise HTTPException(status_code=422, detail=str(e))
except Exception as e:
    logger.exception("Unexpected error")
    raise HTTPException(status_code=500, detail="Internal error")
```

## Comments

```
# Good: Explains WHY
# We use a 6-month threshold because seasonal items
# would otherwise skew the menu engineering results

# Bad: Explains WHAT (obvious from code)
# Filter items with more than 6 months active
```
