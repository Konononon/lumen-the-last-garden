import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mkdir, writeFile } from 'node:fs/promises';

// All meshes are sculpted here from curves and parametric surfaces.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
let seed=7319;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const mat=(name,color,roughness=.85,metalness=0,emissive=0,intensity=0)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity:intensity});m.name=name;return m;};
const stone=mat('Warm limestone','#aaae9c'), edge=mat('Carved pale stone','#ced4ba'), dark=mat('Deep limestone','#5c776f');
const gold=mat('Antique brass','#bda765',.35,.7), bark=mat('Silverwood bark','#696366'), wood=mat('Cedar wood','#6b6251');
const leaf=mat('Jade foliage','#32645a'), leaf2=mat('Sage foliage','#648d70'), pink=mat('Mulberry foliage','#925a80'), pink2=mat('Lilac foliage','#c17e9d');
const grassmat=mat('Meadow sage','#55795b'), petal=mat('Moon petals','#a6a4d2'), glow=mat('Living amber','#ffe9ac',.3,.1,'#ffcf6a',2.6);
const blue=mat('Living moonstone','#97e5e0',.2,.45,'#5ee7d6',2), cloth=mat('Traveller teal velvet','#285e67'), trim=mat('Traveller embroidery','#d2b478',.5,.35);
const models=new T.Group();models.name='Lumen original sculpted library';
function mesh(g,m,p=[0,0,0],s=[1,1,1],rot=[0,0,0],parent){const a=new T.Mesh(g,m);a.position.set(...p);a.scale.set(...s);a.rotation.set(...rot);parent?.add(a);return a;}
function box(m,p,s,parent,rot=[0,0,0]){return mesh(new T.BoxGeometry(1,1,1),m,p,s,rot,parent);}
function orb(m,p,s,parent,detail=1){return mesh(new T.IcosahedronGeometry(1,detail),m,p,s,[0,rand()*6.28,0],parent);}
function cyl(m,p,r1,r2,h,parent,n=12){return mesh(new T.CylinderGeometry(r1,r2,h,n),m,p,[1,1,1],[0,0,0],parent);}
function ring(m,p,r,t,parent,rot=[Math.PI/2,0,0]){return mesh(new T.TorusGeometry(r,t,6,40),m,p,[1,1,1],rot,parent);}
function branch(points,r,m,parent){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(new T.TubeGeometry(curve,12,r,6,false),m,[0,0,0],[1,1,1],[0,0,0],parent);}
function model(name,build,merge=true){const g=new T.Group();g.name=name;build(g);if(merge){g.updateMatrixWorld(true);const buckets=new Map();g.traverse(o=>{if(o.isMesh){let geo=o.geometry.clone().applyMatrix4(o.matrixWorld);if(geo.index)geo=geo.toNonIndexed();geo.normalizeNormals();let list=buckets.get(o.material);if(!list)buckets.set(o.material,list=[]);list.push(geo);}});g.clear();for(const [m,geos] of buckets){const a=new T.Mesh(mergeGeometries(geos),m);a.name=m.name;g.add(a);}}models.add(g);return g;}
function canopy(g,center,size,m,accent){
  const geo=new T.IcosahedronGeometry(1,2);const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const d=1+.09*Math.sin(x*7+z*5)*Math.cos(y*6)+.06*Math.cos(z*11-y*5);p.setXYZ(i,x*d,y*d,z*d);}geo.deleteAttribute('normal');geo.deleteAttribute('uv');const smooth=mergeVertices(geo);smooth.computeVertexNormals();
  smooth.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(smooth.attributes.position.count*2),2));mesh(smooth,m,center,size,[0,0,0],g);
  const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(-.17,.23,0,.57);leafShape.quadraticCurveTo(.18,.23,0,0);const leafGeo=new T.ShapeGeometry(leafShape,4);
  for(let i=0;i<60;i++){const a=rand()*6.28,y=rand()*2-1,rr=Math.sqrt(1-y*y),x=Math.cos(a)*rr,z=Math.sin(a)*rr;const leafMesh=mesh(leafGeo,i%6?m:accent,[center[0]+x*size[0],center[1]+y*size[1],center[2]+z*size[2]],[.4+rand()*.35,.4+rand()*.4,1],[0,0,0],g);leafMesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(x,y,z));leafMesh.rotateZ(rand()*6.28);}
}
function tree(g,foliage,accent){
  branch([[0,0,0],[.1,1.5,.1],[-.12,3,0],[.25,4.8,.15],[.4,6.1,0]],.3,bark,g);
  for(let i=0;i<7;i++){const a=i*2.4,l=1.2+rand()*1.3,y=3.1+rand()*2.2,x=Math.cos(a)*l,z=Math.sin(a)*l;branch([[0,y-1,0],[x*.6,y,z*.6],[x,y+.7,z]],.11,bark,g);canopy(g,[x,y+.8,z],[1.35+rand()*.35,.9+rand()*.3,1.25+rand()*.4],i%3?foliage:accent,accent);}
  canopy(g,[.3,6.3,.1],[1.5,1.15,1.5],accent,foliage);
  for(let i=0;i<5;i++){const a=i*1.26;branch([[0,.5,0],[Math.cos(a)*.45,.18,Math.sin(a)*.45],[Math.cos(a)*1.3,0,Math.sin(a)*1.3]],.14,bark,g);}
}
model('silverwood',g=>tree(g,leaf,leaf2));
model('blossom',g=>tree(g,pink,pink2));
model('cypress',g=>{cyl(bark,[0,2,0],.14,.3,4,g);for(let i=0;i<5;i++){mesh(new T.ConeGeometry(1.1-i*.14,2.3,10),i%2?leaf:leaf2,[0,2.3+i*.7,0],[1,1,1],[0,i*.6,0],g);}});
model('rock',g=>{const geo=new T.IcosahedronGeometry(1,1);const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=1+.14*Math.sin(x*4+y*2)*Math.cos(z*5);p.setXYZ(i,x*d,y*d,z*d);}geo.computeVertexNormals();mesh(geo,dark,[0,.3,0],[1,.62,.85],[.1,.5,.1],g);orb(grassmat,[-.1,.78,-.1],[.62,.085,.55],g);});
model('grass',g=>{for(let i=0;i<5;i++){const a=rand()*6.28,x=(rand()-.5)*.4,z=(rand()-.5)*.4,h=.16+rand()*.3;const shape=new T.Shape();shape.moveTo(-.045,0);shape.quadraticCurveTo(.04,h*.6,.12,h);shape.quadraticCurveTo(.02,h*.35,.045,0);mesh(new T.ShapeGeometry(shape,3),grassmat,[x,0,z],[1,1,1],[0,a,0],g);}});
model('fern',g=>{for(let j=0;j<7;j++){const a=j*6.28/7;const frond=new T.Group();frond.rotation.y=a;branch([[0,0,0],[0,.65,.3],[0,.9,.8],[0,.75,1.2]],.018,leaf2,frond);for(let i=0;i<9;i++){const y=Math.sin(i/9*Math.PI)*.55+.15,z=i*.12;for(const side of [-1,1]){const s=new T.Shape();s.moveTo(0,0);s.quadraticCurveTo(side*.3,.13,side*(.4-i*.03),-.02);s.quadraticCurveTo(side*.15,-.07,0,0);mesh(new T.ShapeGeometry(s),leaf2,[0,y,z],[1,1,1],[-.45,0,0],frond);}}g.add(frond);}});
model('flower',g=>{for(let i=0;i<3;i++){const x=(rand()-.5)*.4,z=(rand()-.5)*.4,h=.35+rand()*.45;branch([[x,0,z],[x-.08,h*.6,z],[x,h,z]],.012,leaf,g);for(let j=0;j<5;j++){const a=j*1.256;orb(petal,[x+Math.cos(a)*.09,h,z+Math.sin(a)*.09],[.1,.04,.065],g,0);}orb(glow,[x,h+.01,z],[.04,.025,.04],g,0);}});
model('mushroom',g=>{for(let i=0;i<4;i++){const x=(rand()-.5)*.5,z=(rand()-.5)*.5,h=.2+rand()*.25;cyl(edge,[x,h*.5,z],.04,.055,h,g);mesh(new T.SphereGeometry(.22,14,8,0,Math.PI*2,0,Math.PI*.5),i%2?blue:pink,[x,h,z],[1,.65,1],[0,0,0],g);}});
model('column',g=>{box(dark,[0,.15,0],[1.5,.3,1.5],g);box(edge,[0,.38,0],[1.25,.16,1.25],g);cyl(stone,[0,1.8,0],.39,.48,2.7,g);for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(edge,[Math.cos(a)*.39,1.8,Math.sin(a)*.39],.052,.052,2.7,g,6);}box(edge,[0,3.28,0],[1.15,.25,1.15],g);box(stone,[0,3.5,0],[1.4,.2,1.4],g);ring(gold,[0,3.17,0],.48,.028,g);});
model('lantern',g=>{cyl(wood,[0,.95,0],.065,.1,1.9,g);branch([[0,1.85,0],[.15,2.1,0],[.5,2.12,0],[.55,1.85,0]],.035,gold,g);cyl(gold,[.55,1.5,0],.22,.22,.05,g);cyl(gold,[.55,1.85,0],.24,.24,.07,g);orb(glow,[.55,1.67,0],[.14,.19,.14],g,1);for(let i=0;i<4;i++){const a=i*Math.PI/2;cyl(gold,[.55+Math.cos(a)*.18,1.67,Math.sin(a)*.18],.018,.018,.32,g,5);}mesh(new T.ConeGeometry(.27,.17,8),gold,[.55,1.97,0],[1,1,1],[0,0,0],g);});
model('bell',g=>{box(dark,[0,.12,0],[1.4,.24,1.2],g);for(const x of [-.55,.55])cyl(stone,[x,1,0],.13,.19,1.7,g);branch([[-.6,1.75,0],[0,2.2,0],[.6,1.75,0]],.12,edge,g);const pts=[[.06,0],[.07,.1],[.14,.16],[.18,.42],[.32,.55],[.4,.57]].map(([x,y])=>new T.Vector2(x,-y));mesh(new T.LatheGeometry(pts,24),gold,[0,1.8,0],[1,1,1],[0,0,0],g);orb(glow,[0,1.16,0],[.075,.075,.075],g);ring(gold,[0,.35,0],.38,.025,g);});
model('mirror',g=>{cyl(dark,[0,.16,0],.85,.95,.32,g);cyl(stone,[0,.64,0],.3,.42,.75,g);ring(gold,[0,1.5,0],.62,.055,g,[0,0,0]);mesh(new T.CircleGeometry(.58,32),mat('Polished star mirror','#6ec9c9',.12,.8,'#397a83',.5),[0,1.5,0],[1,1,1],[0,0,0],g);for(let i=0;i<8;i++){const a=i*Math.PI/4;orb(gold,[Math.cos(a)*.7,1.5+Math.sin(a)*.7,0],[.04,.04,.04],g,0);}orb(blue,[0,.85,0],[.16,.25,.16],g);});
model('pedestal',g=>{cyl(dark,[0,.14,0],1.15,1.25,.28,g,32);cyl(stone,[0,.4,0],.9,1.05,.3,g,24);cyl(edge,[0,.6,0],.7,.85,.2,g,24);ring(gold,[0,.72,0],.65,.04,g);for(let i=0;i<6;i++){const a=i*Math.PI/3;mesh(new T.ConeGeometry(.13,.35,6),gold,[Math.cos(a)*.6,.86,Math.sin(a)*.6],[1,1,1],[0,0,0],g);}});
model('well',g=>{cyl(dark,[0,.1,0],1.9,2.1,.2,g,32);for(let i=0;i<16;i++){const a=i*Math.PI/8;box(stone,[Math.cos(a)*1.5,.5,Math.sin(a)*1.5],[.6,.75,.45],g,[0,-a,0]);}ring(edge,[0,.9,0],1.55,.12,g);ring(gold,[0,.93,0],1.56,.025,g);});
model('gate',g=>{for(const x of [-2.9,2.9]){box(dark,[x,.25,0],[1.9,.5,1.7],g);box(stone,[x,2.8,0],[1.1,5.1,1],g);box(edge,[x,5.25,0],[1.5,.4,1.3],g);for(const z of [-.53,.53])box(gold,[x,2.8,z],[.06,4.5,.04],g);}
  const curve=new T.EllipseCurve(0,0,2.9,2.9,0,Math.PI,false,0);const points=curve.getPoints(48).map(p=>new T.Vector3(p.x,p.y+5.2,0));mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),48,.42,8,false),stone,[0,0,0],[1,1,1],[0,0,0],g);
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>p.clone().add(new T.Vector3(0,0,.44)))),48,.035,6,false),gold,[0,0,0],[1,1,1],[0,0,0],g);
  for(let i=0;i<13;i++){const a=i*Math.PI/12;box(edge,[Math.cos(a)*2.9,Math.sin(a)*2.9+5.2,0],[.12,.9,1],g,[0,0,a-Math.PI/2]);}
  ring(gold,[0,7.8,.5],.45,.04,g,[0,0,0]);orb(blue,[0,7.8,.5],[.18,.3,.12],g);
});
model('traveller',g=>{
  const body=new T.Group();body.name='body';g.add(body);
  const cloak=new T.LatheGeometry([new T.Vector2(.48,0),new T.Vector2(.53,.12),new T.Vector2(.44,.5),new T.Vector2(.3,.95),new T.Vector2(.18,1.02)],24);mesh(cloak,cloth,[0,.35,0],[1,1,1],[0,0,0],body);
  ring(trim,[0,.48,0],.5,.018,body);orb(mat('Warm porcelain','#dec8a6'),[0,1.48,0],[.22,.26,.21],body,2);
  const hood=mesh(new T.SphereGeometry(.3,20,16,0,Math.PI*2,0,Math.PI*.72),cloth,[0,1.53,.03],[1,1.06,1],[0,0,0],body);hood.rotation.x=.25;
  branch([[.1,1.2,-.23],[.25,.88,-.34],[.38,.66,-.4]],.035,trim,body);
  for(const x of [-.2,.2]){const leg=new T.Group();leg.name=x<0?'legLeft':'legRight';leg.position.set(x,.4,0);cyl(wood,[0,-.15,0],.085,.08,.32,leg);box(wood,[0,-.31,-.045],[.18,.14,.32],leg);g.add(leg);}
  const arm=new T.Group();arm.name='lanternArm';arm.position.set(-.35,1,0);branch([[0,0,0],[-.12,-.25,-.13],[-.16,-.22,-.32]],.09,cloth,arm);ring(gold,[-.16,-.37,-.32],.13,.018,arm,[0,0,0]);cyl(gold,[-.16,-.6,-.32],.15,.15,.05,arm);orb(glow,[-.16,-.49,-.32],[.1,.14,.1],arm,1);g.add(arm);
  orb(trim,[.13,1.1,.36],[.25,.29,.13],body);
},false);
model('keeper',g=>{mesh(new T.LatheGeometry([new T.Vector2(.6,0),new T.Vector2(.55,.5),new T.Vector2(.3,1.6),new T.Vector2(.1,1.7)],20),edge,[0,.1,0],[1,1,1],[0,0,0],g);orb(dark,[0,2,0],[.3,.4,.28],g,2);orb(blue,[-.11,2.04,-.26],[.04,.04,.04],g);orb(blue,[.11,2.04,-.26],[.04,.04,.04],g);branch([[.4,1.6,0],[.7,1.1,-.1],[.8,.9,-.2]],.12,edge,g);cyl(wood,[.8,1.2,-.2],.04,.055,2.4,g);ring(gold,[.8,2.4,-.2],.25,.04,g,[0,0,0]);orb(glow,[.8,2.4,-.2],[.12,.12,.1],g);});
await mkdir('public/assets',{recursive:true});
const binary=await new GLTFExporter().parseAsync(models,{binary:true});
await writeFile('public/assets/garden.glb',Buffer.from(binary));
await writeFile('public/assets/manifest.json',JSON.stringify({creator:'Original assets authored for LUMEN',models:models.children.map(x=>x.name),source:'scripts/create-models.mjs',audioSource:'scripts/create-audio.py'},null,2));
console.log(`Authored ${models.children.length} models, ${(binary.byteLength/1024/1024).toFixed(2)} MB`);
