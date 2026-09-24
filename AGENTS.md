# God Workbench Project Guide

## About This Project

God Workbench is a lightweight web tool for the host of a recurring “King and Angel” game.

The product is not a complete game platform. It should help the host manage information, reduce mistakes, and generate artifacts for WeChat/QQ workflows. The actual social play should remain in the existing chat groups.

## Working Defaults

- Default response language: Chinese
- Code, commands, variables: English
- UX has priority over technical neatness
- Prefer direct fixes over abstract refactors
- Do not add explanatory UI copy unless the user explicitly asks for it
- Keep the interface efficient, quiet, and emotionally appealing enough that the host wants to use it

## Product Boundary

Build for the host first.

Productize:

- Reusable member roster
- Round theme setup
- Copy-ready host messages
- Manual wish entry
- Wish order management
- Blind wish selection screenshots
- Preventing self-selection
- Last-step swap/manual assignment support
- Completion observation
- Reveal table generation
- Round archive

Do not productize as first-class product flows:

- QQ anonymous completion process
- WeChat guessing and teasing
- Free-form hints from the host
- In-group jokes, complaints, probes, and social atmosphere
- Member-facing task check-in flows

If a feature makes the game feel like a task management system, question it before implementing.

## Game Order Semantics

- Member roster is a participant pool, not a game-order queue.
- Member roster display order is only for lookup and roster management.
- The round god is selected from the member roster but is not a player in that same round.
- Round player set means member roster minus the current round god. Wish collection, blind selection, completion observation, reveal rows, and related counts must use the round player set, not the full member roster.
- Do not use member roster order to decide wish submission order, blind selection order, screenshot sending order, or final swap logic.
- The first meaningful game order is wish submission order: whoever submits a wish first is recorded first.
- Blind selection order, screenshot handoff order, and last-step swap detection must be derived from wish submission order.
- Blind selection may start before every round player has submitted a wish once at least two players have submitted. Late wishes are appended to the same wish-submission order and become the remaining blind selection queue.
- Blind selection must prevent dead-end choices before the host records them. If selecting a wish would make later players impossible to assign without self-selection, render that choice as unavailable instead of relying on a later forced swap.
- In status columns, distinguish wish collection from assignment: use `待选择` for a submitted wish that has not been selected by an angel, and `天使 X` only when an assignment exists.
- Completion state is binary: use `未完成` by default and `已完成` when the host knows the wish is complete. Do not reintroduce observation middle states such as `未观察到`, `可能完成`, or `需提醒`.
- Blind selection recovery controls must remain accessible after the queue reaches the end. A completed queue can still contain legacy or inconsistent data, so keep undo/reset reachable when assignments or unassigned wishes exist.
- In the wish table, participants without wishes appear first with an empty wish-order cell; submitted wishes appear after them and are numbered by wish submission order.
- Reordering submitted wishes should reorder the `state.wishes` array itself, preferably by dragging submitted rows, not by storing a separate order field.
- Adding a batch of members means append missing names and skip duplicates unless the user explicitly asks to replace or reorder the roster.

## UX Principles

- Design for the host’s actual sequence: set members, choose this round's god, set theme, collect wishes, record wishes, guide blind selection by wish submission order, observe completion, reveal.
- The left navigation should reflect game phases, not generic app sections.
- Member roster is a low-frequency reusable setup, not a per-round task.
- The system should absorb the Excel pain: hide self-wishes, restore previous wishes for the next chooser, track order, and make screenshot handoff easy.
- Keep social interaction outside the product unless there is a strong reason to bring it in.
- Interface text should be functional and compact. Avoid onboarding paragraphs and feature explanations inside the app.
- Controls must look obviously editable or clickable. Inputs should read as inputs.
- Do not ship inert buttons.

## Visual Direction

- The interface should feel like a polished host console, not a generic admin template.
- Current direction: light glass dashboard, warm accent, soft spatial depth, restrained typography.
- Avoid heavy black blocks, oversized titles, nested cards, and excessive rounded rectangles.
- Use tables/lists with internal dividers when a full card treatment adds no value.
- Font scale should stay modest because this is a repeated-use tool, not a landing page.
- Do not use hero-scale typography in the workbench. This is a repeated-use tool, not a marketing page.
- Do not use viewport-based font sizing (`vw`, `clamp(...vw...)`) for tool UI text.
- Form controls (`input`, `select`, `textarea`, buttons) should usually stay at or below `1rem`; special tool inputs may reach `1.125rem`, but should not become display text.
- Message previews may be slightly larger than body text, but should stay around `1.05rem` to `1.125rem`.
- Panel titles should stay modest, usually no larger than `1.5rem`.

