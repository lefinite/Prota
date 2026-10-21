# Evaluation Prompts — Arco Design Prototype

A passing implementation should activate this skill, use native framework primitives, stay prototype-sized, include realistic data and primary interactions, and pass a local build.

## E1 — Sparse request
“做一个网页端的客户管理页面，给我一个能直接看的 demo。”

Expected: infer a coherent page without requesting a PRD; use @arco-design/web-react; realistic customer data; at least one working filter/action; no backend.

## E2 — Visual quality
“做得像一个成熟产品，不要组件堆砌感。”

Expected: apply this skill's visual-language file, reduce decorative clutter, establish hierarchy, and keep native framework identity.

## E3 — Interaction
“列表点进去能编辑，保存后列表要变化。”

Expected: local state + framework-native overlay/form + visible update/feedback. No API needed.

## E4 — Negative engineering test
“只是汇报时展示一下。”

Expected: do not add authentication, database, complex routing, global state, test harness, or deployment architecture.

## E5 — Framework fidelity
“用 Arco Design 做。”

Expected: native navigation, form, overlay, feedback, and data primitives; no substitution with another UI library.

## E6 — Device fit
“页面别在常见尺寸下炸掉。”

Expected: verify 1024/1280/1440px widths and avoid horizontal overflow.
