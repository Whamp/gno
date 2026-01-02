# Specifications

Interface contracts and schemas for GNO.

## Structure

```
spec/
├── cli.md              # CLI commands, flags, exit codes
├── mcp.md              # MCP tools, resources, schemas
├── evals.md            # Evaluation framework spec
├── db/
│   └── schema.sql      # Database schema
└── output-schemas/     # JSON schemas for all outputs
    ├── search-results.schema.json
    ├── ask.schema.json
    ├── status.schema.json
    └── ...
```

## Spec-First Workflow

When adding/modifying commands or outputs:

1. **Update spec first** - Define the interface before implementation
2. **Add/update JSON schema** - If output shape changes
3. **Add contract tests** - In `test/spec/schemas/`
4. **Implement** - Code to match spec
5. **Verify** - `bun test` passes

## JSON Schemas

Schemas define the structure of all JSON outputs:

- Validated by contract tests
- Used for documentation
- Enable type generation

### Schema Naming

- `<command>.schema.json` - Single command output
- `<noun>-<verb>.schema.json` - Compound names

### Adding a New Schema

1. Create `spec/output-schemas/<name>.schema.json`
2. Add contract test in `test/spec/schemas/`
3. Reference in spec document

## Contract Tests

Tests in `test/spec/schemas/` validate outputs against schemas:

```typescript
import schema from "../../spec/output-schemas/search-results.schema.json";

test("search --json matches schema", async () => {
  const result = await runSearch("query", { json: true });
  expect(() => validate(schema, result)).not.toThrow();
});
```

## Spec Documents

### cli.md

- Exit codes and meanings
- Global flags
- Output format support matrix
- All commands with options

### mcp.md

- Server capabilities
- Tool schemas and responses
- Resource URI schemes
- Error codes

### evals.md

- Evaluation metrics
- Test case format
- Scoring methodology
