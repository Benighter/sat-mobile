// Simple offline unit test for selectUserByMode logic (no Firestore)
// Inline copy of selectUserByMode to avoid ESM path issues in simple test context
function selectUserByMode(candidates, opts = {}) {
  if (!candidates.length) return null;
  const { inviterIsMinistry } = opts;
  const unique = [...new Set(candidates)];
  if (unique.length === 1) return unique[0];
  const preferred = unique.filter(u => !!u.isMinistryAccount === !!inviterIsMinistry);
  if (preferred.length === 1) return preferred[0];
  if (preferred.length > 1) return preferred[0];
  if (inviterIsMinistry) {
    const ministry = unique.filter(u => u.isMinistryAccount === true);
    if (ministry.length) return ministry[0];
  } else {
    const normal = unique.filter(u => u.isMinistryAccount !== true);
    if (normal.length) return normal[0];
  }
  return unique[0];
}

function run() {
  console.log('Running duplicate selection logic test...');
  const normal = { id: 'u1', isMinistryAccount: false, role: 'admin', isActive: true };
  const ministry = { id: 'u2', isMinistryAccount: true, role: 'admin', isActive: true };

  const both = [normal, ministry];

  const pickedForNormal = selectUserByMode(both, { inviterIsMinistry: false });
  const pickedForMinistry = selectUserByMode(both, { inviterIsMinistry: true });
  console.log('Picked (normal inviter):', pickedForNormal.id);
  console.log('Picked (ministry inviter):', pickedForMinistry.id);

  if (pickedForNormal.id !== 'u1') throw new Error('Expected normal account for normal inviter');
  if (pickedForMinistry.id !== 'u2') throw new Error('Expected ministry account for ministry inviter');
  console.log('All assertions passed.');
}

run();
