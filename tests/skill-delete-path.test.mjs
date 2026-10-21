import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../server/agent-server.mjs', import.meta.url), 'utf8');

test('Skill 删除使用自动发现的实际目录，不假定 ID 与文件夹同名', () => {
    const deleteFunction = serverSource.slice(
        serverSource.indexOf('async function deleteProjectSkill'),
        serverSource.indexOf('async function readTemplateState')
    );

    assert.match(deleteFunction, /await refreshProjectSkills\(\{ force: true \}\)/);
    assert.match(deleteFunction, /item\.id === normalizedSkillId[\s\S]*item\.autoDiscovered[\s\S]*item\.skillPath/);
    assert.match(deleteFunction, /const targetDir = path\.dirname\(skill\.skillPath\)/);
    assert.doesNotMatch(deleteFunction, /path\.join\(PROJECT_SKILLS_DIR, normalizedSkillId\)/);
});
