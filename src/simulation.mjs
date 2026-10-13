/** @typedef {{id:string,name:string,type:string,index?:number,x:number,z:number,radius:number}} Entity */
/** @typedef {{version:number,position:{x:number,z:number},shards:boolean[],bellSequence:number[],waterSequence:number[],mirrors:number[],memories:string[],moths:string[],finished:boolean,keeperMet:boolean,playTime:number}} GameState */
export const SAVE_KEY='lumen-garden-v1';
export const locations={bells:{x:-14,z:-6},mirrors:{x:14,z:-6},well:{x:-12,z:10},gate:{x:0,z:-17}};
/** @type {Entity[]} */
export const entities=[
  {id:'keeper',name:'정원지기 이오',type:'keeper',x:-2,z:15,radius:2.6},
  {id:'bell-plaque',name:'바람의 악보',type:'lore',x:-14,z:-2.5,radius:2.3},
  ...[-16,-14,-12].map((x,i)=>({id:`bell-${i}`,name:['낮은 종 · 달','가운데 종 · 꽃','높은 종 · 별'][i],type:'bell',index:i,x,z:-6,radius:2})),
  {id:'mirror-plaque',name:'빛의 나침반',type:'lore',x:14,z:-1,radius:2.3},
  ...[[12,-5],[16,-5],[14,-9]].map(([x,z],i)=>({id:`mirror-${i}`,name:`별빛 거울 ${i+1}`,type:'mirror',index:i,x,z,radius:2.2})),
  {id:'well-plaque',name:'우물의 속삭임',type:'lore',x:-12,z:6.7,radius:2.3},
  ...[[-14,10],[-12,12],[-10,10]].map(([x,z],i)=>({id:`water-${i}`,name:['달의 기억','꽃의 기억','별의 기억'][i],type:'water',index:i,x,z,radius:2})),
  {id:'gate',name:'달의 문',type:'gate',x:0,z:-17,radius:3.4},
  {id:'letter',name:'떠나지 못한 편지',type:'lore',x:9,z:12,radius:2.2},
  {id:'tree-memory',name:'은빛 나무의 기억',type:'lore',x:-18,z:-13,radius:2.7},
  {id:'ruin-memory',name:'천문학자의 마지막 밤',type:'lore',x:8,z:-15,radius:2.5}
];
export const lore={
  'bell-plaque':{title:'바람의 악보',body:'“꽃이 피고, 달이 떠오르고, 마침내 별이 잠을 깬다.”\n\n세 종 아래에 새겨진 표식을 살펴보자. 꽃 → 달 → 별. 틀린 음이 울리면 바람은 처음으로 돌아간다.'},
  'mirror-plaque':{title:'빛의 나침반',body:'“서쪽 거울은 저녁을, 동쪽 거울은 바람을, 북쪽 거울은 자정을 비춘다.”\n\n거울을 돌려 서쪽 거울은 남쪽(S), 동쪽 거울은 동쪽(E), 북쪽 거울은 서쪽(W)을 향하게 하자. 알맞은 방향에서는 빛줄기가 연결된다.'},
  'well-plaque':{title:'우물의 속삭임',body:'“별은 달에 떨어지고, 달은 꽃에 스민다.”\n\n우물 주변의 기억석을 별 → 달 → 꽃 순서로 깨워 보자. 물은 오래된 순서를 기억한다.'},
  letter:{title:'떠나지 못한 편지',body:'친애하는 이오에게.\n\n내일은 돌아갈게. 정원의 불을 꺼도 괜찮아. 별은 우리가 보지 않아도 그 자리에 있으니까.\n\n편지는 끝내 보내지지 않았다. 등불 아래에는 아주 작은 꽃이 자라고 있다.'},
  'tree-memory':{title:'은빛 나무의 기억',body:'이 나무는 수백 번의 봄을 보았다. 여행자가 오면 가지를 낮추고, 누군가 떠나면 나뭇잎을 한 장 내어 주었다.\n\n나무껍질의 마지막 이름은 “이오”. 정원지기는 자신의 이름을 잊었어도 약속은 기억하고 있었다.'},
  'ruin-memory':{title:'천문학자의 마지막 밤',body:'세 개의 빛은 서로 다른 기억이다. 바람이 간직한 노래, 거울에 남은 얼굴, 물에 잠긴 약속.\n\n다시 모이면 문이 열릴 것이다. 그 너머에 있는 것은 먼 나라가 아니라, 또 한 번의 봄이다.'}
};
export const moths=[[-18,6],[9,17],[-20,-10],[18,4],[8,-18],[-5,-11]].map(([x,z],i)=>({id:`moth-${i}`,x,z}));
export function terrainHeight(x,z){return .28+Math.sin(x*.19)*Math.cos(z*.17)*.22+Math.sin(z*.3+x*.12)*.1;}
export function riverX(z){return 2.5*Math.sin(z*.17)+1.7;}
export const bridgeZ=[12,-9];
export function isRiver(x,z){return Math.abs(x-riverX(z))<1.35 && Math.abs(z)<23 && !bridgeZ.some(b=>Math.abs(z-b)<1.6);}
/** @returns {GameState} */
export function freshState(){return {version:1,position:{x:0,z:19},shards:[false,false,false],bellSequence:[],waterSequence:[],mirrors:[0,2,1],memories:[],moths:[],finished:false,keeperMet:false,playTime:0};}
export function hydrate(raw){
  const state=freshState();
  if(!raw||raw.version!==1)return state;
  if(raw.position&&Number.isFinite(raw.position.x)&&Number.isFinite(raw.position.z)&&Math.hypot(raw.position.x,raw.position.z)<27&&!isRiver(raw.position.x,raw.position.z))state.position=raw.position;
  if(Array.isArray(raw.shards)&&raw.shards.length===3)state.shards=raw.shards.map(Boolean);
  if(Array.isArray(raw.mirrors)&&raw.mirrors.length===3&&raw.mirrors.every(x=>Number.isInteger(x)&&x>=0&&x<4))state.mirrors=raw.mirrors;
  state.memories=Array.isArray(raw.memories)?[...new Set(raw.memories.filter(x=>x in lore))]:[];
  state.moths=Array.isArray(raw.moths)?[...new Set(raw.moths.filter(x=>moths.some(m=>m.id===x)))]:[];
  state.finished=!!raw.finished&&state.shards.every(Boolean);state.keeperMet=!!raw.keeperMet;
  state.playTime=Number.isFinite(raw.playTime)?Math.max(0,raw.playTime):0;
  return state;
}
function advance(sequence,index,target){
  sequence.push(index);
  if(sequence.some((v,i)=>target[i]!==v)){sequence.length=0;return 'wrong';}
  if(sequence.length===target.length){sequence.length=0;return 'solved';}
  return 'progress';
}
export function interact(state,entity){
  if(!entity)return {kind:'none'};
  if(entity.type==='keeper'){state.keeperMet=true;return {kind:'dialog',title:'이오 · 마지막 정원지기',body:state.finished?'돌아왔구나, 봄이. 이 빛을 기억해 줘. 이제 정원은 너의 발소리를 기억할 거야.':`이 정원은 돌아오지 않은 사람을 기다리고 있어.\n\n바람의 종, 별빛 거울, 기억의 우물. 세 곳의 빛을 되찾아 북쪽 달의 문에 가져다줄래? 각 장소의 기록에 방법이 남아 있어.\n\n등불의 파동 [Q]으로 가까운 빛나비도 찾아봐. 정원에는 여섯 마리가 숨어 있단다.`};}
  if(entity.type==='lore'){if(!state.memories.includes(entity.id))state.memories.push(entity.id);return {kind:'dialog',...lore[entity.id]};}
  if(entity.type==='bell'||entity.type==='water'){
    const k=entity.type==='bell'?0:2;if(state.shards[k])return {kind:'already',text:'이곳의 별빛은 등불 안에서 빛나고 있어요.'};
    const sequence=entity.type==='bell'?state.bellSequence:state.waterSequence;
    const status=advance(sequence,entity.index,entity.type==='bell'?[1,0,2]:[2,0,1]);
    if(status==='solved'){state.shards[k]=true;return {kind:'shard',index:k,text:k===0?'바람의 노래를 되찾았습니다':'물에 잠긴 약속을 되찾았습니다'};}
    return {kind:status,text:status==='wrong'?'기억이 흩어졌습니다. 순서를 다시 살펴보세요.':`기억이 이어집니다 · ${sequence.length} / 3`,note:entity.index};
  }
  if(entity.type==='mirror'){
    if(state.shards[1])return {kind:'already',text:'별빛이 세 거울을 잇고 있습니다.'};
    state.mirrors[entity.index]=(state.mirrors[entity.index]+1)%4;
    if(state.mirrors.every((v,i)=>v===[2,1,3][i])){state.shards[1]=true;return {kind:'shard',index:1,text:'거울에 남은 별빛을 되찾았습니다'};}
    return {kind:'rotate',text:`거울이 ${['북쪽 N','동쪽 E','남쪽 S','서쪽 W'][state.mirrors[entity.index]]}을 향합니다`};
  }
  if(entity.type==='gate'){
    if(state.shards.every(Boolean)){state.finished=true;return {kind:'ending'};}
    return {kind:'dialog',title:'잠들어 있는 달의 문',body:`석문에 세 개의 빈 별자리가 보인다.\n\n되찾은 별빛 ${state.shards.filter(Boolean).length} / 3\n\n바람의 종, 별빛 거울, 기억의 우물에서 빛을 모으자. [M]을 누르면 정원 지도를 펼칠 수 있다.`};
  }
  return {kind:'none'};
}
export function nearestEntity(state){return entities.filter(e=>Math.hypot(e.x-state.position.x,e.z-state.position.z)<e.radius).sort((a,b)=>Math.hypot(a.x-state.position.x,a.z-state.position.z)-Math.hypot(b.x-state.position.x,b.z-state.position.z))[0];}
export function move(state,dx,dz,colliders){
  let {x,z}=state.position;
  for(const [mx,mz] of [[dx,0],[0,dz]]){
    const nx=x+mx,nz=z+mz;
    if(Math.hypot(nx*.97,nz)<23.7&&!isRiver(nx,nz)&&!colliders.some(c=>Math.hypot(nx-c.x,nz-c.z)<c.r+.27)){x=nx;z=nz;}
  }
  state.position={x,z};return Math.hypot(dx,dz)>0;
}
