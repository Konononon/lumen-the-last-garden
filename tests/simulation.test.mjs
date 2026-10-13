import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,hydrate,entities,interact,move,isRiver,nearestEntity,moths} from '../src/simulation.mjs';
import {findPath} from '../src/navigation.mjs';
const entity=id=>entities.find(e=>e.id===id);
test('gate stays locked until all three independent puzzles are solved',()=>{
  const s=freshState();assert.equal(interact(s,entity('gate')).kind,'dialog');
  for(const i of [1,0,2])interact(s,entity(`bell-${i}`));assert.deepEqual(s.shards,[true,false,false]);
  for(const [i,turns] of [[0,2],[1,3],[2,2]])for(let t=0;t<turns;t++)interact(s,entity(`mirror-${i}`));assert.deepEqual(s.shards,[true,true,false]);
  for(const i of [2,0,1])interact(s,entity(`water-${i}`));assert.ok(s.shards.every(Boolean));assert.equal(interact(s,entity('gate')).kind,'ending');assert.ok(s.finished);
});
test('incorrect sequences reset, solved puzzles do not revoke shards',()=>{
  const s=freshState();assert.equal(interact(s,entity('bell-0')).kind,'wrong');assert.deepEqual(s.bellSequence,[]);for(const i of [1,0,2])interact(s,entity(`bell-${i}`));assert.equal(interact(s,entity('bell-0')).kind,'already');assert.ok(s.shards[0]);
});
test('lore discoveries stay unique and readable',()=>{const s=freshState();for(let i=0;i<3;i++)assert.equal(interact(s,entity('bell-plaque')).kind,'dialog');assert.deepEqual(s.memories,['bell-plaque']);});
test('restored saves validate coordinates, progression and collection IDs',()=>{
  const s=hydrate({version:1,position:{x:NaN,z:10},shards:[true,false,true],mirrors:[0,9,1],memories:['letter','letter','unknown'],moths:['moth-1','moth-1','bogus'],finished:true});assert.deepEqual(s.position,{x:0,z:19});assert.deepEqual(s.mirrors,[0,2,1]);assert.deepEqual(s.memories,['letter']);assert.deepEqual(s.moths,['moth-1']);assert.equal(s.finished,false);
});
test('save reload preserves solved progress and clears incomplete sequences',()=>{
  const s=freshState();for(const i of [1,0,2])interact(s,entity(`bell-${i}`));interact(s,entity('water-2'));s.moths.push(moths[0].id);assert.deepEqual(hydrate(JSON.parse(JSON.stringify(s))).shards,[true,false,false]);assert.deepEqual(hydrate(s).waterSequence,[]);
});
test('movement respects solid objects, river banks and map boundary',()=>{
  const s=freshState();s.position={x:0,z:0};move(s,2,0,[]);assert.equal(s.position.x,0);s.position={x:-5,z:5};move(s,1,0,[{x:-4,z:5,r:1}]);assert.equal(s.position.x,-5);s.position={x:0,z:23};move(s,0,2,[]);assert.equal(s.position.z,23);assert.equal(isRiver(1.7,0),true);assert.equal(isRiver(3.93,12),false);
});
test('navigation connects entrance to every puzzle across bridges',()=>{
  for(const p of [{x:-14,z:-6},{x:14,z:-6},{x:-12,z:12},{x:0,z:-17}]){const path=findPath({x:0,z:19},p,[]);assert.ok(path.length>0);assert.ok(path.every(p=>!isRiver(p.x,p.z)));}
});
test('interaction range gates nearby entities',()=>{const s=freshState();assert.equal(nearestEntity(s),undefined);s.position={x:-2,z:15};assert.equal(nearestEntity(s).id,'keeper');});
