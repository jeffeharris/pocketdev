# Philosophy of Software Design Review Guide for PocketDev

## Purpose
Review PocketDev codebase using John Ousterhout's principles from "A Philosophy of Software Design" to identify complexity and suggest simplifications.

## Review Approach

### What to Look For

1. **Module Depth**
   - Count public interface methods/exports
   - Compare to implementation size
   - Deep modules: simple interface, complex implementation (good)
   - Shallow modules: complex interface, simple implementation (bad)

2. **Information Hiding**
   - Does the module hide implementation details?
   - Are callers forced to understand internals?
   - Look for leaky abstractions

3. **Complexity Indicators**
   - Generic names (data, info, item, temp)
   - Long parameter lists (>3 params)
   - Nested conditionals
   - Pass-through functions
   - Special-case handling

4. **Strategic vs Tactical**
   - TODO/FIXME/HACK comments
   - Inconsistent patterns
   - Copy-pasted code
   - "Quick fix" commits

## Review Process

1. Start with service boundaries (backend, frontend, shelltender)
2. For each service:
   - Read main entry point
   - Identify key modules
   - Assess module depth
   - Document findings with file:line references
3. Look for patterns across the codebase
4. Create simple notes document with findings

## Documentation Format

Create `philosophy-review-findings.md` with sections:
- Shallow Modules (with evidence)
- Deep Modules (good examples)
- Complexity Hotspots
- Information Leaks
- Tactical Debt
- Recommendations

Keep findings concrete with specific code examples and line numbers.