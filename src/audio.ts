export class GardenAudio {
  context:AudioContext|null=null;
  master:GainNode|null=null;
  buffers=new Map<string,AudioBuffer>();
  muted=false;
  started=false;
  paused=false;
  async start(){
    if(this.started){await this.context?.resume();return;}
    this.started=true;this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.muted?0:.65;this.master.connect(this.context.destination);
    await this.context.resume();
    const names=['moon-garden','wind','stream','bell-low','bell-mid','bell-high','interact','memory','awaken','footstep','pulse'];
    await Promise.all(names.map(async name=>{try{const res=await fetch(`/assets/audio/${name}.wav`);this.buffers.set(name,await this.context!.decodeAudioData(await res.arrayBuffer()));}catch{console.warn(`Sound unavailable: ${name}`);}}));
    this.play('moon-garden',.6,true);this.play('wind',.75,true);this.stream=this.play('stream',.2,true);
  }
  stream:GainNode|null=null;
  play(name:string,volume=.6,loop=false){
    if(!this.context||!this.master||!this.buffers.has(name))return null;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers.get(name)!;source.loop=loop;gain.gain.value=volume;source.connect(gain);gain.connect(this.master);source.start();return gain;
  }
  setMuted(value:boolean){this.muted=value;if(this.master)this.master.gain.setTargetAtTime(value?0:this.paused?.28:.65,this.context!.currentTime,.1);}
  setPaused(value:boolean){this.paused=value;if(this.context&&this.master){void this.context.resume();this.master.gain.setTargetAtTime(this.muted?0:value?.28:.65,this.context.currentTime,.4);}}
  update(distance:number){if(this.stream&&this.context)this.stream.gain.setTargetAtTime(Math.max(.03,.35-distance*.025),this.context.currentTime,.4);}
}
