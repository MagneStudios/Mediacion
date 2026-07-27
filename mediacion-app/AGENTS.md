# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Dependency installation

This project is part of a pnpm workspace. Dependencies must be installed from the **repository root**, not from `mediacion-app/`.

```bash
# Repository root: C:\Users\Usuario\Documents\GitHub\Mediacion
pnpm install
```

The root `pnpm-lock.yaml` is the single lockfile for the entire workspace. There is no separate lockfile inside `mediacion-app/`.

### When to run `pnpm install`

- After pulling, switching branches, or merging when `package.json` or `pnpm-lock.yaml` changed.
- When `pnpm test`, `pnpm start`, or `npx expo export` fail with missing-module errors.
- Do **not** run install before every command when dependencies are already present and package metadata is unchanged.

### CI, clean clones, temporary worktrees, and merge audits

```bash
pnpm install --frozen-lockfile
```

This must **fail** rather than silently rewrite the lockfile when `package.json` metadata and the lockfile are inconsistent.

### Rules

- **Never** use `npm` or `yarn` in this repository — always `pnpm`.
- **Never** manually edit `pnpm-lock.yaml`.
- **Never** use a non-frozen install to bypass a lockfile validation failure — investigate and resolve the discrepancy.
- After installing, verify `git status --short` and ensure package files were not unexpectedly modified.

## Frontend validation commands

Run all four before considering any frontend change complete:

```bash
pnpm test                    # Jest unit tests (5 suites, 40 tests)
npx tsc --noEmit             # TypeScript type-check
npx expo lint                # ESLint via eslint-config-expo
pnpm start --clear           # Runtime verification (clears Metro cache)
```

Automated checks (`pnpm test`, `npx tsc --noEmit`, `npx expo lint`) must pass. `pnpm start --clear` is required for runtime and browser smoke testing — structural changes (layout, navigation, responsive, `app/+html.tsx`) must be visually verified in a browser at representative viewport widths (390, 768, 1024, 1440 px). Production-build smoke test (`npx expo export --platform web`) is an additional check, not a substitute for `pnpm start`.

The file `app/+html.tsx` must preserve `<ScrollViewStyleReset />` from `expo-router/html`. Removing it will break full-viewport height on web.

If `tsc` reports garbled content in `.expo/types/router.d.ts`, delete `mediacion-app/.expo/types` and re-run an export to regenerate it. Metro caching requires the uppercase `Documents` path (`C:/Users/Usuario/Documents/...`) — lowercase path variants cause SHA-1 failures.
