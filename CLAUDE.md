# God Workbench Project Guide

## About This Project

God Workbench is a lightweight web tool for the host of a recurring "King and Angel" game.

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
- Do not use member roster order to decide wish submission order, blind selection order, screenshot sending order, or final swap logic.
- The first meaningful game order is wish submission order: whoever submits a wish first is recorded first.
- Blind selection order, screenshot handoff order, and last-step swap detection must be derived from wish submission order.
- In the wish table, participants without wishes appear first with an empty wish-order cell; submitted wishes appear after them and are numbered by wish submission order.
- Reordering submitted wishes should reorder the `state.wishes` array itself, preferably by dragging submitted rows, not by storing a separate order field.
- Adding a batch of members means append missing names and skip duplicates unless the user explicitly asks to replace or reorder the roster.

## UX Principles

- Design for the host's actual sequence: set members, choose this round's god, set theme, collect wishes, record wishes, guide blind selection by wish submission order, observe completion, reveal.
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

## Context Budget Rules

Always exclude these paths from searches and broad reads unless the task explicitly needs them:

- `node_modules/`
- `dist/`
- `.git/`
- `package-lock.json`
- `.DS_Store`

Prefer targeted Grep or Glob over reading large files whole. Before opening `index.js` or `styles.css`, locate the relevant function or selector first.

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

## Change Boundaries

Match verification effort to change risk:

- CSS or copy tweaks: visual check usually enough
- Type, prop, or import changes: `npm run check` + `npm run build`
- State, persistence, game rule, or flow changes: full test suite (`npx vitest run`)
- Documentation-only changes: no verification needed

Preserve localStorage compatibility unless intentionally migrating data.

## Validation

Run after meaningful changes:

```bash
npm run check
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
