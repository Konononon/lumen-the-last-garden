/// <reference types="vite/client" />
import './style.css';
import * as T from 'three';
import {GardenWorld} from './world';
import {GameUI} from './ui';
import {GardenAudio} from './audio';
import {freshState,hydrate,SAVE_KEY,nearestEntity,interact,move,riverX,moths,entities,locations} from './simulation.mjs';
import {findPath} from './navigation.mjs';

const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
let raw:any=null;
try{raw=JSON.parse(localStorage.getItem(SAVE_KEY)??'null');}catch{raw=null;}
let state=hydrate(raw);
let started=false,paused=false,photo=false;
let saveTimer=0,stepTimer=0,pulseCooldown=0;
let path:{x:number;z:number}[]=[];
const keys=new Set<string>(),audio=new GardenAudio();
audio.muted=localStorage.getItem('lumen-muted')==='true';
let world:GardenWorld;
let fps=60;
const save=()=>{if(!started)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{ui.toast('이 브라우저에서는 자동 저장을 사용할 수 없습니다.');}};
const reset=()=>{state=freshState();ui.state=state;world.azimuth=.32;world.distance=15.5;world.elevation=.49;path=[];keys.clear();photo=false;world.photo=false;ui.setPhoto(false);save();ui.toast('새로운 등불이 정원에 도착했습니다.');};
const ui=new GameUI({
  start(fresh){if(!world?.ready)return;if(fresh)reset();started=true;paused=false;ui.play();void audio.start();canvas.focus();save();},
  pause(){paused=ui.modal;keys.clear();path=[];audio.setPaused(paused);},
  mute(){audio.setMuted(!audio.muted);localStorage.setItem('lumen-muted',String(audio.muted));if(!audio.muted&&started)void audio.start();return audio.muted;},
  quality(value){world.quality(value);localStorage.setItem('lumen-quality',value);},
  restart:reset,
  interact:performInteraction,
  pulse:performPulse,
  movement(key,down){if(down)keys.add(key);else keys.delete(key);},
  photo:togglePhoto
},state,!!raw);
ui.setSound(audio.muted);

function togglePhoto(){photo=!photo;world.photo=photo;ui.setPhoto(photo);keys.clear();path=[];}
function performInteraction(){
  if(!started||paused||photo)return;
  const entity=nearestEntity(state);if(!entity)return;
  const result=interact(state,entity);
  if(entity.type==='bell'||entity.type==='water')audio.play(['bell-low','bell-mid','bell-high'][entity.index!],.55);
  else audio.play('interact',.32);
  if(result.kind==='dialog')ui.showDialog(result.title!,result.body!);
  else if(result.kind==='shard'){audio.play('awaken',.55);world.emitPulse();ui.toast(`✧ ${result.text} · 별빛 ${state.shards.filter(Boolean).length}/3`,5000);}
  else if(result.kind==='ending'){audio.play('awaken',.7);world.emitPulse();save();setTimeout(()=>{ui.ending();},650);}
  else if(result.text)ui.toast(result.text);
  save();
}
function performPulse(){
  if(!started||paused||photo)return;
  if(pulseCooldown>0){ui.toast('등불이 숨을 고르고 있습니다. 잠시 후 다시 밝혀주세요.',1400);return;}
  pulseCooldown=3;world.emitPulse();audio.play('pulse',.35);
  const found=moths.filter(m=>Math.hypot(m.x-state.position.x,m.z-state.position.z)<4.5&&!state.moths.includes(m.id));
  for(const m of found)state.moths.push(m.id);
  if(found.length){ui.toast(`숨은 빛나비를 찾았습니다 · ${state.moths.length}/6`,3500);save();}
  else ui.toast('등불의 파동이 숨은 빛나비를 비춥니다.',2000);
}
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||!started||!world.ready||e.repeat)return;
  const target=e.target as HTMLElement;if(target?.tagName==='SELECT')return;
  if(e.code==='Escape'){e.preventDefault();if(photo)togglePhoto();else ui.open('pause');return;}
  if(paused)return;
  if(e.code==='KeyF'){togglePhoto();return;}
  if(e.code==='KeyJ'){ui.open('journal');return;}if(e.code==='KeyM'){ui.open('map');return;}
  if(photo)return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);path=[];}
  if(e.code==='KeyE'){e.preventDefault();performInteraction();}if(e.code==='KeyQ'){e.preventDefault();performPulse();}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();path=[];});
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();keys.clear();path=[];void audio.context?.suspend();}else audio.setPaused(paused);});
window.addEventListener('beforeunload',save);

