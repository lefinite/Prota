# Draw.io tool

This folder is the standalone diagram-generation boundary. It accepts a small graph specification and writes standard, editable `.drawio` XML without depending on the portal UI.

```bash
node tools/drawio/generate.mjs \
  --input /tmp/diagram.json \
  --project readify \
  --page reader \
  --version v11
```

The generated asset is stored at:

```text
src/pages/{project}/{page}/docs/diagrams/{version}.drawio
```
