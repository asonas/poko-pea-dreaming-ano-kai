# Web Interface Accessibility Design

## Goal

Improve the search page structure against Web platform conventions, WCAG, and transferable Apple Human Interface Guidelines while preserving the existing twilight-sky visual direction.

## Toolchain

Add a repository-level `mise.toml` that pins Node.js 24.18.0 and pnpm 11.15.1. These versions represent the current Node.js LTS line and stable pnpm release at the time of this design. The configuration is committed so local development and verification use the same runtime and package manager.

## Page Structure

The primary task is searching for and opening a matching podcast scene. The mobile DOM and reading order will therefore be:

1. Page heading and description
2. Search form
3. Episode list, search status, or search results
4. Podcast platform embeds
5. Footer

On desktop, CSS Grid will place the podcast embeds in the left column and the results in the right column without changing DOM order. The desktop appearance remains a two-column layout, while mobile, keyboard, and assistive-technology users encounter the primary content first.

## Semantic Hierarchy

The page keeps one `h1`. Both the initial episode list and search results receive an `h2`. Individual result episodes remain `h3` elements beneath the search-results heading. The visible query and result count remain adjacent to that heading.

## Async States and Recovery

Search progress, result counts, and empty results are exposed through a polite status region. Search failures use an alert region so they are announced immediately. Existing input preservation and the nearby search form remain the recovery path. Visible copy continues to communicate loading, success, empty, and failure states.

## Color and Motion

The action-background pink is darkened enough for white normal-size text to meet WCAG 2.2 AA contrast of at least 4.5:1. Decorative brand pink can remain unchanged. Existing reduced-motion, reduced-transparency, increased-contrast, focus-ring, and pressed-state behavior is preserved.

## Testing

Add the minimum DOM testing dependencies and configuration needed for React component tests. Tests will verify:

- primary content precedes podcast embeds in DOM order;
- search results have an `h2` with episode headings below it;
- loading, empty, and result-count states use `role="status"`, while errors use `role="alert"`;
- the action color token meets a 4.5:1 contrast threshold.

Run the complete Vitest suite, TypeScript checking, and the Next.js production build using the pinned `mise` toolchain. Inspect the resulting diff, including any lockfile changes introduced by pnpm 11.

## Scope

This change does not redesign the visual theme, replace embedded podcast players, change search ranking, or refactor unrelated data-fetching code.
