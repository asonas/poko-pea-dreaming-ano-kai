# Dependency Security Remediation Design

## Goal

Remove vulnerabilities through maintained dependency upgrades while preserving the podcast search behavior and visual design. Do not bypass dependency constraints with package overrides.

## Current Risk

The installed dependency graph reports 54 vulnerabilities: 3 critical, 22 high, 24 moderate, and 5 low. Directly relevant findings include authorization bypass and denial-of-service issues in Next.js 14.2.5, an arbitrary-code-execution issue in the transitive protobufjs version, and a development-server file-read issue in Vitest 4.0.18.

The application uses the App Router, so the React Server Components denial-of-service advisory applies. The repository does not contain Next.js middleware, which limits exposure to the middleware authorization-bypass finding but does not make the vulnerable framework version acceptable.

## Dependency Strategy

Update vulnerable direct dependencies to their current stable release lines:

- Next.js 16.2.x with React and React DOM 19.2.x;
- Supabase JS 2.110.x;
- Vitest 4.1.x;
- Transformers.js 4.2.x under the maintained `@huggingface/transformers` package name;
- Tailwind CSS 4.x and its dedicated PostCSS plugin;
- TypeScript 7.x and matching React and Node.js type packages.

Use the newest stable versions admitted by the configured pnpm minimum-release-age policy. Do not add package-version exclusions merely to install a release published too recently. Patch and minor updates required by the dependency resolver are allowed.

Do not use package overrides to force transitive versions. Replace or update the owning direct dependency when a maintained release is available. Record findings that remain because the latest eligible owner has not yet adopted a fixed transitive dependency.

## Transformers Migration

Replace `@xenova/transformers` with `@huggingface/transformers`. Keep the existing `Xenova/multilingual-e5-small` model and query prefix so generated vectors remain compatible with stored embeddings.

Update the feature-extraction pipeline options from the former `quantized: true` option to the current quantized `dtype` option. Preserve mean pooling, normalization, lazy singleton initialization, disabled local models, and the configured cache directory.

Add a unit test that mocks the maintained package at its public API boundary. The test must verify model selection, quantized dtype, query prefix, pooling, normalization, and conversion of tensor data to a number array without downloading the model.

## Framework Migration

Apply the official Next.js 16 migration requirements that affect this repository. Preserve App Router route behavior, Node.js runtime selection, dynamic rendering, no-store behavior, and build output. Do not adopt unrelated Next.js 16 features.

React 19 compatibility is verified through component tests, TypeScript checking, and a production build. Test infrastructure may be adjusted only where React 19 changes supported test behavior.

## Tailwind CSS Migration

Move from Tailwind CSS 3 to 4 using the official PostCSS integration. Replace the former Tailwind PostCSS plugin and Autoprefixer with `@tailwindcss/postcss`, migrate global directives and theme tokens to the supported CSS-first form, and remove configuration that is no longer used.

Preserve all existing colors, typography, shadows, responsive layouts, contrast fixes, motion preferences, and increased-contrast behavior. Tailwind CSS 4 sets the browser floor to Safari 16.4, Chrome 111, and Firefox 128.

## Verification

Use the repository's pinned Node.js 24.18.0 and pnpm 11.15.1 toolchain. Completion requires all of the following on the updated lockfile:

1. The complete Vitest suite passes.
2. TypeScript checking passes with no errors.
3. The Next.js production build succeeds.
4. `pnpm audit --audit-level critical` exits successfully with zero critical findings.
5. Every remaining lower-severity finding is owned by a current direct dependency, documented with its dependency path and fixed-version status, and cannot be removed through a normal direct update.
6. `git diff --check` reports no whitespace errors.

The unfiltered `pnpm audit` output remains visible in verification. Findings are not suppressed or ignored; only the CI failure threshold is set to critical while upstream packages catch up.

## Scope

This work does not redesign the interface, change search ranking, regenerate stored embeddings, replace the application framework, or add new application features.
