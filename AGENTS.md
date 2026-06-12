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

## UX Principles

- Design for the host’s actual sequence: set members, set theme, collect wishes, record wishes, guide blind selection, observe completion, reveal.
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

## Code Structure

- `src/main.js`: app entry
- `src/screens/god-workbench/index.js`: UI rendering and event binding
- `src/screens/god-workbench/model.js`: state model, game rules, export builders
- `src/screens/god-workbench/styles.css`: screen styles
- `src/lib/helpers.js`: tiny shared helpers
- `src/test/`: Vitest coverage for core flows

Keep the project small until the product direction demands otherwise.

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
