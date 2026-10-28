// The product registry remains authoritative. This only preserves execution
// names used by older Portal/HTTP clients after the existing PRD consolidation.
const legacyExecutionIds = new Map([
    ['generate-product-doc', 'generate-business-prd'],
    ['generate-ai-ready-prd', 'generate-business-prd']
]);

export function resolveExecutionSkill(registry, requested) {
    const raw = String(requested || '').trim();
    if (!raw) return null;
    const skills = [...registry.values()];
    const lowered = raw.toLowerCase();
    const direct = skills.find(skill => skill.id === raw
        || String(skill.label || '').toLowerCase() === lowered
        || (skill.aliases || []).some(alias => String(alias).trim().toLowerCase() === lowered));
    // An explicitly disabled old skill must not be replaced by an enabled alias.
    if (direct) return direct.enabled === false ? null : direct;
    const canonical = legacyExecutionIds.get(lowered);
    if (!canonical) return null;
    return skills.find(skill => skill.id === canonical && skill.enabled !== false) || null;
}
