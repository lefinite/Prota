import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExecutionSkill } from '../server/pi/skill-adapter.mjs';

test('legacy PRD execution routes select the installed canonical Skill without duplicating its body', () => {
    const skill = { id: 'generate-business-prd', label: '业务 PRD', enabled: true, body: 'Complete current Skill content',
        allowedTools: ['Read','Write','Bash'], skillPath: '/installed/skills/generate-prd/SKILL.md' };
    const registry = new Map([[skill.id, skill]]);
    for (const id of [skill.id, 'generate-product-doc', 'generate-ai-ready-prd', '业务 PRD']) {
        assert.equal(resolveExecutionSkill(registry, id), skill);
    }
    assert.equal(resolveExecutionSkill(registry, 'unknown'), null);
});

test('disabled Skills stay disabled; registry updates apply to the next lookup', () => {
    const canonical = { id: 'generate-business-prd', enabled: false };
    const registry = new Map([[canonical.id, canonical]]);
    assert.equal(resolveExecutionSkill(registry, 'generate-ai-ready-prd'), null);
    canonical.enabled = true;
    assert.equal(resolveExecutionSkill(registry, 'generate-ai-ready-prd'), canonical);
    const original = { id: 'generate-ai-ready-prd', enabled: false };
    registry.set(original.id, original);
    assert.equal(resolveExecutionSkill(registry, original.id), null);
    original.enabled = true;
    assert.equal(resolveExecutionSkill(registry, original.id), original);
    registry.delete(original.id);
    assert.equal(resolveExecutionSkill(registry, original.id), canonical);
    registry.clear();
    assert.equal(resolveExecutionSkill(registry, original.id), null);
});
