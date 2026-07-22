# Web Interface Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the podcast search page prioritize results on mobile, expose a correct heading and live-region structure, meet WCAG AA action-text contrast, and provide a reproducible current toolchain.

**Architecture:** Keep `SearchContent` as the page state owner and change only its document structure and layout classes. Render the main-content column before the podcast embeds in the DOM, then use desktop CSS Grid placement to retain the existing visual columns. Use React Testing Library for user-visible semantics and a small CSS-token regression test for contrast.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Tailwind CSS 3, Vitest 4, React Testing Library, jsdom, mise, Node.js 24.18.0, pnpm 11.15.1

## Global Constraints

- Pin Node.js exactly to 24.18.0 and pnpm exactly to 11.15.1 in repository-level `mise.toml`.
- Preserve the existing twilight-sky theme and desktop two-column appearance.
- Mobile DOM order is header, search form, primary results/list, podcast embeds, footer.
- Loading, empty, and result-count states use `role="status"`; errors use `role="alert"`.
- White normal-size action text must have a contrast ratio of at least 4.5:1.
- Do not alter search ranking, API behavior, or podcast embed providers.

---

### Task 1: Reproducible JavaScript toolchain

**Files:**
- Create: `mise.toml`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`

**Interfaces:**
- Consumes: installed `mise` executable
- Produces: `mise exec -- node`, `mise exec -- pnpm`, and a package manifest declaring `pnpm@11.15.1`

- [ ] **Step 1: Add the repository tool versions**

Create `mise.toml`:

```toml
[tools]
node = "24.18.0"
pnpm = "11.15.1"
```

- [ ] **Step 2: Install and verify the pinned tools**

Run:

```sh
mise install
mise exec -- node --version
mise exec -- pnpm --version
```

Expected: the commands print `v24.18.0` and `11.15.1`.

- [ ] **Step 3: Declare the package manager and refresh dependencies**

Add this top-level field to `web/package.json`:

```json
"packageManager": "pnpm@11.15.1"
```

Run:

```sh
mise exec -- pnpm --dir web install
```

Expected: installation exits 0 and `web/pnpm-lock.yaml` remains a valid pnpm lockfile.

- [ ] **Step 4: Verify the existing suite before UI changes**

Run:

```sh
mise exec -- pnpm --dir web test
mise exec -- pnpm --dir web exec tsc --noEmit
```

Expected: existing tests and type checking exit 0. Record any pre-existing failure before continuing.

### Task 2: Accessibility regression tests

**Files:**
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`
- Create: `web/src/app/page.test.tsx`
- Create: `web/src/app/globals.test.ts`

**Interfaces:**
- Consumes: default `Home` component from `web/src/app/page.tsx` and CSS token `--pink-deep`
- Produces: regression coverage for DOM order, headings, status roles, alerts, and action contrast

- [ ] **Step 1: Install DOM test dependencies**

Run:

```sh
mise exec -- pnpm --dir web add --save-dev @testing-library/react @testing-library/dom jsdom
```

Expected: dependencies are added to `web/package.json` and the lockfile.

- [ ] **Step 2: Write a failing page semantics test**

Create `web/src/app/page.test.tsx` with `// @vitest-environment jsdom`, mock `next/navigation`, and stub `global.fetch`. Render `Home`, then assert:

```tsx
const resultsRegion = await screen.findByRole('region', { name: '配信一覧' });
const platformsRegion = screen.getByRole('complementary', { name: '配信を聴く' });
expect(resultsRegion.compareDocumentPosition(platformsRegion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
```

For a mocked successful search response, assert:

```tsx
expect(await screen.findByRole('heading', { level: 2, name: '検索結果' })).toBeTruthy();
expect(screen.getByRole('heading', { level: 3, name: 'テスト回' })).toBeTruthy();
expect(screen.getByRole('status').textContent).toContain('1件');
```

For a rejected search response, assert:

```tsx
expect((await screen.findByRole('alert')).textContent).toContain('検索に失敗しました');
```

- [ ] **Step 3: Run the page test and verify RED**

Run:

```sh
mise exec -- pnpm --dir web vitest run src/app/page.test.tsx
```

Expected: FAIL because the primary region follows the complementary region, the results `h2` is absent, and live-region roles are absent.

- [ ] **Step 4: Write a failing contrast regression test**

Create `web/src/app/globals.test.ts`. Read `globals.css`, extract `--pink-deep`, calculate relative luminance using the WCAG sRGB formula, and assert:

```ts
expect(contrastRatio(actionColor, '#ffffff')).toBeGreaterThanOrEqual(4.5);
```

