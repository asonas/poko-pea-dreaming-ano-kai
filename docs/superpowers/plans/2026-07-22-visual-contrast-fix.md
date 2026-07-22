# Visual Contrast Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep section labels and the search placeholder readable at WCAG 2.2 AA contrast across the fixed sky gradient.

**Architecture:** Add two focused CSS classes backed by existing opaque theme colors. Attach those classes to `SectionLabel` and the search input, and extend the existing CSS-token contrast test so the guaranteed foreground/background pairs cannot regress.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Tailwind CSS 3, Vitest 4

## Global Constraints

- Preserve the twilight-sky gradient, pink accent dot, compact section-label appearance, and translucent outer search console.
- Use an opaque `--navy` section-label background with white text.
- Use an opaque white search-input background with an opaque `--ink-soft` placeholder.
- Require a contrast ratio of at least 4.5:1 for both pairs.
- Do not change search behavior, data fetching, content order, or podcast embeds.

---

### Task 1: Contrast regression coverage and styles

**Files:**
- Modify: `web/src/app/globals.test.ts`
- Modify: `web/src/app/globals.css`
- Modify: `web/src/app/page.test.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: CSS tokens `--navy` and `--ink-soft`; `SectionLabel`; the search input
- Produces: `.section-label` and `.search-input` CSS contracts with WCAG AA foreground/background pairs

- [ ] **Step 1: Write failing CSS-contract tests**

Extend `globals.test.ts` with token extraction and assertions that the stylesheet contains opaque class declarations and that both color pairs reach 4.5:1:

```ts
function colorToken(css: string, name: string): string {
  const value = css.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6})`, 'i'))?.[1];

  if (!value) {
    throw new Error(`Missing color token: --${name}`);
  }

  return value;
}

it('gives section labels an opaque AA background', () => {
  const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

  expect(css).toMatch(/\.section-label\s*{[^}]*background:\s*var\(--navy\)/);
  expect(contrastRatio(colorToken(css, 'navy'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
});

it('gives the search placeholder an opaque AA surface', () => {
  const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

  expect(css).toMatch(/\.search-input\s*{[^}]*background:\s*#ffffff/);
  expect(css).toMatch(/\.search-input::placeholder\s*{[^}]*color:\s*var\(--ink-soft\)[^}]*opacity:\s*1/);
  expect(contrastRatio(colorToken(css, 'ink-soft'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```sh
mise exec -- pnpm --dir web exec vitest run src/app/globals.test.ts
```

Expected: the two new tests fail because `.section-label` and `.search-input` do not exist.

- [ ] **Step 3: Add the minimal opaque styles**

Add to `globals.css`:

```css
.section-label {
  width: fit-content;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background: var(--navy);
}

.search-input {
  background: #ffffff;
}
.search-input::placeholder {
  color: var(--ink-soft);
  opacity: 1;
}
```

In `page.tsx`, add `section-label` to the `SectionLabel` wrapper. Add `search-input` to the search input and remove `bg-white/70`, `placeholder:text-ink-soft/60`, and `focus:bg-white` from its Tailwind classes.

Add a component test to `page.test.tsx` that renders the initial page and verifies the `section-label`, `text-white`, and `search-input` class bindings on the rendered heading and input.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```sh
mise exec -- pnpm --dir web exec vitest run src/app/globals.test.ts src/app/page.test.tsx
```

Expected: all contrast and page tests pass.

### Task 2: Full and visual verification

**Files:**
- Verify: `web/src/app/globals.test.ts`
- Verify: `web/src/app/globals.css`
- Verify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: Task 1 styles and rendered page
- Produces: automated and visual evidence for the final commit

- [ ] **Step 1: Run automated verification**

Run:

```sh
mise exec -- pnpm --dir web test
mise exec -- pnpm --dir web exec tsc --noEmit
mise exec -- pnpm --dir web build
git diff --check
```

Expected: all commands exit 0 with no test, type, build, or whitespace failures.

- [ ] **Step 2: Inspect rendered mobile and desktop pages**

Start the local app and capture settled screenshots at approximately 390px and 1440px viewport widths. Confirm that the navy labels remain compact, the pink dot remains visible, the input stays visually inside the glass console, and neither change disrupts wrapping or spacing.

- [ ] **Step 3: Commit the implementation**

Stage only the four implementation files and this plan, then create one implementation commit using `git ai-commit`. Confirm that only the unrelated dependency-remediation plan remains untracked before pushing `main`.
