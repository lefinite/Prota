---
name: generate-flow-diagram
description: Analyze the current prototype, product requirements, annotations, and source behavior, then autonomously choose and generate the most suitable editable draw.io diagram. Use when the user asks to generate a flowchart, sequence diagram, state diagram, architecture diagram, logic map, process visualization, or a diagram for the current demo, including requests that intentionally delegate diagram-type selection to AI.
---

# Generate Flow Diagram

Generate one useful diagram asset for the active page and version. Choose the diagram type, scope, abstraction level, and layout without asking the user unless the target page itself cannot be identified.

## Workflow

1. Resolve `project_id`, `page_id`, and `version` from the request. If omitted, read `data/projects.json` and use the active page/version.
2. Read the current version's `index.html`, `app.js`, `styles.css`, and `annotations.json` when present. Read the most relevant page-level PRD under `src/pages/{project_id}/{page_id}/docs/` when present.
3. Identify the logic that benefits most from visualization. Prefer one coherent diagram over a broad but shallow inventory.
4. Choose the representation autonomously:
   - Use a flow diagram for user journeys, business processes, branches, and exception paths.
   - Use a sequence diagram for time-ordered interactions across people, clients, services, or modules.
   - Use a state diagram for lifecycle rules and state transitions.
   - Use an architecture diagram for module boundaries, data movement, and dependencies.
   - Use multiple pages in one `.drawio` file only when two views are both necessary to understand the logic.
5. Create a concise JSON specification following [references/spec.md](references/spec.md). Use stable, semantic node IDs and Chinese labels unless the product language requires otherwise. Before generation, compress the diagram into relationships rather than prose:
   - Keep one visible phrase per node. Do not put a title, subtitle, explanation, numbered list, colon-separated sentence, or line break in one box.
   - Use 2-8 Chinese characters when possible and never exceed 12 Chinese-width characters. Use a verb-object phrase for an action/state and a short question for a decision.
   - Keep edge labels to a condition word such as `是`、`否`、`成功`、`失败`; omit a label when direction is already clear.
   - Put all explanation back in the PRD. `description` is optional metadata and is never visible in the box.
   - Prefer 5-9 nodes on one page. Simplify repeated steps or split into a second page when the graph would exceed 12 nodes or place more than 4 nodes in one rank.
   - Keep one page to 6 ranks or fewer. For a long single chain, merge low-value steps, switch to horizontal only when it remains readable, or split the diagram.
   - Use automatic layout by default. Only set `x` and `y` when a deliberate grid is necessary and every node has enough clearance.
   - List nodes in intended reading order. Put the start first, branches next, shared result after the branches, and loop targets earlier than their return edges; the layout engine uses this order to keep return lines outside the forward flow.
6. Run the repository tool:

```bash
node tools/drawio/generate.mjs \
  --input /absolute/path/to/spec.json \
  --project {project_id} \
  --page {page_id} \
  --version {version}
```

7. Validate that the generated file exists at `src/pages/{project_id}/{page_id}/docs/diagrams/{version}.drawio`, contains `<mxfile`, and references only existing node IDs. Also inspect the generated XML or rendered preview and regenerate if any node contains a second text line, any label is sentence-like, nodes overlap, a connector crosses a node, connectors stack on the same path, or the whole graph must be heavily reduced to fit.
8. Append the generated diagram to the end of the PRD document currently displayed in Prota:

```bash
node tools/drawio/embed-in-prd.mjs \
  --project {project_id} \
  --page {page_id} \
  --version {version} \
  --diagram /absolute/path/to/src/pages/{project_id}/{page_id}/docs/diagrams/{version}.drawio \
  --title "{concise_diagram_title}"
```

The tool reads `data/active-prd-context.json`, which Prota updates whenever the user switches PRD files. If no matching active context exists, it falls back to `product-doc.md`, then the newest page-level Markdown document. Treat successful embedding as part of generation success.
9. Delete the temporary JSON specification after successful generation and embedding.

## Quality bar

- Show decisions, ownership boundaries, loops, failure paths, and state changes when they materially affect behavior.
- One box expresses one thing with one visual text style. Never render a second-level caption inside a node.
- Keep labels short enough to scan: preferably 2-8 Chinese characters, hard maximum 12 Chinese-width characters. Put supporting detail in the PRD; use `description` only as non-visible source metadata when necessary.
- Use a single main reading direction. For flow/state diagrams, default to top-to-bottom; place sibling branches on the same rank and merge them before continuing the main path.
- Route forward connectors through the nearest top/bottom ports. Route return, retry, and loop connectors around the outside of the graph. Avoid diagonal connectors, line crossings, connectors through nodes, and several connectors sharing an indistinguishable segment.
- Keep at least 80 px horizontal clearance and 64 px vertical clearance between node bounds. Do not shrink node text or compress the canvas to rescue an oversized diagram; simplify or split the diagram.
- Use decision diamonds only for real conditions. Label outgoing decision edges with short mutually exclusive outcomes; do not repeat the full condition on the edge.
- Avoid decorative nodes and generic headings that do not carry logic.
- Keep the main reading direction consistent.
- Do not modify prototype source code. The generated `.drawio` file and the active PRD's appended `:::drawio` directive are the only expected content changes.
- Do not ask the user to choose a diagram type; that decision belongs to the AI.