const raycaster=new T.Raycaster();let dragging=false,pointerId=-1,previous={x:0,y:0},pointerStart={x:0,y:0},dragDistance=0;
canvas.addEventListener('pointerdown',e=>{if(!started||paused)return;dragging=true;pointerId=e.pointerId;previous={x:e.clientX,y:e.clientY};pointerStart={...previous};dragDistance=0;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging||paused)return;const dx=e.clientX-previous.x,dy=e.clientY-previous.y;dragDistance+=Math.abs(dx)+Math.abs(dy);world.azimuth-=dx*.0045;world.elevation=T.MathUtils.clamp(world.elevation+dy*.003,.32,1.15);previous={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{
  if(e.pointerId!==pointerId)return;dragging=false;if(paused||photo||dragDistance>6)return;
  const v=new T.Vector3();const closest=entities.map(entity=>{v.set(entity.x,world.player.position.y+1.2,entity.z).project(world.camera);return {entity,distance:Math.hypot((v.x*.5+.5)*innerWidth-e.clientX,(-v.y*.5+.5)*innerHeight-e.clientY)};}).sort((a,b)=>a.distance-b.distance)[0];
  if(closest&&closest.distance<45&&Math.hypot(closest.entity.x-state.position.x,closest.entity.z-state.position.z)<closest.entity.radius){performInteraction();return;}
  raycaster.setFromCamera(new T.Vector2(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1),world.camera);const hit=raycaster.intersectObject(world.terrain)[0];if(!hit)return;
  const destination=closest?.distance<38?closest.entity:{x:hit.point.x,z:hit.point.z};
  path=findPath(state.position,destination,world.colliders);if(!path.length)ui.toast('이곳까지 이어지는 길을 찾아보세요. 지도에 다리가 표시되어 있습니다.');
});
canvas.addEventListener('pointercancel',()=>{dragging=false;});
canvas.addEventListener('wheel',e=>{if(!started||paused)return;e.preventDefault();world.distance=T.MathUtils.clamp(world.distance+e.deltaY*.012,7.5,26);},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();save();paused=true;ui.toast('화면을 복구하는 중입니다. 여정은 저장되었습니다.',10000);});
canvas.addEventListener('webglcontextrestored',()=>location.reload());

let last=performance.now();
function frame(now:number){
  requestAnimationFrame(frame);const elapsed=(now-last)/1000,dt=Math.min(elapsed,.25);last=now;if(document.hidden)return;fps=T.MathUtils.damp(fps,1/Math.max(.001,elapsed),2,dt);
  let moving=false,sprinting=false;
  if(started&&!paused&&!photo){
    state.playTime+=dt;pulseCooldown=Math.max(0,pulseCooldown-dt);
    let remainingDistance=Infinity;
    let dx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),dz=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
    const len=Math.hypot(dx,dz);sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight');
    if(len){dx/=len;dz/=len;const angle=world.azimuth;const x=dx*Math.cos(angle)+dz*Math.sin(angle);dz=-dx*Math.sin(angle)+dz*Math.cos(angle);dx=x;}
    else if(path.length){const p=path[0],distance=Math.hypot(p.x-state.position.x,p.z-state.position.z);if(distance<.25)path.shift();else{remainingDistance=distance;dx=(p.x-state.position.x)/distance;dz=(p.z-state.position.z)/distance;}}
    const before={...state.position};if(dx||dz){const speed=Math.min(sprinting?4.8:2.85,remainingDistance/Math.max(.001,dt)),steps=Math.ceil(dt/.025);for(let i=0;i<steps;i++)move(state,dx*dt*speed/steps,dz*dt*speed/steps,world.colliders);moving=Math.hypot(state.position.x-before.x,state.position.z-before.z)>.0001;if(moving){const targetAngle=Math.atan2(-dx,-dz);world.player.rotation.y+=Math.atan2(Math.sin(targetAngle-world.player.rotation.y),Math.cos(targetAngle-world.player.rotation.y))*Math.min(1,dt*12);}else path=[];}
    stepTimer+=dt;if(moving&&stepTimer>(sprinting?.27:.43)){audio.play('footstep',sprinting?.22:.14);stepTimer=0;}
    audio.update(Math.abs(state.position.x-riverX(state.position.z)));saveTimer+=dt;if(saveTimer>3){save();saveTimer=0;}
  }
  const near=started?nearestEntity(state):undefined;
  world.update(dt,state,started,moving,sprinting,near?.id);ui.update(state,near,dt);
}

async function boot(){
  try{world=new GardenWorld(canvas);await world.load();world.quality(localStorage.getItem('lumen-quality')??'standard');document.querySelector('#loading')!.classList.add('loaded');setTimeout(()=>document.querySelector('#loading')?.remove(),900);window.addEventListener('resize',()=>world.resize());requestAnimationFrame(frame);
    if(import.meta.env.DEV){
      (window as any).__LUMEN={snapshot:()=>({state:JSON.parse(JSON.stringify(state)),ready:world.ready,paused,started,photo,near:nearestEntity(state)?.id,stats:world.stats(),fps:Math.round(fps),audio:{started:audio.started,context:audio.context?.state,buffers:audio.buffers.size}}),
        fixturePosition:(x:number,z:number)=>{state.position={x,z};path=[];keys.clear();},
        navigateTo:(x:number,z:number)=>{path=findPath(state.position,{x,z},world.colliders);return path.length;},
        colliders:()=>world.colliders,landmarks:locations};
    }
  }catch(error){console.error(error);document.querySelector('#loading')!.innerHTML='<span class="star">✧</span><p>정원을 열려면 WebGL을 지원하는 브라우저가 필요합니다.</p><button style="pointer-events:auto" onclick="location.reload()">다시 열기</button>';}
}
void boot();
