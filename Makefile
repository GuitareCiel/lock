.PHONY: lint format check typecheck fix all clean

# Run all checks (lint + format check + typecheck)
check: lint format typecheck

# Lint all source files
lint:
	pnpm biome lint ./packages

# Check formatting (no writes)
format:
	pnpm biome format ./packages

# Type-check all packages
typecheck:
	pnpm -r typecheck

# Auto-fix lint issues + format all files
fix:
	pnpm biome check --fix ./packages

# Alias: run fix + typecheck
all: fix typecheck

# Clean build artifacts
clean:
	rm -rf packages/*/dist packages/web/.next