## Code Structure

- `src/main.js`: app entry
- `src/screens/god-workbench/index.js`: UI rendering and event binding
- `src/screens/god-workbench/model.js`: state model, game rules, export builders
- `src/screens/god-workbench/styles.css`: screen styles
- `src/lib/helpers.js`: tiny shared helpers
- `src/test/`: Vitest coverage for core flows

Keep the project small until the product direction demands otherwise.

## Question Before Execution

Before implementing a user request, first challenge whether the request is solving the right problem.

- State the actual user goal behind the request.
- Before changing code, docs, local data, browser state, configuration, desktop launchers, Supabase/cloud state, or other persistent state, briefly explain the intended result and the execution method in user-understandable language.
- For data changes, explicitly say whether the operation will append, replace, reorder, delete, migrate, or only read data.
- Prefer operating through the product's normal UI or established project scripts before directly editing browser storage, databases, generated files, or hidden state.
- Wait for user confirmation when the operation could reasonably be interpreted in more than one way, especially for persistent data or workflow semantics.
- Check whether the requested feature fits the host-first product boundary.
- If the request would add workflow burden, task-management feeling, or fake product intelligence, point that out before coding.
- Prefer the smallest change that removes the real pain.
- If the request is clearly valid and low-risk, keep the challenge and method confirmation brief, then execute directly.

## Implementation Rules

- Read existing code before modifying.
- Preserve localStorage compatibility unless intentionally migrating data.
- Add tests for rule changes, selection flow changes, export changes, and archive behavior.
- Prefer simple browser-native UI over new dependencies.
- Do not introduce a backend until the product needs multi-device persistence or shared host/member access.
- Do not add authentication unless the workflow truly requires it.
- Do not commit `dist/`, `node_modules/`, `.DS_Store`, secrets, or credentials.

## Validation

Run after meaningful changes:

```bash
npm run check
```

For bug-prone state transitions and user misoperations, add isolated regression tests instead of manually probing the user's real local data:

```bash
npm run test:regression
```

Regression cases should construct sandbox workbench states, perform the risky operation, then assert that wishes, assignments, selection order, reveal rows, and completion state remain valid. Use this especially for completed-round edits, accidental god changes, late wishes, undo/reset, roster changes, old local data, and archive restore behavior.

For real host workflow and rendered layout risks, use the Playwright browser checks:

```bash
npm run test:e2e
npm run test:visual
npm run test:browser
```

Use `npm run test:e2e` for P0 flow risks: first-use member setup, god selection, theme setup, wish entry, blind selection, undo/reset reachability, completion, reveal, archive, reload/persistence, and misoperations that can only be trusted through the real UI.

Use `npm run test:visual` for P1 experience risks: restrained tool typography, long member/wish layouts, sticky topbar, narrow viewport overflow, reveal table headers, completion grid density, and unexpected auto-scroll.

Use sandbox browser contexts and seeded localStorage states in these tests. Do not run browser automation against the user's real local product data unless the user explicitly asks.

Before treating the product as relatively complete or ready for sustained real use, run a dedicated full exception-set pass. This is a quality gate, not routine churn.

The pass should expand `src/test/god-workbench-regression.test.js` and cover at least:

- Completed round edits: accidental god changes, theme/date edits, completion toggles, reveal generation, archive/update archive.
- Roster changes around active and completed rounds: append member, duplicate member, remove non-round member, attempted removal of relevant member, god still excluded.
- Wish table edge cases: late wish after selection starts, long wishes, empty wish attempts, updating an existing wish, deleting a wish with assignments, drag reorder after partial selection.
- Blind selection recovery: undo, reset, reselect, conflict prevention, last-player dead-end prevention, completed queue with inconsistent legacy data.
- Persistence and migration: reload after each major phase, old localStorage shapes, old completion statuses, archive restore, member roster compatibility.
- Responsive/visual smoke checks: long member list, narrow viewport, reveal table headers, completion grid, no unexpected auto-scroll.

Use isolated sandbox states and automated assertions first. Use AI/browser exploration as a supplement for finding suspicious flows, but convert confirmed risks into deterministic regression tests.

For a full local quality gate, run:

```bash
npm run check:full
```

For visual/UI changes, also run the app and inspect the real page:

```bash
npm run dev
```

Then open:

```text
http://localhost:43174/
```

## Deployment

This is a static Vite app.

Build:

```bash
npm run build
```

Deploy the generated `dist/` directory to Tencent Cloud static hosting or another static hosting provider.
