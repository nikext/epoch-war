import { AGES } from '../../src/sim/data/ages';
import { CLASS_INFO } from '../../src/sim/combat';
for (const a of AGES) {
  const units = a.units.map((u) => `${u.name} (${CLASS_INFO[u.cls].label.toLowerCase()}${u.layer === 'air' ? ', air' : ''}, ${u.cost}g${u.unlockCost ? `, unlock ${u.unlockCost}g` : ''})`).join(' · ');
  const turrets = a.turrets.map((t) => `${t.name} ${t.cost}g`).join(' · ');
  console.log(`| ${a.index + 1}. ${a.name} | ${units} | ${turrets} | ${a.special.name} | ${a.xpToNext ?? '—'} | ${a.baseHp} | ${a.popCap} |`);
}
