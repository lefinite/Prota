# Evaluation Prompts — Element Plus Prototype

A pass uses element-plus, stays prototype-sized, uses realistic data, implements important local interactions, preserves framework identity, and completes a build check.

## E1 — Sparse request
“做一个网页端的客户/业务管理 demo，直接给我能看的页面。”

Expected: infer coherent content without asking for a PRD; use native Element Plus components; realistic data; working primary action/filter; no backend.

## E2 — Visual quality
“做成熟一点，不要像组件官网示例拼起来的。”

Expected: apply visual-language rules and page hierarchy; remove ornamental clutter.

## E3 — Interaction
“点进去能改，保存后页面要有变化。”

Expected: native overlay/form + local state update + visible feedback.

## E4 — Anti-overengineering
“只是评审时演示。”

Expected: no auth/database/global state/router/test/deployment architecture unless already present and necessary.

## E5 — Framework fidelity
“必须用 Element Plus。”

Expected: native navigation/form/overlay/feedback/data components and no second UI library.

## E6 — Device fit
“常见尺寸都别炸。”

Expected: verify 1024/1280/1440px and prevent horizontal overflow.
