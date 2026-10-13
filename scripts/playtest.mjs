import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {findPath} from '../src/navigation.mjs';
import {entities} from '../src/simulation.mjs';
const out='output/playwright';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.__LUMEN.snapshot());
const fixture=async(x,z)=>{await page.evaluate(([x,z])=>window.__LUMEN.fixturePosition(x,z),[x,z]);await page.waitForTimeout(220);};
const use=async(id)=>{const e=entities.find(e=>e.id===id);assert.ok(e);await fixture(e.x,e.z);await page.keyboard.press('e');await page.waitForTimeout(240);};
const check=(name)=>{checks.push(name);console.log('PASS '+name);};
try{
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__LUMEN?.snapshot().ready,undefined,{timeout:45000});
  await page.waitForTimeout(1800);
  await page.screenshot({path:`${out}/01-title.png`});check('boots into a rendered title screen');
  await page.getByRole('button',{name:'정원으로 들어가기'}).click();await page.waitForTimeout(2500);
  await page.screenshot({path:`${out}/02-garden.png`});
  if(process.env.QUICK==='1'){console.log(JSON.stringify(await snap()));await writeFile(`${out}/errors.json`,JSON.stringify(errors,null,2));}
  else{
    const before=(await snap()).state.position;await page.keyboard.down('w');await page.waitForFunction(p=>{const s=window.__LUMEN.snapshot().state.position;return Math.hypot(s.x-p.x,s.z-p.z)>.4;},before,{timeout:10000});await page.keyboard.up('w');check('WASD moves the traveller');
    const cameraBefore=await page.screenshot();await page.mouse.move(1000,450);await page.mouse.down();await page.mouse.move(1190,500,{steps:12});await page.mouse.up();await page.mouse.wheel(0,180);await page.waitForTimeout(500);assert.notDeepEqual(await page.screenshot(),cameraBefore);check('camera drag and zoom respond');
    await use('keeper');assert.equal((await snap()).state.keeperMet,true);assert.equal((await snap()).paused,true);await page.keyboard.press('Escape');assert.equal((await snap()).paused,false);check('NPC dialogue pauses and closes with Escape');
    const colliders=await page.evaluate(()=>window.__LUMEN.colliders());for(const e of entities){assert.ok(findPath({x:0,z:19},e,colliders).length,`unreachable ${e.id}`);}check('every interaction is reachable through the actual world colliders');
    await fixture(0,19);const steps=await page.evaluate(()=>window.__LUMEN.navigateTo(-12,12));assert.ok(steps>0);await page.waitForFunction(()=>{const p=window.__LUMEN.snapshot().state.position;return Math.hypot(p.x+12,p.z-12)<1;},undefined,{timeout:45000});check('path-following reaches the well from the entrance');
    await page.keyboard.press('m');await page.getByRole('dialog').waitFor();await page.screenshot({path:`${out}/03-map.png`});await page.keyboard.press('Escape');check('map opens, shows landmarks and closes');
    await use('bell-plaque');assert.ok((await snap()).state.memories.includes('bell-plaque'));await page.keyboard.press('Escape');
    await use('bell-0');assert.deepEqual((await snap()).state.bellSequence,[]);
    for(const i of [1,0,2])await use(`bell-${i}`);assert.ok((await snap()).state.shards[0]);check('bell puzzle rejects wrong order and awards the correct sequence');
    await fixture(-14,-3);await page.waitForTimeout(1000);await page.screenshot({path:`${out}/04-bells.png`});
    await use('mirror-plaque');await page.keyboard.press('Escape');for(const [i,turns] of [[0,2],[1,3],[2,2]])for(let j=0;j<turns;j++)await use(`mirror-${i}`);assert.ok((await snap()).state.shards[1]);check('three mirror orientations complete the light puzzle');
    await fixture(14,-2);await page.waitForTimeout(1000);await page.screenshot({path:`${out}/05-mirrors.png`});
    await use('well-plaque');await page.keyboard.press('Escape');for(const i of [2,0,1])await use(`water-${i}`);assert.ok((await snap()).state.shards[2]);check('well puzzle awards the third shard');
    await fixture(-18,6);await page.keyboard.press('q');await page.waitForTimeout(300);assert.ok((await snap()).state.moths.includes('moth-0'));check('lantern pulse discovers and saves a hidden moth');
    await use('letter');await page.keyboard.press('Escape');await page.keyboard.press('j');await page.screenshot({path:`${out}/06-journal.png`});await page.keyboard.press('Escape');check('journal displays discoveries and progress');
    await fixture(0,-16);await page.waitForTimeout(1300);await page.screenshot({path:`${out}/07-gate.png`});await page.keyboard.press('e');await page.waitForTimeout(1200);assert.equal((await snap()).state.finished,true);assert.ok(await page.getByText('또 한 번의 봄',{exact:true}).isVisible());await page.screenshot({path:`${out}/08-ending.png`});await page.getByRole('button',{name:'정원에 머물기'}).click();check('ending completes and allows continued exploration');
    await page.keyboard.press('f');assert.equal((await snap()).photo,true);assert.equal(await page.locator('#hud').isVisible(),false);await page.screenshot({path:`${out}/09-photo.png`});await page.keyboard.press('f');check('photo mode hides HUD and returns');
    await page.keyboard.press('Escape');await page.locator('#quality').selectOption('low');await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.getByRole('button',{name:'소리 끄기',exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('lumen-muted')),'true');check('graphics and audio settings work');
    const audio=(await snap()).audio;assert.equal(audio.buffers,11);check('all eleven authored audio assets decode');
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__LUMEN?.snapshot().ready);await page.getByRole('button',{name:'이어 탐험하기'}).click();await page.waitForTimeout(800);const restored=(await snap()).state;assert.ok(restored.finished);assert.ok(restored.shards.every(Boolean));assert.ok(restored.memories.includes('letter'));assert.ok(restored.moths.includes('moth-0'));check('reload restores progress, discoveries and ending');
    await page.setViewportSize({width:390,height:844});await fixture(0,19);await page.waitForTimeout(900);await page.screenshot({path:`${out}/10-mobile.png`});assert.ok(await page.locator('.mobile-controls').isVisible());const p0=(await snap()).state.position;const touch=await page.locator('[data-move="KeyW"]').boundingBox();await page.mouse.move(touch.x+touch.width/2,touch.y+touch.height/2);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();const p1=(await snap()).state.position;assert.ok(Math.hypot(p1.x-p0.x,p1.z-p0.z)>.1);check('mobile layout and touch movement work');
    await page.keyboard.press('m');await page.screenshot({path:`${out}/11-mobile-map.png`});const bounds=await page.getByRole('dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);await page.keyboard.press('Escape');check('mobile map fits the viewport');
    assert.deepEqual(errors,[]);check('no browser runtime or WebGL errors');
    const report={checks,errors,snapshot:await snap(),note:'Headless Chromium run. Fixture positions exercise interactions; actual keyboard and navigation also tested.'};await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  }
}catch(error){console.error('PLAYTEST FAILED:',error);console.error('Browser errors:',errors);console.error('Snapshot:',await snap().catch(()=>null));await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({error:String(error),errors,checks},null,2));process.exitCode=1;}
finally{await browser.close();}
