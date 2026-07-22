# Dependency Security Remediation Design

## Goal

Remove all vulnerabilities reported by `pnpm audit` while preserving the podcast search behavior and the current visual design.

## Current Risk

The installed dependency graph reports 54 vulnerabilities: 3 critical, 22 high, 24 moderate, and 5 low. Directly relevant findings include authorization bypass and denial-of-service issues in Next.js 14.2.5, an arbitrary-code-execution issue in the transitive protobufjs version, and a development-server file-read issue in Vitest 4.0.18.

The application uses the App Router, so the React Server Components denial-of-service advisory applies. The repository does not contain Next.js middleware, which limits exposure to the middleware authorization-bypass finding but does not make the vulnerable framework version acceptable.

## Dependency Strategy

Update vulnerable direct dependencies to their current stable release lines:

- Next.js 16.2.x with React and React DOM 19.2.x;
- Supabase JS 2.110.x;
- Vitest 4.1.x;
- Transformers.js 4.2.x under the maintained `@huggingface/transformers` package name;
- matching React and Node.js type packages.

Keep Tailwind CSS 3 and TypeScript 5 because their major upgrades are unrelated to the audit findings and would expand the migration surface. Patch and minor updates required by the dependency resolver are allowed.

Do not use package overrides to force incompatible transitive versions. Replace or update the owning direct dependency instead.

## Transformers Migration

Replace `@xenova/transformers` with `@huggingface/transformers`. Keep the existing `Xenova/multilingual-e5-small` model and query prefix so generated vectors remain compatible with stored embeddings.

Update the feature-extraction pipeline options from the former `quantized: true` option to the current quantized `dtype` option. Preserve mean pooling, normalization, lazy singleton initialization, disabled local models, and the configured cache directory.

Add a unit test that mocks the maintained package at its public API boundary. The test must verify model selection, quantized dtype, query prefix, pooling, normalization, and conversion of tensor data to a number array without downloading the model.

## Framework Migration

Apply the official Next.js 16 migration requirements that affect this repository. Preserve App Router route behavior, Node.js runtime selection, dynamic rendering, no-store behavior, and build output. Do not adopt unrelated Next.js 16 features.

React 19 compatibility is verified through component tests, TypeScript checking, and a production build. Test infrastructure may be adjusted only where React 19 changes supported test behavior.

## Verification

Use the repository's pinned Node.js 24.18.0 and pnpm 11.15.1 toolchain. Completion requires all of the following on the updated lockfile:

1. The complete Vitest suite passes.
2. TypeScript checking passes with no errors.
3. The Next.js production build succeeds.
4. `pnpm audit` reports no known vulnerabilities and exits successfully.
5. `git diff --check` reports no whitespace errors.

If the latest compatible direct dependencies still contain a vulnerable transitive dependency, investigate the owning package and use a maintained replacement. Do not suppress audit findings.

## Scope

This work does not redesign the interface, change search ranking, regenerate stored embeddings, migrate Tailwind CSS, migrate TypeScript to version 7, or add new application features.
