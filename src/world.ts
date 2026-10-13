import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight,riverX,bridgeZ,entities,moths} from './simulation.mjs';

type Placement={x:number;y?:number;z:number;scale?:number;angle?:number};
export type Collider={x:number;z:number;r:number};
let seed=92174;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const color=(c:string)=>new T.Color(c);
const up=new T.Vector3(0,1,0);

export class GardenWorld {
  scene=new T.Scene();
  camera=new T.PerspectiveCamera(43,1,.15,160);
  renderer:T.WebGLRenderer;
  composer:EffectComposer;
  bloom:UnrealBloomPass;
  library=new Map<string,T.Object3D>();
  colliders:Collider[]=[];
  terrain!:T.Mesh;
  player!:T.Object3D;
  markers=new Map<string,T.Object3D>();
  mirrors:T.Object3D[]=[];
  beams:T.Mesh[]=[];
  shardOrbs:T.Mesh[]=[];
  mothViews=new Map<string,T.Object3D>();
  gateVeil!:T.Mesh;
  wellWater!:T.Mesh;
  pulseRing!:T.Mesh;
  time={value:0};
  restoration={value:0};
  sun:T.DirectionalLight;
  lanternLight=new T.PointLight('#ffd595',5,5,2);
  fireflies!:T.Points;
  particles!:T.Points;
  cinematic=0;
  ready=false;
  photo=false;
  target=new T.Vector3(0,1,19);
  azimuth=.32;
  elevation=.49;
  distance=15.5;
  pulseTime=-10;
  constructor(canvas:HTMLCanvasElement){
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;this.renderer.info.autoReset=false;
    this.scene.background=color('#496d77');this.scene.fog=new T.FogExp2('#648582',.014);
    const pmrem=new T.PMREMGenerator(this.renderer);const env=new RoomEnvironment();this.scene.environment=pmrem.fromScene(env,.05).texture;env.dispose();pmrem.dispose();this.scene.environmentIntensity=.22;
    this.scene.add(new T.HemisphereLight('#9fcbd8','#2a3e3c',.95));
    this.sun=new T.DirectionalLight('#ffe1aa',2.8);this.sun.position.set(-18,25,10);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-33,right:33,top:33,bottom:-33,near:1,far:80});this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.04;this.sun.shadow.radius=3;this.scene.add(this.sun);
    const rim=new T.DirectionalLight('#8cbed0',.9);rim.position.set(12,18,-20);this.scene.add(rim);
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.36,.62,1.25);this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 p=vUv-.5;float v=1.-dot(p,p)*.55;c.rgb*=v;gl_FragColor=c;}'}));
    this.composer.addPass(new OutputPass());
    this.resize();
  }
  async load(){
    const gltf=await new GLTFLoader().loadAsync('/assets/garden.glb');
    const names=new Set(['silverwood','blossom','cypress','rock','grass','fern','flower','mushroom','column','lantern','bell','mirror','pedestal','well','gate','traveller','keeper']);
    gltf.scene.traverse(g=>{if(!names.has(g.name))return;this.library.set(g.name,g);g.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.side=T.DoubleSide;if(m.name.includes('foliage')){(m as T.MeshStandardMaterial).roughness=.95;}}}});});
    this.buildSky();this.buildTerrain();this.buildArchitecture();this.buildVegetation();this.buildInteractions();this.buildEffects();this.batchStatics();
    this.player=this.place('traveller',{x:0,z:19,scale:.95});this.scene.add(this.lanternLight);
    this.ready=true;
  }
  place(name:string,p:Placement){const a=this.library.get(name)!.clone(true);a.position.set(p.x,p.y??terrainHeight(p.x,p.z),p.z);a.scale.setScalar(p.scale??1);a.rotation.y=p.angle??0;this.scene.add(a);return a;}
  instances(name:string,placements:Placement[],shadows=true){
    const prototype=this.library.get(name)!;prototype.updateMatrixWorld(true);
    const dummy=new T.Object3D();prototype.traverse(o=>{
      if(!(o instanceof T.Mesh))return;
      const inst=new T.InstancedMesh(o.geometry,o.material,placements.length);inst.castShadow=shadows;inst.receiveShadow=true;
      placements.forEach((p,i)=>{dummy.position.set(p.x,p.y??terrainHeight(p.x,p.z),p.z);dummy.rotation.set(0,p.angle??0,0);dummy.scale.setScalar(p.scale??1);dummy.updateMatrix();inst.setMatrixAt(i,new T.Matrix4().multiplyMatrices(dummy.matrix,o.matrixWorld));if(['grass','flower','silverwood','blossom','rock'].includes(name))inst.setColorAt(i,new T.Color().setHSL(.08,.06,.8+(i%7)*.022));});
      inst.computeBoundingSphere();this.scene.add(inst);
    });
  }
  standard(c:string,roughness=.9,metalness=0){return new T.MeshStandardMaterial({color:c,roughness,metalness});}
  primitive(geo:T.BufferGeometry,material:T.Material,p:T.Vector3,scale?:T.Vector3){const m=new T.Mesh(geo,material);m.position.copy(p);if(scale)m.scale.copy(scale);m.castShadow=true;m.receiveShadow=true;this.scene.add(m);return m;}
  batchStatics(){
    this.scene.updateMatrixWorld(true);const buckets=new Map<T.Material,T.BufferGeometry[]>(),remove:T.Mesh[]=[];
    this.scene.traverse(o=>{if(!(o instanceof T.Mesh)||o instanceof T.InstancedMesh||!(o.material instanceof T.MeshStandardMaterial)||o===this.terrain||o===this.wellWater||this.shardOrbs.includes(o))return;
      let parent:T.Object3D|null=o;while(parent){if(this.mirrors.includes(parent))return;parent=parent.parent;}
      let geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);if(geometry.index)geometry=geometry.toNonIndexed();let list=buckets.get(o.material);if(!list)buckets.set(o.material,list=[]);list.push(geometry);remove.push(o);
    });
    remove.forEach(o=>o.removeFromParent());for(const [material,geometries] of buckets){const combined=mergeGeometries(geometries);if(!combined)throw new Error('Static geometry attributes do not match');const mesh=new T.Mesh(combined,material);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);geometries.forEach(g=>g.dispose());}
  }
  buildSky(){
    const sky=new T.Mesh(new T.SphereGeometry(95,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:color('#183c52')},bottom:{value:color('#89a9a0')}},vertexShader:'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 vPos;void main(){float h=normalize(vPos).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.1,.8,h)),1.);}'}));this.scene.add(sky);
    const moon=this.primitive(new T.SphereGeometry(3.8,32,24),new T.MeshBasicMaterial({color:'#f3e7c4'}),new T.Vector3(17,19,-60));moon.castShadow=false;
    const halo=new T.Sprite(new T.SpriteMaterial({map:this.radialTexture(),color:'#fbe5ae',transparent:true,opacity:.23,depthWrite:false,blending:T.AdditiveBlending}));halo.position.copy(moon.position);halo.scale.set(20,20,1);this.scene.add(halo);
    for(let layer=0;layer<3;layer++){const vertices:number[]=[];const r=52+layer*12;for(let i=0;i<120;i++){const a=i/120*Math.PI*2,b=(i+1)/120*Math.PI*2;const h=(k:number)=>4+layer*3+Math.sin(k*.22+layer)*4+Math.sin(k*.77)*2+Math.sin(k*1.8)*1.2;vertices.push(Math.sin(a)*r,-20,Math.cos(a)*r,Math.sin(b)*r,-20,Math.cos(b)*r,Math.sin(a)*r,h(i),Math.cos(a)*r,Math.sin(a)*r,h(i),Math.cos(a)*r,Math.sin(b)*r,-20,Math.cos(b)*r,Math.sin(b)*r,h(i+1),Math.cos(b)*r);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();const m=this.standard(['#416672','#597d83','#71908d'][layer]);m.side=T.DoubleSide;this.scene.add(new T.Mesh(geo,m));}
    const stars=new Float32Array(180*3);for(let i=0;i<180;i++){stars[i*3]=(random()-.5)*130;stars[i*3+1]=28+random()*45;stars[i*3+2]=-25-random()*55;}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(stars,3));this.scene.add(new T.Points(geo,new T.PointsMaterial({color:'#fff5cd',size:.14,transparent:true,opacity:.75,depthWrite:false})));
  }
  radialTexture(){
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.14,'rgba(255,255,255,.85)');g.addColorStop(.45,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new T.CanvasTexture(c);
  }
  contactShadows(placements:Placement[],radius=1){
    const geo=new T.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);const material=new T.MeshBasicMaterial({map:this.radialTexture(),color:'#092925',transparent:true,opacity:.43,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const shadows=new T.InstancedMesh(geo,material,placements.length),dummy=new T.Object3D();placements.forEach((p,i)=>{dummy.position.set(p.x,terrainHeight(p.x,p.z)+.02,p.z);dummy.scale.set(radius*(p.scale??1)*3.6,1,radius*(p.scale??1)*3.6);dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);});this.scene.add(shadows);
  }
  pathDistance(x:number,z:number){
    const paths=[[[0,22],[0,15],[-5,9],[-12,10]],[[-5,9],[-9,3],[-14,-6],[-9,-13],[0,-17]],[[0,15],[riverX(12),12],[10,9],[14,-6],[8,-15],[0,-17]],[[0,-17],[riverX(-9),-9],[14,-6]]];
    let d=100;for(const line of paths)for(let i=0;i<line.length-1;i++){const [ax,az]=line[i],[bx,bz]=line[i+1];const t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(z-az)*(bz-az))/((bx-ax)**2+(bz-az)**2)));d=Math.min(d,Math.hypot(x-ax-t*(bx-ax),z-az-t*(bz-az)));}return d;
  }
  buildTerrain(){
    const geo=new T.PlaneGeometry(56,56,150,150);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;const colors=new Float32Array(pos.count*3);const c1=color('#5c7861'),c2=color('#91a473'),path=color('#acaa88'),bank=color('#738e7d');
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z),river=Math.abs(x-riverX(z));let h=terrainHeight(x,z);if(river<1.6)h-=Math.max(0,1-river/1.6)*.85;if(r>24)h-=Math.min(10,(r-24)*2.1);pos.setY(i,h);const c=c1.clone().lerp(c2,(Math.sin(x*.3+z*.24)+1)*.24+random()*.15);const pd=this.pathDistance(x,z);c.lerp(path,Math.max(0,1-pd/1.2)*.85);if(river<2.1)c.lerp(bank,.6);if(r>24)c.multiplyScalar(.65);colors.set([c.r,c.g,c.b],i*3);}geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.computeVertexNormals();
    const ground=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
    // A hand-authored grain texture breaks up smooth terrain at close range.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#929292';ctx.fillRect(0,0,256,256);for(let i=0;i<16000;i++){ctx.fillStyle=`rgba(${random()>.5?'255,255,255':'0,0,0'},${random()*.1})`;ctx.fillRect(random()*256,random()*256,1+random()*2,1+random()*2);}const tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(26,26);ground.bumpMap=tex;ground.bumpScale=.065;
    const diffuse=document.createElement('canvas');diffuse.width=diffuse.height=512;const brush=diffuse.getContext('2d')!;brush.fillStyle='#bcbcac';brush.fillRect(0,0,512,512);
    for(let i=0;i<110;i++){const x=random()*512,z=random()*512,r=15+random()*70;for(const ox of [-512,0,512])for(const oz of [-512,0,512]){const gradient=brush.createRadialGradient(x+ox,z+oz,0,x+ox,z+oz,r);gradient.addColorStop(0,i%2?'#7e897d35':'#f0e4bf25');gradient.addColorStop(1,'transparent');brush.fillStyle=gradient;brush.fillRect(x+ox-r,z+oz-r,r*2,r*2);}}
    for(let i=0;i<10000;i++){brush.fillStyle=['#5e705a35','#77756322','#e5dfc733','#d1d4bd44'][i%4];brush.beginPath();brush.ellipse(random()*512,random()*512,.5+random()*1.4,.3+random()*.9,random()*6,0,Math.PI*2);brush.fill();}
    const diffuseMap=new T.CanvasTexture(diffuse);diffuseMap.colorSpace=T.SRGBColorSpace;diffuseMap.wrapS=diffuseMap.wrapT=T.RepeatWrapping;diffuseMap.repeat.set(9,9);ground.map=diffuseMap;
    this.terrain=new T.Mesh(geo,ground);this.terrain.receiveShadow=true;this.scene.add(this.terrain);
    const waterGeo=new T.PlaneGeometry(3.1,51,10,170);waterGeo.rotateX(-Math.PI/2);const p=waterGeo.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i);p.setX(i,p.getX(i)+riverX(z));p.setY(i,-.035);}waterGeo.computeVertexNormals();
    const water=new T.Mesh(waterGeo,new T.ShaderMaterial({transparent:true,uniforms:{uTime:this.time},vertexShader:'varying vec3 vPos;void main(){vPos=position;vec3 p=position;p.y+=sin(p.z*3.+p.x*5.)*.012;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:`uniform float uTime; varying vec3 vPos; void main(){float center=2.5*sin(vPos.z*.17)+1.7;float edge=abs(vPos.x-center)/1.55;float warp=sin(vPos.x*4.+uTime*.2)+sin(vPos.z*.8);float wave=sin(vPos.z*5.+warp-uTime*1.4)*.5+.5;float glint=pow(max(0.,sin(vPos.z*17.+warp*3.-uTime*1.6)),28.)*pow(sin(vPos.x*5.+vPos.z*.7)*.5+.5,4.);vec3 c=mix(vec3(.025,.14,.16),vec3(.09,.29,.28),wave*.18+edge*.35);float foam=smoothstep(.9,1.,edge)*(.5+.5*sin(vPos.z*17.+uTime*1.3));c+=vec3(.27,.43,.36)*foam*.45;c+=vec3(.3,.5,.42)*glint*.4;gl_FragColor=vec4(c,.97);}` }));this.scene.add(water);
    const pebbles:Placement[]=[];for(let i=0;i<120;i++){const z=(random()-.5)*47,x=riverX(z)+(random()>.5?1:-1)*(1.65+random()*.65);pebbles.push({x,z,scale:.15+random()*.32});}this.instances('rock',pebbles,false);
    // Cascade at the edge of the floating garden.
    const fallGeo=new T.PlaneGeometry(2.8,8,8,28);const fall=new T.Mesh(fallGeo,new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{uTime:this.time},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uTime;varying vec2 vUv;void main(){float s=sin(vUv.x*65.+sin(vUv.y*15.+uTime*3.))*0.5+0.5;float a=sin(vUv.x*3.14159)*smoothstep(0.,.2,vUv.y);gl_FragColor=vec4(mix(vec3(.29,.64,.6),vec3(.79,.88,.75),s),a*.72);}'}));fall.position.set(riverX(24),-3.7,24.4);this.scene.add(fall);
  }
  buildArchitecture(){
    const limestone=this.standard('#bac2a8'),brass=this.standard('#b5a06a',.35,.65),wood=this.standard('#897c64');
    for(const z of bridgeZ){const x=riverX(z),y=terrainHeight(x,z)+.14;for(let i=0;i<16;i++){this.primitive(new T.BoxGeometry(.31,.18,2.65),wood,new T.Vector3(x-2.4+i*.32,y,z));}for(const side of [-1,1]){for(const xx of [-2.3,0,2.3])this.primitive(new T.BoxGeometry(.13,1.12,.13),wood,new T.Vector3(x+xx,y+.5,z+side*1.35));const rail=this.primitive(new T.BoxGeometry(5,.1,.1),wood,new T.Vector3(x,y+.92,z+side*1.35));rail.rotation.z=.025*side;}}
    const plaza=new T.Mesh(new T.CylinderGeometry(5.5,5.7,.18,64),limestone);plaza.position.set(0,terrainHeight(0,-16)+.08,-16);plaza.receiveShadow=true;this.scene.add(plaza);
    for(let i=0;i<3;i++){const ring=new T.Mesh(new T.TorusGeometry(2.6+i*.85,.025,6,80),brass);ring.rotation.x=Math.PI/2;ring.position.set(0,plaza.position.y+.1,-16);this.scene.add(ring);}
    this.place('gate',{x:0,z:-18,y:terrainHeight(0,-16)+.17});
    for(const [x,z] of [[-5,-15],[5,-15],[-5,-20],[5,-20],[-9,-8],[11,5],[-18,1]]){this.place('column',{x,z});this.colliders.push({x,z,r:.7});}
    for(let i=0;i<7;i++){const x=-6.5+i*.5,z=-11+Math.sin(i)*.3;const b=this.primitive(new T.BoxGeometry(.8,.45,.7),limestone,new T.Vector3(x,terrainHeight(x,z)+.2,z));b.rotation.set(random()*.4,random()*2,random()*.3);}
    for(const [x,z] of [[-14,-6],[14,-6],[-12,10]]){const base=this.primitive(new T.CylinderGeometry(3.7,3.9,.13,40),this.standard('#9fac92'),new T.Vector3(x,terrainHeight(x,z)+.035,z));base.castShadow=false;const circle=this.primitive(new T.TorusGeometry(3.2,.026,6,64),brass,new T.Vector3(x,terrainHeight(x,z)+.11,z));circle.rotation.x=Math.PI/2;}
    this.place('well',{x:-12,z:10});this.colliders.push({x:-12,z:10,r:1.3});
    this.wellWater=this.primitive(new T.CircleGeometry(1.35,40),new T.MeshStandardMaterial({color:'#3c8e8a',metalness:.7,roughness:.15,emissive:'#265c58',emissiveIntensity:.5}),new T.Vector3(-12,terrainHeight(-12,10)+.45,10));this.wellWater.rotation.x=-Math.PI/2;
    const lanterns:Placement[]=[];for(const [x,z] of [[-1,20],[-4,13],[6,12],[11,8],[-8,7],[-16,8],[-11,-1],[-17,-8],[10,-8],[-4,-14],[4,-14],[7,-18],[-8,16]])lanterns.push({x,z,angle:random()*6});this.instances('lantern',lanterns);
    for(const [x,z] of [[-1,20],[6,12],[-8,7],[-4,-14],[4,-14]]){const light=new T.PointLight('#ffcd86',2.7,6,2);light.position.set(x+.5,terrainHeight(x,z)+1.7,z);this.scene.add(light);}
    const stones:Placement[]=[];for(let i=0;i<165;i++){const x=(random()-.5)*45,z=(random()-.5)*44;if(this.pathDistance(x,z)<.85&&Math.abs(x-riverX(z))>1.7){stones.push({x,z,scale:.2+random()*.3,angle:random()*6});}}this.instances('rock',stones,false);
  }
  buildVegetation(){
    const trees:Placement[]=[],blossoms:Placement[]=[],cypress:Placement[]=[],rocks:Placement[]=[];
    for(let i=0;i<62;i++){const a=i/62*Math.PI*2,r=20.4+random()*3.2,x=Math.cos(a)*r,z=Math.sin(a)*r;if(z>9&&Math.abs(x)<20)continue;const p={x,z,scale:.7+random()*.4,angle:random()*6};if(i%4===0)blossoms.push(p);else if(i%7===0)cypress.push(p);else trees.push(p);this.colliders.push({x,z,r:.5});}
    for(const [x,z,s] of [[-8,-15,1.6],[-18,12,1.1],[18,11,1.15],[-20,-13,1.1],[19,-13,1.25]]){blossoms.push({x,z,scale:s});this.colliders.push({x,z,r:.6});}
    this.instances('silverwood',trees);this.instances('blossom',blossoms);this.instances('cypress',cypress);
    this.contactShadows([...trees,...blossoms,...cypress],1);
    for(let i=0;i<65;i++){const a=random()*6.28,r=18+random()*6;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x-riverX(z))<2||this.pathDistance(x,z)<1.8||entities.some(e=>Math.hypot(x-e.x,z-e.z)<2.8))continue;const scale=.55+random()*1.3;rocks.push({x,z,scale,angle:random()*6});this.colliders.push({x,z,r:scale*.7});}this.instances('rock',rocks);this.contactShadows(rocks,.7);
    const grass:Placement[]=[],flowers:Placement[]=[],ferns:Placement[]=[],shrooms:Placement[]=[];
    for(let i=0;i<4800;i++){const x=(random()-.5)*48,z=(random()-.5)*48,r=Math.hypot(x,z);if(r>23.5||Math.abs(x-riverX(z))<1.85||this.pathDistance(x,z)<1.1||Math.hypot(x,z+17)<5||[[-14,-6],[14,-6],[-12,10]].some(([a,b])=>Math.hypot(x-a,z-b)<3.6))continue;const p={x,z,scale:.65+random()*.65,angle:random()*6};if(i%23===0)ferns.push({...p,scale:.35+random()*.25});else if(i%11===0)flowers.push({...p,scale:.45+random()*.5});else if(i%31===0)shrooms.push(p);else grass.push(p);}
    const grassPrototype=this.library.get('grass')!;grassPrototype.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshStandardMaterial;m.onBeforeCompile=shader=>{shader.uniforms.uTime=this.time;shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(uTime*1.3+instanceMatrix[3].x*.8+instanceMatrix[3].z*.5)*pow(position.y,2.)*.13;');};}});
    this.instances('grass',grass,false);this.instances('flower',flowers,false);this.instances('fern',ferns,false);this.instances('mushroom',shrooms,false);
    // Hanging vines around the moon arch, individually curved.
    const vineMat=this.standard('#668574');for(let i=0;i<10;i++){const x=-3+random()*6,h=5.5+random()*2;const pts=[new T.Vector3(x,h,-18.2),new T.Vector3(x+.2,h-1,-18),new T.Vector3(x-.15,h-2.3,-18.1)];const vine=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),12,.035,5,false),vineMat);this.scene.add(vine);for(let j=0;j<8;j++){const p=new T.CatmullRomCurve3(pts).getPoint(j/8);this.primitive(new T.SphereGeometry(.13,5,4),vineMat,p,new T.Vector3(1,.35,1.7));}}
  }
  buildInteractions(){
    for(const e of entities){let obj:T.Object3D;
      if(e.type==='keeper')obj=this.place('keeper',e);
      else if(e.type==='bell'){obj=this.place('bell',e);const glyph=this.glyph(['☾','✿','✧'][e.index!],'#f1d9a1');glyph.position.set(e.x,terrainHeight(e.x,e.z)+.5,e.z-.68);glyph.rotation.x=-Math.PI/2;this.scene.add(glyph);}
      else if(e.type==='mirror'){obj=this.place('mirror',e);this.mirrors[e.index!]=obj;this.colliders.push({x:e.x,z:e.z,r:.55});}
      else if(e.type==='water'){obj=this.place('pedestal',{...e,scale:.46});const g=this.glyph(['☾','✿','✧'][e.index!],'#b5eee1');g.position.set(e.x,terrainHeight(e.x,e.z)+.53,e.z);g.rotation.x=-Math.PI/2;this.scene.add(g);}
      else if(e.type==='lore'){
        obj=this.place('pedestal',{...e,scale:.45});const book=this.primitive(new T.BoxGeometry(.5,.065,.37),this.standard('#cabfa1'),new T.Vector3(e.x,terrainHeight(e.x,e.z)+.38,e.z));book.rotation.y=-.3;book.rotation.x=.1;
        const mark=this.glyph('≋','#67807a');mark.position.set(e.x,terrainHeight(e.x,e.z)+.425,e.z);mark.rotation.x=-Math.PI/2;mark.scale.setScalar(.35);this.scene.add(mark);
      }else obj=new T.Group();
      obj.userData.entityId=e.id;
      const marker=this.glyph(e.type==='lore'?'✧':e.type==='gate'?'✦':'·','#f9e6b8');marker.position.set(e.x,terrainHeight(e.x,e.z)+(e.type==='keeper'?3:2.7),e.z);marker.userData.baseY=marker.position.y;marker.userData.entityId=e.id;this.markers.set(e.id,marker);this.scene.add(marker);
    }
    for(const [i,[x,z]] of [[0,[-14,-6]],[1,[14,-6]],[2,[-12,10]]] as [number,number[]][]){
      const orb=this.primitive(new T.OctahedronGeometry(.25,0),new T.MeshStandardMaterial({color:'#b9fff0',emissive:'#72eee0',emissiveIntensity:2.7,metalness:.4,roughness:.25}),new T.Vector3(x,terrainHeight(x,z)+2.1,z));orb.userData.baseY=orb.position.y;this.shardOrbs[i]=orb;
    }
    for(let i=0;i<3;i++){const beam=this.primitive(new T.CylinderGeometry(.025,.025,1,6),new T.MeshBasicMaterial({color:'#a6ffe9',transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false}),new T.Vector3());beam.visible=false;beam.castShadow=false;this.beams.push(beam);}
    this.gateVeil=this.primitive(new T.PlaneGeometry(5.1,6.6),new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{uTime:this.time,uRestore:this.restoration},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uTime;uniform float uRestore;varying vec2 vUv;void main(){float a=sin(vUv.x*3.14159)*sin(vUv.y*3.14159);float w=sin(vUv.y*22.-uTime+sin(vUv.x*9.+uTime*.4))*0.5+0.5;vec3 c=mix(vec3(.2,.38,.43),vec3(.56,1.,.84),uRestore);gl_FragColor=vec4(c+w*.15,a*(.1+uRestore*.65));}'}),new T.Vector3(0,3.4+terrainHeight(0,-16),-18));this.gateVeil.castShadow=false;
    for(const m of moths){const g=new T.Group();const material=new T.MeshBasicMaterial({color:'#e1f5b9',side:T.DoubleSide});for(const side of [-1,1]){const wing=new T.Mesh(new T.SphereGeometry(.11,8,6),material);wing.scale.set(1.3,.2,1);wing.position.x=side*.09;g.add(wing);}const sprite=new T.Sprite(new T.SpriteMaterial({map:this.radialTexture(),color:'#dbffb2',transparent:true,blending:T.AdditiveBlending,opacity:.65,depthWrite:false}));sprite.scale.set(1.2,1.2,1);g.add(sprite);g.position.set(m.x,terrainHeight(m.x,m.z)+1.2,m.z);g.visible=false;this.mothViews.set(m.id,g);this.scene.add(g);}
  }
  glyph(text:string,c:string){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.font='64px Georgia';ctx.fillStyle=c;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,64);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(.75,.75),new T.MeshBasicMaterial({map:texture,transparent:true,side:T.DoubleSide,depthWrite:false}));return mesh;}
  buildEffects(){
    const positions=new Float32Array(350*3),phase=new Float32Array(350);for(let i=0;i<350;i++){positions[i*3]=(random()-.5)*45;positions[i*3+1]=.6+random()*4;positions[i*3+2]=(random()-.5)*44;phase[i]=random()*6.28;}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('phase',new T.BufferAttribute(phase,1));
    this.fireflies=new T.Points(geo,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uTime:this.time},vertexShader:'uniform float uTime;attribute float phase;varying float vGlow;void main(){vec3 p=position;p.x+=sin(uTime*.25+phase)*.45;p.y+=sin(uTime*.7+phase)*.18;p.z+=cos(uTime*.23+phase)*.3;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(65./-mv.z,1.,12.);vGlow=.4+.6*pow(sin(uTime*.6+phase)*.5+.5,2.);}',fragmentShader:'varying float vGlow;void main(){float a=pow(max(0.,1.-length(gl_PointCoord-.5)*2.),3.);gl_FragColor=vec4(1.,.89,.53,a*vGlow);}'}));this.scene.add(this.fireflies);
    const petals=new Float32Array(100*3);for(let i=0;i<100;i++){petals[i*3]=(random()-.5)*42;petals[i*3+1]=2+random()*7;petals[i*3+2]=(random()-.5)*42;}const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(petals,3));this.particles=new T.Points(pg,new T.PointsMaterial({color:'#ebc2cc',size:.06,transparent:true,opacity:.75,depthWrite:false}));this.scene.add(this.particles);
    this.pulseRing=this.primitive(new T.RingGeometry(.96,1,80),new T.MeshBasicMaterial({color:'#e6edb0',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}),new T.Vector3());this.pulseRing.rotation.x=-Math.PI/2;this.pulseRing.castShadow=false;
  }
  emitPulse(){this.pulseTime=this.time.value;this.pulseRing.position.set(this.player.position.x,this.player.position.y+.09,this.player.position.z);}
  orientBeam(beam:T.Mesh,from:T.Vector3,to:T.Vector3){const dir=to.clone().sub(from);beam.position.copy(from).add(to).multiplyScalar(.5);beam.scale.set(1,dir.length(),1);beam.quaternion.setFromUnitVectors(up,dir.normalize());}
  update(dt:number,state:any,playing:boolean,moving:boolean,sprinting:boolean,nearId?:string){
    this.time.value+=dt;const t=this.time.value;
    if(this.ready){
      const p=state.position;this.player.position.set(p.x,terrainHeight(p.x,p.z)+.035,p.z);
      this.player.getObjectByName('body')!.position.y=moving?Math.sin(t*(sprinting?16:10))*.045:Math.sin(t*1.4)*.018;
      for(const [name,sign] of [['legLeft',1],['legRight',-1]] as const){this.player.getObjectByName(name)!.rotation.x=moving?Math.sin(t*(sprinting?16:10))*.48*sign:0;}
      this.player.getObjectByName('lanternArm')!.rotation.x=Math.sin(t*(moving?8:2))*(moving?.1:.025);
      this.lanternLight.position.copy(this.player.position).add(new T.Vector3(-.45,1,.1));
      this.markers.forEach((marker,id)=>{marker.position.y=marker.userData.baseY+Math.sin(t*1.5+marker.position.x)*.1;marker.quaternion.copy(this.camera.quaternion);if(marker instanceof T.Mesh)(marker.material as T.MeshBasicMaterial).opacity=(id===nearId?1:.6);marker.scale.setScalar(id===nearId?1.2:.75);});
      this.mirrors.forEach((m,i)=>{m.rotation.y=state.mirrors[i]*Math.PI/2;this.beams[i].visible=state.mirrors[i]===[2,1,3][i];this.orientBeam(this.beams[i],m.position.clone().add(new T.Vector3(0,1.5,0)),new T.Vector3(14,terrainHeight(14,-6)+2.1,-6));});
      this.shardOrbs.forEach((m,i)=>{m.visible=!state.shards[i];m.position.y=m.userData.baseY+Math.sin(t*1.5+i)*.18;m.rotation.y=t*.5;});
      this.mothViews.forEach((m,id)=>{m.visible=t-this.pulseTime<6&&!state.moths.includes(id);m.position.y=terrainHeight(m.position.x,m.position.z)+1.2+Math.sin(t*2+m.position.x)*.15;for(let i=0;i<2;i++)m.children[i].rotation.z=Math.sin(t*14)*.6*(i===0?1:-1);});
      const elapsed=t-this.pulseTime;const pulseMat=this.pulseRing.material as T.MeshBasicMaterial;pulseMat.opacity=Math.max(0,.6-elapsed*.35);this.pulseRing.scale.setScalar(1+elapsed*6);this.pulseRing.visible=elapsed<1.8;
      const positions=this.particles.geometry.attributes.position;for(let i=0;i<positions.count;i++){positions.setY(i,positions.getY(i)-dt*.17);positions.setX(i,positions.getX(i)+dt*.025);if(positions.getY(i)<.6)positions.setY(i,8);}positions.needsUpdate=true;
      this.restoration.value=T.MathUtils.damp(this.restoration.value,state.finished?1:state.shards.filter(Boolean).length*.12,1,dt);
      this.sun.intensity=2.8+this.restoration.value*.65;this.bloom.strength=.36+this.restoration.value*.1;
      if(!playing&&!this.photo){const angle=.48+Math.sin(t*.035)*.07;this.camera.position.set(Math.sin(angle)*35,15+Math.sin(t*.1)*.3,Math.cos(angle)*35);this.target.lerp(new T.Vector3(0,2,-5),1-Math.exp(-dt*2));}
      else{
        const look=new T.Vector3(p.x,1.55+terrainHeight(p.x,p.z),p.z-3.5);this.target.lerp(look,1-Math.exp(-dt*6));
        const offset=new T.Vector3(Math.sin(this.azimuth)*Math.cos(this.elevation)*this.distance,Math.sin(this.elevation)*this.distance,Math.cos(this.azimuth)*Math.cos(this.elevation)*this.distance);
        const desired=this.target.clone().add(offset);this.camera.position.lerp(desired,1-Math.exp(-dt*5));
      }
      this.camera.lookAt(this.target);
    }
    this.renderer.info.reset();this.composer.render();
  }
  resize(){const w=innerWidth,h=innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setSize(w,h);}
  quality(level:string){this.renderer.setPixelRatio(level==='low'?1:Math.min(devicePixelRatio,level==='high'?2:1.5));this.bloom.enabled=level!=='low';this.renderer.shadowMap.enabled=level!=='low';this.resize();}
  stats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures};}
}
