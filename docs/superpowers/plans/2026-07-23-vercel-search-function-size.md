# Vercel Search Function Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Vercel `api/search` function below the 250 MB uncompressed limit without enabling the large-functions beta.

**Architecture:** Bundle Transformers.js through webpack so the existing aliases remove the Node ONNX and sharp backends, leaving the WebAssembly inference path. Add a configuration regression test and a build-trace checker that rejects native ONNX files and reports the traced uncompressed size.

**Tech Stack:** Next.js 16.2.10, webpack, Transformers.js 4.2.0, Vitest 4.1.10, Node.js 24

## Global Constraints

- Preserve `Xenova/multilingual-e5-small`, `dtype: 'q8'`, the `query: ` prefix, mean pooling, normalization, and `number[]` output.
- Do not enable `VERCEL_SUPPORT_LARGE_FUNCTIONS`.
- The traced `api/search` function must be smaller than 250 MB uncompressed.
- Do not modify the user's untracked dependency-remediation plan.

---

### Task 1: Bundle Transformers.js without native backends

**Files:**
- Create: `web/next.config.test.ts`
- Modify: `web/next.config.js`

**Interfaces:**
- Consumes: Next.js `webpack(config)` configuration callback
- Produces: a webpack configuration with `onnxruntime-node$` and `sharp$` disabled and no Transformers.js externalization

- [ ] **Step 1: Write the failing configuration test**

Create `web/next.config.test.ts`:

```ts
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const nextConfig = require('./next.config.js');

describe('search function dependencies', () => {
  it('bundles Transformers.js without native inference backends', () => {
    expect(nextConfig.serverExternalPackages ?? []).not.toContain(
      '@huggingface/transformers',
    );

    const webpackConfig = nextConfig.webpack({ resolve: { alias: {} } });

    expect(webpackConfig.resolve.alias).toMatchObject({
      'onnxruntime-node$': false,
      'sharp$': false,
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `mise exec -- pnpm --dir web exec vitest run next.config.test.ts`

Expected: FAIL because `serverExternalPackages` contains `@huggingface/transformers`.

- [ ] **Step 3: Remove Transformers.js externalization**

Delete this property from `web/next.config.js`:

```js
serverExternalPackages: ['@huggingface/transformers'],
```

Keep both native-backend aliases unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `mise exec -- pnpm --dir web exec vitest run next.config.test.ts`

Expected: PASS.

### Task 2: Enforce the Vercel function-size boundary

**Files:**
- Create: `web/scripts/check-search-function-size.mjs`
- Modify: `web/package.json`

**Interfaces:**
- Consumes: `.next/server/app/api/search/route.js.nft.json`
- Produces: exit code 0 and a byte count when the trace excludes native ONNX and is below 250 MB; otherwise exit code 1 with a diagnostic

- [ ] **Step 1: Add the trace checker**

Create `web/scripts/check-search-function-size.mjs`:

```js
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const manifestPath = fileURLToPath(
  new URL('../.next/server/app/api/search/route.js.nft.json', import.meta.url),
);
const maximumBytes = 250 * 1024 * 1024;
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const blockedEntries = manifest.files.filter(
  (file) =>
    file.includes('onnxruntime-node') ||
    file.includes('libonnxruntime_providers_cuda'),
);

if (blockedEntries.length > 0) {
  throw new Error(
    `api/search trace contains native ONNX files:\n${blockedEntries.join('\n')}`,
  );
}

const measuredFiles = new Set();

async function measure(entryPath) {
  await lstat(entryPath);
  const resolvedPath = await realpath(entryPath);
  const entry = await stat(resolvedPath);

  if (entry.isDirectory()) {
    const children = await readdir(resolvedPath);
    const sizes = await Promise.all(
      children.map((child) => measure(join(resolvedPath, child))),
    );
    return sizes.reduce((total, size) => total + size, 0);
  }

  if (!entry.isFile() || measuredFiles.has(resolvedPath)) {
    return 0;
  }

  measuredFiles.add(resolvedPath);
  return entry.size;
}

const sizes = await Promise.all(
  manifest.files.map((file) => measure(resolve(dirname(manifestPath), file))),
);
const totalBytes = sizes.reduce((total, size) => total + size, 0);
const totalMegabytes = totalBytes / 1024 / 1024;

console.log(
  `api/search traced size: ${totalBytes} bytes (${totalMegabytes.toFixed(2)} MB)`,
);

if (totalBytes >= maximumBytes) {
  throw new Error(
    `api/search trace exceeds the 250 MB limit by ${totalBytes - maximumBytes} bytes`,
  );
}
```

- [ ] **Step 2: Expose the checker as a package script**

Add to `web/package.json`:

```json
"check:function-size": "node scripts/check-search-function-size.mjs"
```

- [ ] **Step 3: Build and run the checker**

Run:

```sh
mise exec -- pnpm --dir web build
mise exec -- pnpm --dir web check:function-size
```

Expected: the build succeeds, the NFT trace contains no Node ONNX path, and the checker reports less than 262144000 bytes.

### Task 3: Complete verification

**Files:**
- Verify: `web/src/lib/embeddings.test.ts`
- Verify: all changed files

**Interfaces:**
- Produces: deployable search function configuration with unchanged embedding behavior

- [ ] **Step 1: Run all verification commands**

```sh
mise exec -- pnpm --dir web test
mise exec -- pnpm --dir web exec tsc --noEmit
mise exec -- pnpm --dir web build
mise exec -- pnpm --dir web check:function-size
mise exec -- pnpm --dir web audit --audit-level critical
git diff --check
```

Expected: every command exits 0; all embedding assertions pass; the function trace is below 250 MB; the critical audit contains no critical finding.

- [ ] **Step 2: Commit the fix**

Stage only `web/next.config.js`, `web/next.config.test.ts`, `web/scripts/check-search-function-size.mjs`, and `web/package.json`. Commit with `git ai-commit` using the context: `keep the Vercel search function below 250 MB by bundling the Transformers.js WASM backend and rejecting native ONNX traces`.