- [ ] **Step 5: Run the contrast test and verify RED**

Run:

```sh
mise exec -- pnpm --dir web vitest run src/app/globals.test.ts
```

Expected: FAIL with the current ratio near 3.96:1.

### Task 3: Semantic structure and responsive reading order

**Files:**
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: existing `SearchContent`, `SectionLabel`, `EpisodeList`, and `PodcastPlatforms`
- Produces: labelled primary and complementary regions with a logical DOM order and desktop grid placement

- [ ] **Step 1: Move primary content before the podcast embeds**

Replace the flex wrapper with a two-column desktop grid:

```tsx
<div className="mt-6 grid items-start gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
```

Render the primary content first with desktop column placement:

```tsx
<div className="min-w-0 md:col-start-2 md:row-start-1">
```

Render the podcast `aside` second and place it visually in the first desktop column:

```tsx
<aside
  aria-labelledby="podcast-platforms-heading"
  className="mt-8 rise md:col-start-1 md:row-start-1 md:mt-0"
>
```

Give the `SectionLabel` heading an optional `id` prop and pass `podcast-platforms-heading` for the platform heading.

- [ ] **Step 2: Label the initial episode-list region**

Add `id="episode-list-heading"` to its `SectionLabel` and `aria-labelledby="episode-list-heading"` to the containing `section`.

- [ ] **Step 3: Add the search-results heading**

When search metadata exists, render a labelled `section` with a visible `h2` named `検索結果`. Keep query, count, and timing subordinate to that heading, and keep each episode title as `h3`.

- [ ] **Step 4: Run the focused page test and verify remaining failures**

Run:

```sh
mise exec -- pnpm --dir web vitest run src/app/page.test.tsx
```

Expected: DOM-order and heading assertions pass; status and alert assertions still fail until Task 4.

### Task 4: Async status semantics

**Files:**
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: existing `isLoading`, `error`, `meta`, and `groupedResults` state
- Produces: one polite status region for non-error search outcomes and an assertive error alert

- [ ] **Step 1: Mark failures as alerts**

Add `role="alert"` to the existing visible error container. Keep the search input value unchanged so submitting again remains the recovery action.

- [ ] **Step 2: Mark non-error outcomes as status messages**

Add `role="status"` to the visible loading message, result metadata, and empty-result container. Ensure only the currently applicable state renders, avoiding simultaneous duplicate status announcements.

- [ ] **Step 3: Run the page test and verify GREEN**

Run:

```sh
mise exec -- pnpm --dir web vitest run src/app/page.test.tsx
```

Expected: all page semantics tests pass.

### Task 5: WCAG AA action contrast

**Files:**
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Consumes: `--pink-deep` action-color token
- Produces: a darker action token with at least 4.5:1 contrast against white

- [ ] **Step 1: Darken only the action pink token**

Replace `--pink-deep: #c05ca4` with a visually related darker pink whose calculated white-text contrast is at least 4.5:1. Do not change `--pink`, which remains the decorative brand color.

- [ ] **Step 2: Run the contrast test and verify GREEN**

Run:

```sh
mise exec -- pnpm --dir web vitest run src/app/globals.test.ts
```

Expected: the measured contrast ratio is at least 4.5:1.

### Task 6: Full verification

**Files:**
- Verify: `mise.toml`
- Verify: `web/package.json`
- Verify: `web/pnpm-lock.yaml`
- Verify: `web/src/app/page.tsx`
- Verify: `web/src/app/page.test.tsx`
- Verify: `web/src/app/globals.css`
- Verify: `web/src/app/globals.test.ts`

**Interfaces:**
- Consumes: all preceding tasks
- Produces: evidence that tests, types, build, formatting checks, and requirement checks pass together

- [ ] **Step 1: Run automated verification**

Run:

```sh
mise exec -- pnpm --dir web test
mise exec -- pnpm --dir web exec tsc --noEmit
mise exec -- pnpm --dir web build
git diff --check
```

Expected: all commands exit 0 with no test failures, TypeScript errors, build errors, or whitespace errors.

- [ ] **Step 2: Inspect the final change set**

Run:

```sh
git status --short
git diff --stat
git diff -- mise.toml web/package.json web/src/app/page.tsx web/src/app/globals.css
```

Expected: only the approved toolchain, test support, semantic layout, live-state, and contrast changes appear.

- [ ] **Step 3: Check each design requirement**

Confirm from the rendered DOM tests and source diff that mobile DOM order prioritizes results, desktop grid placement retains two columns, headings are `h1` → `h2` → `h3`, live states use the specified roles, and action contrast is at least 4.5:1.
