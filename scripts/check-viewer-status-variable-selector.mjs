import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = readFileSync(new URL('../src/components/shared/StatusFilterGroups.tsx', import.meta.url), 'utf8');
const views = ['PersonaView', 'RegionalView', 'InsightView', 'RegionalFeatureView', 'StatusView'];

assert.match(shared, /variables\.length > 1/);
assert.match(shared, /filter\(variable => variable\.fieldKey\)/);
assert.match(shared, /name\.trim\(\) \|\|/);
assert.match(shared, /activeStatusVariableId: selected\.id/);
assert.match(shared, /statusFieldKey: selected\.fieldKey/);
assert.match(shared, /statusGroups: selected\.groups/);
for (const view of ['InsightView', 'RegionalView', 'RegionalFeatureView', 'StatusView']) {
  const source = readFileSync(new URL(`../src/components/views/${view}.tsx`, import.meta.url), 'utf8');
  assert.match(source, /statusFieldKey \?\? ''/, `${view} cache must include the selected status field`);
}
for (const view of views) {
  const source = readFileSync(new URL(`../src/components/views/${view}.tsx`, import.meta.url), 'utf8');
  assert.match(source, /datasetId=\{dataset\.id\}/, `${view} must expose status-variable selection`);
  assert.match(source, /onStatusVariableChange=/, `${view} must clear stale status selections`);
}
console.log('viewer status variable selector check passed');
