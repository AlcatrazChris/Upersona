import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewConfig = readFileSync(new URL('../src/lib/viewConfig.ts', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../src/components/views/DatasetSettingsPanel.tsx', import.meta.url), 'utf8');

assert.match(viewConfig, /statusVariables\?:\s+StatusVariable\[\]/);
assert.match(viewConfig, /activeStatusVariableId\?: string/);
assert.match(settings, /function addVariable\(\)/);
assert.match(settings, /function removeVariable\(id: string\)/);
assert.match(settings, /statusFieldKey: selected\?\.fieldKey \?\? ''/);
assert.match(settings, /statusGroups: selected\?\.groups \?\? \[\]/);
console.log('editable status variables check passed');
