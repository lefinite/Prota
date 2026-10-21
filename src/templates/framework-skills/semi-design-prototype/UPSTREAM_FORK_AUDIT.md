# Semi Upstream Fork Audit

This file exists specifically to make the derivation auditable.

## Official base preserved

The following files under `upstream/semi-design-guide/` are official Semi Design upstream snapshots, not rewritten prototype notes:

- `SKILL.md`
- `WORKFLOWS.md`
- `BEST_PRACTICES.md`

## Official behavior retained

- Semi MCP is the preferred lookup mechanism when available.
- `get_semi_document` is used for component/document discovery and API lookup.
- `get_component_file_list` is used when component structure/source context is needed.
- `get_file_code` and `get_function_code` are escalation paths for implementation-level uncertainty.
- Version-sensitive questions should be queried rather than answered from stale memory.
- Best-practice guidance around imports, themes, React compatibility, and component extension remains upstream-owned.

## Prototype-only additions

The pack adds: multi-page planning, product information architecture, realistic local mock data, working local interactions, visual-completion rules, and a prototype-oriented quality gate. Those additions do not replace the official MCP workflow.
