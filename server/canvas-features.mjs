// Shipped features default on; experimental features retain workspace opt-in.
export const CANVAS_FEATURE_DEFAULTS = Object.freeze({
  canvasSchemaV2: true,
  boardRevisions: true,
  canvasVersionMetadata: false,
  progressiveCanvasPreview: false,
  canvasVirtualization: false,
  canvasFlowLinks: false,
  canvasDomTargeting: false,
  canvasAutoLayout: false,
  canvasComponents: false,
  canvasAnnotations: false,
  canvasPortableCopy: false,
  canvasSharedRuntime: false,
});

// Explicit workspace allowlist; never infer rollout from browser query parameters.
export function resolveCanvasFeatures({ workspaceId, testWorkspaceIds = [], overrides = {} } = {}) {
  const flags = { ...CANVAS_FEATURE_DEFAULTS };
  if (typeof workspaceId !== 'string' || !workspaceId || !testWorkspaceIds.includes(workspaceId)) {
    return Object.freeze(flags);
  }
  for (const key of Object.keys(flags)) if (Object.hasOwn(overrides, key)) flags[key] = overrides[key] === true;
  return Object.freeze(flags);
}
