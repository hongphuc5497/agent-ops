# Design System: Agent Ops Kanban

## 1. Visual Theme & Atmosphere

Agent Ops Kanban is a cockpit-dense repo workbench for one active developer and
their agents. The atmosphere is calm, operational, and source-controlled: closer
to a well-kept Git client than a startup dashboard. It should feel native to a
local developer workflow, with high information density, restrained color, and
visible state transitions that explain what changed.

Design dials:

- **Variance:** 4 - predictable structure with small asymmetry in side panels
- **Motion:** 2 - static restrained, with tactile feedback only
- **Density:** 8 - compact task cards, monospace numbers, minimal wasted space

The interface must never feel like a marketing page. It is a tool surface for
tracking repo task state and safely creating or updating Agent Ops tasks.

## 2. Color Palette & Roles

- **Workbench Canvas** (#F5F6F2) - primary app background, slightly warm but not beige
- **Paper Surface** (#FFFFFF) - forms, drawer body, editable panels
- **Inset Surface** (#EEF1EA) - column wells, filter groups, inactive rows
- **Charcoal Text** (#20251D) - primary text, never pure black
- **Muted Lichen** (#67705F) - secondary text, timestamps, helper copy
- **Structure Line** (#D9DDD4) - default borders, column separators
- **Strong Structure** (#B7C0B0) - active dividers and command output edges
- **Command Green** (#2F6F4E) - the single accent for active state, primary actions, focus rings
- **Command Green Wash** (#DFEEE5) - selected cards, focus backgrounds, active nav fill
- **Warning Ochre** (#8B5B18) - stale task and verification warnings only
- **Failure Clay** (#9A3A31) - failed checks and destructive states only

Rules:

- Command Green is the only accent. No second accent color for owners, workflows, or labels.
- Status differences rely on text labels, shape, and border treatment before color.
- No purple, blue neon, outer glows, or gradient accents.
- No pure black (#000000) or pure white as a page theme. White is allowed only as a surface.

## 3. Typography Rules

- **Display and UI Sans:** Geist or Satoshi. Use `font-weight: 650-760` for headings.
- **Body:** Geist or Satoshi at 14px base, relaxed enough for scanning but compact.
- **Mono:** Geist Mono or JetBrains Mono for task ids, file claims, timestamps, counts, command names, and verification snippets.
- **Line Length:** Narrative helper text max 65ch. Board labels and cards should be concise.
- **Numbers:** All counts and durations use monospace with tabular numerals.
- **Banned:** Inter, generic serif fonts, decorative serif emphasis, oversized display type.

Scale:

- Page title: 20-22px, tight line height
- Section labels: 11px uppercase with low letter spacing, used sparingly
- Card title: 13-14px, semibold, max 2 lines
- Metadata: 12px, muted, monospace only for structured values
- Form labels: 12px, semibold, always above inputs

## 4. Component Stylings

### Buttons

- Primary button uses Command Green fill with white text.
- Secondary buttons are Paper Surface with Strong Structure border.
- Active press state translates down 1px, no scaling.
- Minimum tap target is 44px in touch layouts and 34px only in desktop dense mode.
- Button labels are short verbs: `New task`, `Save`, `Park`, `Finish`, `Refresh`.

### Task Cards

- Task cards are compact bordered records, not floating marketing cards.
- Radius: 9px for cards, 10px for panels, 8px for controls.
- Selected card gets Command Green border plus a 2px Command Green Wash ring.
- No large shadows inside columns. Use border contrast and background wells.
- Card content order: title, owner/status row, verification or claim summary.

### Columns

- Four default columns: `Backlog`, `Active`, `Parked`, `Done`.
- Active column appears second and carries the strongest state emphasis.
- Column headers show count on the right in monospace.
- Empty columns show a composed empty state with one action, not just blank space.

### Drawer and Forms

- Right drawer is the only edit surface in v1.
- Labels sit above inputs. Error text sits below inputs.
- Verification field is a textarea with monospace content.
- File claims render as compact monospace chips.
- Save actions must describe the command they will run or the state file they will change.

### Loading States

- Use skeleton rectangles matching card, column, and drawer shapes.
- No circular spinners.
- Keep the board frame visible while data loads.

### Empty States

- Board empty state explains the next action: start a task or import archived tasks.
- Column empty states stay small and local.
- Empty state copy must be functional, not cute.

### Error States

- Errors are inline near the failed operation.
- Failed writes show command, exit code, and stderr excerpt.
- Never hide write failures in a toast-only flow.

## 5. Layout Principles

- Three-zone desktop layout: left filters, center board, right editor drawer.
- Desktop grid: `220px minmax(680px, 1fr) 360px`.
- Max app width can be full viewport because this is a workbench, not an article.
- CSS Grid over flex percentage math.
- No overlapping elements. No floating decorative layers.
- No hero section. This is an app screen.
- No generic three-card feature row. Board columns are functional, not marketing cards.
- Left sidebar can collapse before 1080px. Drawer drops below board on small screens.
- Below 768px, the UI becomes single-column:
  - top bar
  - filters as disclosure
  - horizontally scrollable columns only if each column has a clear snap target
  - task editor as full-width panel or modal sheet

## 6. Motion & Interaction

- Motion is restrained. Use it only to communicate feedback or state transition.
- Allowed:
  - button press: `translateY(1px)`
  - card selection: instant border and ring change
  - drawer open: 120ms opacity and x transform
  - skeleton shimmer only while loading
- Banned:
  - perpetual decorative loops
  - parallax
  - animated background gradients
  - custom cursors
  - drag physics in v1 unless persistence and conflict behavior are specified

Performance:

- Animate only transform and opacity.
- Respect `prefers-reduced-motion`.
- No scroll listeners for visual effects.

## 7. Data and Write Model

The UI must not invent a separate task database in v1.

Read sources:

- `.ai/TASK.md` for visible active task state
- `.ai/state/active-task.json` for active machine state
- `.ai/state/file-claims.json` for claimed files
- `.ai/state/handoffs.jsonl` for handoff activity
- `.ai/tasks/*.md` for task records
- `.ai/tasks/archive/*.json` for finished task summaries

Write rules:

- Prefer command-backed writes through `scripts/agent-ops-tool.py`.
- UI actions map to explicit Agent Ops commands:
  - New task: `start`
  - Claim files: `claim`
  - Delegate: `delegate`
  - Finish or park: `finish`
  - Health check: `check`
- If an edit cannot be represented by an existing command, add a new command before the UI writes the file directly.
- Direct file edits are allowed only for generated task markdown fields that have no command yet, and only after conflict checks.

## 8. Kanban States

- **Backlog:** task markdown exists but no active state owns it.
- **Active:** `.ai/state/active-task.json` exists with status `active`.
- **Parked:** archive JSON or task record has status `parked`.
- **Done:** archive JSON has status `done`.
- **Killed:** hidden by default, visible through filter.
- **Stale:** active task older than the configured threshold, shown as a warning treatment.

V1 should not imply concurrent active work. Agent Ops still has exactly one
active owner. The board can show many records, but only one task may be active.

## 9. Anti-Patterns (Banned)

- No emojis.
- No Inter.
- No serif fonts.
- No pure black.
- No neon or outer glow shadows.
- No oversaturated accents.
- No gradient text.
- No custom mouse cursors.
- No overlapping elements.
- No fake dashboards made from decorative rectangles.
- No decorative status dots unless they encode real state.
- No generic placeholder names such as John Doe, Acme, Nexus, or SmartFlow.
- No fake round numbers such as 99.99 percent or 50 percent.
- No AI copywriting cliches such as Elevate, Seamless, Unleash, or Next-Gen.
- No scroll prompts.
- No broken external image links.
- No drag-and-drop in v1 unless command-backed persistence, conflict handling, and keyboard alternatives are designed.

## 10. Stitch Prompting Notes

When prompting Stitch, describe the screen as:

> A dense local developer workbench for Agent Ops tasks. It has a restrained
> repo-native feel, with a left filter sidebar, central kanban columns, and a
> right task editor drawer. Use a soft off-white workbench canvas, white edit
> surfaces, muted green as the only accent, compact bordered task cards,
> monospace metadata, and clear command-backed action affordances. Avoid
> decorative dashboard tropes, glows, gradients, fake charts, and marketing
> hero composition.

Stitch should generate screens for:

1. Board with one active task and several archived records.
2. Empty repo with no tasks.
3. Active task edit drawer with claims and verification.
4. Failed write state showing command error details.
5. Mobile single-column board and editor sheet.
