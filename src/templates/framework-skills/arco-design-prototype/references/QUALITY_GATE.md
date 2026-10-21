# Quality Gate

The agent should perform this pass before declaring the prototype finished.

## A. Product clarity
- [ ] A viewer can identify what the product/page is for within 5 seconds.
- [ ] There is one obvious primary action.
- [ ] Labels and data are domain-realistic, not placeholder filler.
- [ ] No section exists only to “show another component”.

## B. Visual hierarchy
- [ ] Title, section headings, body text, metadata, and muted text are visibly distinct.
- [ ] Spacing follows a small repeatable scale.
- [ ] Surfaces do not all have the same emphasis.
- [ ] Accent color is reserved for meaningful focus/status/action.
- [ ] Icons use one consistent family/style.

## C. Interaction
- [ ] Primary action works with local state or a simulated result.
- [ ] Filters/tabs/segments visibly switch state.
- [ ] Overlays close correctly.
- [ ] Form submission shows feedback.
- [ ] No important control is visually clickable but inert.

## D. Responsive/device fit
- [ ] Desktop has no accidental horizontal scroll at 1280px.
- [ ] Mobile works at 360px and 390px widths.
- [ ] Mobile bottom actions do not collide with safe areas.
- [ ] No desktop-only hover interaction blocks mobile use.

## E. Technical finish
- [ ] Imports match the installed package/version.
- [ ] No missing CSS/theme provider/global setup.
- [ ] Build command succeeds.
- [ ] No obvious React/Vue key warnings or uncaught runtime errors.
- [ ] No dead placeholder files, unfinished sections, or unused major dependencies remain.
