/**
 * End-to-end smoke test for the core production loop.
 *
 * Guards the failure modes that previously made the game unplayable:
 *   - furnace jamming on surplus radicals (exact-set recipe matching)
 *   - pronunciation gate result never reaching GameScene (wrong event emitter),
 *     which stranded furnaces in waitingForGate and left the Codex empty
 *
 * Usage:  npm run build && npm run preview &   then   node tests/smoke.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://localhost:4173/';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const errors = [];
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const booted = await page.evaluate(() => {
  const g = window.__SUMI__;
  return g ? g.scene.scenes.map(s => s.scene.key) : null;
});
check('game boots and registers scenes', Array.isArray(booted) && booted.length >= 9,
  booted ? `${booted.length} scenes` : 'no game instance');

await page.evaluate(() => {
  localStorage.clear();
  const g = window.__SUMI__;
  g.scene.stop('MainMenuScene');
  g.scene.start('GameScene');
});
await page.waitForTimeout(1500);

const build = await page.evaluate(() => {
  const g = window.__SUMI__, s = g.scene.getScene('GameScene');
  s.inkPoints = 99999;
  const node = s.oreNodes[0], y = node.y;
  for (let x = node.x + 1; x < Math.min(node.x + 16, s.mapWidth); x++)
    for (let dy = -1; dy <= 2; dy++) {
      const ty = y + dy;
      if (ty < 0 || ty >= s.mapHeight) continue;
      if (s.tiles[ty][x] === 'obstacle') s.tiles[ty][x] = 'floor';
      if (s.occupationGrid[ty][x] === 'obstacle') s.occupationGrid[ty][x] = null;
    }
  s.placeMachine(node.x + 1, y, 'extraction_station');
  const ex = s.machines.find(m => m.type === 'extraction_station');
  if (!ex) return { err: 'extractor failed' };
  const outX = ex.x + ex.width, outY = ex.y + Math.floor(ex.height / 2);
  for (let i = 0; i < 3; i++) s.placeBelt(outX + i, outY);
  s.placeMachine(outX + 3, outY, 'composition_furnace');
  const fu = s.machines.find(m => m.type === 'composition_furnace');
  return { ok: !!fu, radical: node.radical, belts: s.belts.length,
           dirs: [...new Set(s.belts.map(b => b.direction))] };
});
check('production line builds', build.ok === true, JSON.stringify(build));
check('belt chain has consistent direction', build.dirs?.length === 1, String(build.dirs));

let gateSeen = false;
for (let i = 0; i < 30 && !gateSeen; i++) {
  await page.waitForTimeout(1000);
  gateSeen = await page.evaluate(() =>
    window.__SUMI__.scene.getScene('PronunciationGateScene')?.scene.isActive() ?? false);
}
check('pronunciation gate fires', gateSeen);

if (gateSeen) {
  const after = await page.evaluate(async () => {
    const g = window.__SUMI__, s = g.scene.getScene('GameScene');
    const gate = g.scene.getScene('PronunciationGateScene');
    const kanji = gate.kanji;
    gate.endGate(true);
    await new Promise(r => setTimeout(r, 600));
    const fu = s.machines.find(m => m.type === 'composition_furnace');
    return { kanji, waiting: s.productionSystem.getMachineState(fu.id).waitingForGate,
             resumed: s.scene.isActive() };
  });
  const codex = await page.evaluate(() =>
    Object.keys(JSON.parse(localStorage.getItem('sumi_kojo_save') || '{}').codexEntries || {}));
  check('furnace released after gate', after.waiting === false);
  check('game resumes after gate', after.resumed === true);
  check('kanji lands in codex', codex.includes(after.kanji), codex.join(','));
}

// Surplus radicals must not jam the furnace, and pinning must be honoured
const pinned = await page.evaluate(() => {
  const g = window.__SUMI__, s = g.scene.getScene('GameScene');
  const fu = s.machines.find(m => m.type === 'composition_furnace');
  fu.recipe = '東';
  const st = s.productionSystem.getMachineState(fu.id);
  st.waitingForGate = false;
  st.inputRadicals = new Map([['木', 1], ['日', 1], ['山', 3]]);
  for (let i = 0; i < 200; i++)
    s.productionSystem.update(0.1, s.machines, () => undefined, () => null);
  return { events: s.productionSystem.getEvents().map(e => e.type + ':' + (e.character || '')),
           pool: [...st.inputRadicals] };
});
check('pinned recipe builds compound kanji', pinned.events.includes('gate_triggered:東'),
  pinned.events.join(' '));
check('surplus radicals survive production', JSON.stringify(pinned.pool) === '[["山",3]]',
  JSON.stringify(pinned.pool));

check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
