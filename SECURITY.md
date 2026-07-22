# Security Policy

## Dependency updates

This project uses the newest stable direct dependencies admitted by the pnpm
supply-chain policy. Dependency audit findings are not suppressed and
`pnpm.overrides` is intentionally not used. Transitive findings are removed by
updating their owning direct dependency or by refreshing compatible transitive
versions.

The release gate is:

```sh
mise exec -- pnpm --dir web audit --audit-level critical
```

The complete, unfiltered audit must also be reviewed whenever dependencies are
updated.

## Accepted upstream findings

Last reviewed: 2026-07-22

| Severity | Advisory | Installed path | Patched version | Why it remains | Removal condition |
| --- | --- | --- | --- | --- | --- |
| High | [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) | `@huggingface/transformers@4.2.0 > onnxruntime-node@1.24.3 > adm-zip@0.5.18` | `adm-zip >=0.6.0` | The current Transformers.js release owns the pinned ONNX Runtime dependency. The application does not accept user-supplied model archives. | Upgrade Transformers.js when it selects an ONNX Runtime release containing patched `adm-zip`. |
| High | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) | `next@16.2.10 > sharp@0.34.5`; `@huggingface/transformers@4.2.0 > sharp@0.34.5` | `sharp >=0.35.0` | Both current direct owners still select sharp 0.34.5. The application does not expose arbitrary image transformation inputs through these packages. | Upgrade Next.js and Transformers.js when their supported dependency ranges admit sharp 0.35 or later. |
| Moderate | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | `next@16.2.10 > postcss@8.4.31` | `postcss >=8.5.10` | The application-level PostCSS is patched, but Next.js bundles its own older copy. CSS input is repository-controlled rather than supplied by users. | Upgrade Next.js when it bundles patched PostCSS. |
| Low | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | `vite@8.1.5 > esbuild@0.27.3` | `esbuild >=0.28.1` | Current Vite selects esbuild 0.27.3. The advisory affects the development server on Windows; production is built in CI and the development server must not be exposed to untrusted networks. | Upgrade Vite when it selects esbuild 0.28.1 or later. |

## TypeScript compatibility

TypeScript 7.0.2 is not currently compatible with Next.js 16.2.10's build-time
type checker because TypeScript 7 no longer exports
`typescript/lib/typescript.js`. TypeScript 5.9.3 is therefore the newest
compatible compiler used by this project. Re-evaluate TypeScript 7 when Next.js
loads its supported public compiler API.
