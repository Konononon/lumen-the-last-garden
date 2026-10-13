"""Original 64-second looping score, instruments, and field sounds. No samples."""
import math, random, wave, struct, os
SR=22050
random.seed(7301)
os.makedirs('public/assets/audio',exist_ok=True)

def save(name, left, right=None):
    right=right or left
    peak=max(max(abs(v) for v in left),max(abs(v) for v in right),0.01)
    gain=min(1,0.88/peak)
    with wave.open('public/assets/audio/'+name+'.wav','wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR)
        data=bytearray()
        for l,r in zip(left,right):data.extend(struct.pack('<hh',int(max(-1,min(1,l*gain))*32767),int(max(-1,min(1,r*gain))*32767)))
        f.writeframes(data)

def tone(buf,start,dur,freq,vol,instrument='bell',pan=0):
    n=int(dur*SR);base=int(start*SR)
    for i in range(n):
        t=i/SR
        if instrument=='pad':
            envelope=math.sin(math.pi*t/dur)**1.6
            value=(math.sin(2*math.pi*freq*t)+.28*math.sin(2*math.pi*(freq*1.002)*t)+.12*math.sin(4*math.pi*freq*t))*.5*envelope
        elif instrument=='flute':
            envelope=min(t/.2,1)*min((dur-t)/.4,1)
            value=(math.sin(2*math.pi*freq*t+0.018*math.sin(t*31))+.12*math.sin(4*math.pi*freq*t))*envelope*.65
        else:
            value=(math.sin(2*math.pi*freq*t)*math.exp(-t*2)+.32*math.sin(2*math.pi*freq*2.002*t)*math.exp(-t*3.7)+.12*math.sin(2*math.pi*freq*3*t)*math.exp(-t*7))*min(t/.009,1)
        index=(base+i)%len(buf[0]);buf[0][index]+=value*vol*(1-pan*.35);buf[1][index]+=value*vol*(1+pan*.35)

def hz(midi):return 440*2**((midi-69)/12)
length=64;music=([0.0]*(SR*length),[0.0]*(SR*length))
chords=[[50,57,62,65],[46,53,58,62],[53,60,65,69],[48,55,60,64]]
for bar in range(8):
    chord=chords[bar%4]
    for note in chord:tone(music,bar*8,10,hz(note-12),.037,'pad')
    for i,note in enumerate(chord+[chord[2]+12,chord[1]+12,chord[3],chord[1]]):tone(music,bar*8+i,3.5,hz(note+12),.065,'bell',math.sin(i*2))
melody=[74,77,81,79,77,74,72,69,70,74,77,74,72,69,67,69]
for i,note in enumerate(melody):tone(music,i*3.75+2,2.8,hz(note),.075,'flute',-.25)
for channel in music:
    original=channel[:]
    for offset,level in [(int(.37*SR),.22),(int(.73*SR),.11),(int(1.11*SR),.06)]:
        for i in range(len(channel)):channel[i]+=original[(i-offset)%len(channel)]*level
save('moon-garden',*music)
for name,note in [('bell-low',62),('bell-mid',65),('bell-high',69),('interact',81),('memory',86)]:
    buf=([0.0]*(SR*3),[0.0]*(SR*3));tone(buf,0,3,hz(note),.48);save(name,*buf)
buf=([0.0]*(SR*6),[0.0]*(SR*6))
for i,note in enumerate([62,65,69,74,77,81]):tone(buf,i*.19,4.5,hz(note),.22,'bell',math.sin(i))
save('awaken',*buf)
wind=[];stream=[];smooth=0
for i in range(SR*8):
    t=i/SR;smooth=smooth*.98+(random.random()*2-1)*.02
    wind.append(smooth*.28*(.8+.2*math.sin(t*math.pi/4)))
    stream.append((random.random()*2-1)*.055+math.sin(t*700+math.sin(t*130)*4)*.007)
save('wind',wind);save('stream',stream)
steps=[(random.random()*2-1)*math.exp(-i/SR*55)*.23 for i in range(int(SR*.18))]
save('footstep',steps)
buf=([0.0]*(SR*3),[0.0]*(SR*3))
for i,note in enumerate([74,81,86,93]):tone(buf,i*.075,2.6,hz(note),.17,'bell',math.sin(i*2))
save('pulse',*buf)
print('Created 11 original WAV assets, including a 64-second seamless fantasy score.')
