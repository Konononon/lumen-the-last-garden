import {isRiver} from './simulation.mjs';
const STEP=.8;
export function walkable(x,z,colliders){return Math.hypot(x*.97,z)<23.65&&!isRiver(x,z)&&!colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.35);}
export function findPath(start,end,colliders){
  const cells=61,offset=30,key=(x,z)=>z*cells+x;
  const grid=p=>({x:Math.round(p.x/STEP)+offset,z:Math.round(p.z/STEP)+offset});
  const s=grid(start);let goal=grid(end);
  const valid=(x,z)=>x>=0&&z>=0&&x<cells&&z<cells&&walkable((x-offset)*STEP,(z-offset)*STEP,colliders);
  if(!valid(goal.x,goal.z)){
    let nearest=null,best=Infinity;for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){const x=goal.x+dx,z=goal.z+dz;if(valid(x,z)&&Math.hypot(dx,dz)<best){best=Math.hypot(dx,dz);nearest={x,z};}}if(!nearest)return [];goal=nearest;
  }
  const startKey=key(s.x,s.z),goalKey=key(goal.x,goal.z),open=[{...s,g:0,f:0}],costs=new Map([[startKey,0]]),came=new Map();let iterations=0;
  while(open.length&&iterations++<6000){
    open.sort((a,b)=>a.f-b.f);const current=open.shift(),ck=key(current.x,current.z);
    if(ck===goalKey){const path=[];let k=ck;while(k!==startKey){path.push({x:(k%cells-offset)*STEP,z:(Math.floor(k/cells)-offset)*STEP});k=came.get(k);if(k===undefined)return [];}return path.reverse();}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const x=current.x+dx,z=current.z+dz;if(!valid(x,z)||(dx&&dz&&(!valid(current.x+dx,current.z)||!valid(current.x,current.z+dz))))continue;
      const nextKey=key(x,z),g=current.g+Math.hypot(dx,dz);if(g>=(costs.get(nextKey)??Infinity))continue;
      costs.set(nextKey,g);came.set(nextKey,ck);open.push({x,z,g,f:g+Math.hypot(x-goal.x,z-goal.z)});
    }
  }
  return [];
}
