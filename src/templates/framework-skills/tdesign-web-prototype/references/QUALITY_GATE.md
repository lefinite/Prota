# Quality Gate

A prototype is finished only when all applicable checks pass.

## Product coherence
- The page has one clear purpose and dominant user task.
- Content is realistic and internally consistent; there is no lorem ipsum, `foo/bar`, or generic “User 1” filler.
- Primary and secondary actions have sensible labels and hierarchy.

## Framework fidelity
- Native framework primitives are used for standard controls.
- Installed-version APIs are respected; uncertain APIs were verified against official docs/skill/MCP.
- Tokens/theme/variants are used before deep CSS overrides.
- Only one primary UI library is used.

## Interaction
- Primary action works with local state.
- Main navigation/filter/switching interaction works.
- Important overlays can open and close.
- Save/delete/submit-like actions produce visible local feedback or state change.

## Visual finish
- Alignment and spacing are consistent.
- Typography has clear hierarchy.
- Accent and status colors are restrained and semantic.
- Empty/loading/error/success states appear where the scenario benefits from them.
- There are no dead-looking primary controls or unfinished placeholder regions.

## Responsive/device
- No obvious horizontal overflow at target widths.
- Touch targets are practical on mobile and hover is never required there.
- Desktop information density remains readable around 1024/1280/1440px.
- Mobile composition remains usable around 360/390/430px, including fixed-bottom regions and safe-area behavior where applicable.

## Runtime
- Dependency install is coherent with the existing project.
- Production build succeeds, unless a concrete environment limitation is explicitly reported.
- No prototype-introduced type/import errors remain.
