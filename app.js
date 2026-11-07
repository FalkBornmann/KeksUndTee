import {foods} from './model.js';
import {saturationProfile} from './profile.js';
const $=id=>document.getElementById(id),fmt=(n,d=1)=>n.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const ids=['length','thickness','breadth','D','porosity','initial','density','strength','soften','angle','depth','down','hold','up','after'];
let result=null, worker=null, playing=false,previousTime=0,playTime=0,fall=0;
for(const [key,f] of Object.entries(foods)){const o=document.createElement('option');o.value=key;o.textContent=f.name+' · Lehrdatensatz';$('food').append(o);}
function foodDefaults(){for(const id of ids)if(id in foods[$('food').value])$(id).value=foods[$('food').value][id];dirty();}
function parameters(){return {...Object.fromEntries(ids.map(id=>[id,Number($(id).value)])),food:$('food').value,liquid:$('liquid').value,fracture:$('fracture').checked};}
function dirty(){if(result){$('status').textContent='Eingaben geändert – bitte neu berechnen. Angezeigt bleibt der letzte Durchlauf.';$('status').className='';}}
function stop(){playing=false;$('play').textContent='▶ Abspielen';}
function calculate(){
  if(!$('settings').reportValidity())return;
  stop();worker?.terminate();$('status').className='';$('status').textContent='Berechnung läuft …';$('calculate').textContent='Neu berechnen';
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onerror=()=>{$('status').textContent='Berechnung konnte nicht gestartet werden. Bitte über einen Webserver öffnen.';$('status').className='error';worker?.terminate();};
  worker.onmessage=e=>{
    if(e.data.error){$('status').textContent=e.data.error;$('status').className='error';worker.terminate();return;}
    if('progress'in e.data){$('status').textContent=`Berechnung läuft … ${Math.round(e.data.progress*100)} %`;return;}
    result=e.data.result;worker.terminate();worker=null;fall=0;$('timeline').max=result.snapshots.length-1;$('timeline').value=0;
    for (const id of ['profile-offset', 'profile-slider']) {
      document.getElementById(id).max = result.p.thickness;
      document.getElementById(id).value = result.p.thickness / 2;
      document.getElementById(id).disabled = false;
    }
    document.getElementById('profile-center').disabled = false;
    for(const id of ['play','start','end','csv','field','png'])$(id).disabled=false;
    $('status').textContent=`Berechnet · ${result.nx} × ${result.ny} Zellen · ${result.steps.toLocaleString('de-DE')} Zeitschritte`;
    $('result-note').textContent=result.reason+`. Ende bei ${fmt(result.snapshots.at(-1).t)} s. `+(result.broken?'Bruchzeit ist eine Modellannahme; Fallbewegung nur illustrativ.':result.reason.startsWith('Zeitlimit')?'Das Kriterium für nahezu unveränderte Verteilung wurde nicht erreicht.':'Das Kriterium betrifft die Flüssigkeitsverteilung, nicht die weitere Festigkeitsabnahme.');
    $('result-note').className='notice'+(result.broken||result.reason.startsWith('Zeitlimit')?' warn':'');render();
  };worker.postMessage(parameters());
}
function frame(){return result?.snapshots[Number($('timeline').value)];}
function mix(a,b,s){return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*Math.min(1,Math.max(0,s)))).join(',')})`;}
function render(){if(!result)return;const f=frame();$('clock').textContent=`t = ${fmt(f.t)} s`;$('phase').textContent=result.broken&&f===result.snapshots.at(-1)?'Modellbruch':f.phase;
  [...$('phases').children].forEach(x=>x.classList.toggle('active',x.textContent===f.phase));$('mean').textContent=fmt(f.mean*100)+' %';$('uptake').textContent=fmt(f.uptake,2)+' g';$('risk').textContent=fmt(f.ratio,2)+(result.p.fracture?'':' · ohne Bruch');
  $('scene').setAttribute('aria-label',`${$('phase').textContent}, ${fmt(f.t)} Sekunden. Sättigung ${fmt(f.mean*100)} Prozent; Aufnahme ${fmt(f.uptake,2)} Gramm.`);
  const soft=$('view').value==='soft';$('legend-start').textContent=soft?'aufgeweicht · 0 %':'trocken · 0 %';$('legend-end').textContent=soft?'Anfangsfestigkeit · 100 %':'gesättigt · 100 %';$('gradient').style.background=soft?'linear-gradient(90deg,#bc5448,#e8c692)':'linear-gradient(90deg,#e8c692,#087f83)';drawScene();drawChart();drawProfile();
}
function drawScene(){
  if(!result)return;const c=$('scene').getContext('2d'),f=frame(),p=result.p,W=1100,H=520,a=p.angle*Math.PI/180,sn=Math.sin(a),cs=Math.cos(a),vert=p.length*cs+p.thickness*sn,hor=p.length*sn+p.thickness*cs;
  c.clearRect(0,0,W,H);c.fillStyle='#f8faf9';c.fillRect(0,0,W,H);
  const scale=Math.min(5.3,380/(vert+p.depth+20),650/Math.max(hor,30)),waterY=70+vert*scale;
  c.fillStyle=p.liquid==='milch'?'#e4eeec':'#eedec3';c.fillRect(0,waterY,W,H-waterY);c.strokeStyle='#80a9aa';c.lineWidth=2;c.beginPath();c.moveTo(0,waterY);c.lineTo(W,waterY);c.stroke();
  c.fillStyle='#526e79';c.font='16px system-ui';c.fillText(p.liquid==='milch'?'MILCH':'TEE',30,waterY+30);c.font='13px system-ui';c.fillText('Flüssigkeitsspiegel',30,waterY-13);
  const originX=W/2+p.length*sn*scale/2,originY=waterY+(f.depth-p.length*cs-p.thickness*sn/2)*scale;
  const xy=(x,y)=>[originX+scale*(x*cs-y*sn),originY+scale*(x*sn+y*cs)];
  const point=(x,y)=>{const v=xy(x,y);c.lineTo(...v);};
  const soft=$('view').value==='soft',atBreak=result.broken&&f===result.snapshots.at(-1),cut=result.broken?.row;
  for(let j=0;j<result.ny;j++)for(let i=0;i<result.nx;i++){
    const q=j*result.nx+i; c.fillStyle=soft?mix([188,84,72],[232,198,146],f.soft[q]):mix([232,198,146],[8,127,131],f.s[q]);
    const x=i*result.dx-p.thickness/2,y=j*result.dy;
    c.save();if(atBreak&&j>=cut)c.translate(fall*35,fall*75);
    c.beginPath();point(x,y);point(x+result.dx,y);point(x+result.dx,y+result.dy);point(x,y+result.dy);c.closePath();c.fill();c.restore();
  }
  if(!atBreak){c.strokeStyle='#66543a';c.lineWidth=2;c.beginPath();point(-p.thickness/2,0);point(p.thickness/2,0);point(p.thickness/2,p.length);point(-p.thickness/2,p.length);c.closePath();c.stroke();}
  // Draw each part of the selected line in its own material coordinates.
  const profileX = p.thickness / 2 - Number($('profile-offset').value);
  const drawProfileSegment = (from, to, detached) => {
    c.save();
    if (detached) c.translate(fall * 35, fall * 75);
    c.beginPath();
    c.moveTo(...xy(profileX, from));
    c.lineTo(...xy(profileX, to));
    c.strokeStyle = '#ffffff';
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = '#7942a0';
    c.lineWidth = 2.5;
    c.setLineDash([7, 4]);
    c.stroke();
    c.restore();
  };
  if (atBreak) {
    drawProfileSegment(0, cut * result.dy, false);
    drawProfileSegment(cut * result.dy, p.length, true);
  } else {
    drawProfileSegment(0, p.length, false);
  }
  c.fillStyle = '#7942a0';
  c.font = '13px system-ui';
  c.fillText('Violett gestrichelt: ausgewählte Profillinie', 30, H - 65);
  const top=xy(0,0);c.fillStyle='#173c48';c.beginPath();c.arc(...top,6,0,Math.PI*2);c.fill();c.font='14px system-ui';c.fillText('Haltestelle',top[0]-100,top[1]-18);
  c.strokeStyle='#738b95';c.setLineDash([5,5]);c.beginPath();c.moveTo(...top);c.lineTo(top[0],top[1]+55);c.stroke();c.setLineDash([]);
  c.fillStyle='#173c48';c.fillText(`${fmt(p.angle,0)}° zur Vertikalen`,W-220,35);c.fillText(`${foods[p.food].name} · ${fmt(p.length,0)} × ${fmt(p.thickness,0)} mm`,30,35);
  c.fillStyle='#526e79';c.font='13px system-ui';c.fillText('Idealisierter Längsschnitt · Breite außerhalb des Bildes',30,57);
  const bottom=xy(p.thickness/2,p.length);if(f.depth>0){const lineX=Math.min(W-80,bottom[0]+90);c.strokeStyle='#708b95';c.beginPath();c.moveTo(lineX,waterY);c.lineTo(lineX,bottom[1]);c.moveTo(lineX-5,waterY);c.lineTo(lineX+5,waterY);c.moveTo(lineX-5,bottom[1]);c.lineTo(lineX+5,bottom[1]);c.stroke();c.fillText(`h = ${fmt(f.depth)} mm`,lineX+10,(waterY+bottom[1])/2);}
  c.strokeStyle='#173c48';c.lineWidth=2;c.beginPath();c.moveTo(32,H-28);c.lineTo(32+10*scale,H-28);c.stroke();c.fillText('10 mm',32,H-40);
  if(atBreak){c.strokeStyle='#b83c29';c.lineWidth=4;c.beginPath();point(-p.thickness/2,cut*result.dy);point(p.thickness/2,cut*result.dy);c.stroke();c.fillStyle='#a33224';c.font='bold 16px system-ui';c.fillText(`MODELLBRUCH bei ${fmt(f.t)} s`,W-330,H-50);c.font='12px system-ui';c.fillText('Fallbewegung nur illustrativ · Rechnung beendet',W-330,H-28);}
}
function drawChart(){
  const c=$('chart').getContext('2d'),W=1100,H=290,L=65,R=65,T=30,B=50,ss=result.snapshots,maxT=Math.max(1,ss.at(-1).t),maxM=Math.max(.1,...ss.map(f=>f.uptake))*1.1;
  c.clearRect(0,0,W,H);c.font='12px system-ui';
  for(let i=0;i<=4;i++){let y=T+(H-T-B)*i/4;c.strokeStyle='#e2e9eb';c.beginPath();c.moveTo(L,y);c.lineTo(W-R,y);c.stroke();c.fillStyle='#087f83';c.fillText(fmt(maxM*(1-i/4),2),5,y+4);c.fillStyle='#b46e32';c.fillText(fmt(100*(1-i/4),0),W-R+12,y+4);let x=L+(W-L-R)*i/4;c.fillStyle='#526e79';c.fillText(fmt(maxT*i/4,0),x-6,H-25);}
  c.fillStyle='#526e79';c.fillText('g',L-35,15);c.fillText('%',W-R+12,15);c.fillText('Zeit [s]',W/2-20,H-3);
  const X=t=>L+t/maxT*(W-L-R),Y=v=>H-B-v*(H-T-B);
  for(const [key,col,scale]of[['uptake','#087f83',maxM],['mean','#b46e32',1]]){c.beginPath();c.strokeStyle=col;c.lineWidth=2.5;ss.forEach((f,i)=>i?c.lineTo(X(f.t),Y(f[key]/scale)):c.moveTo(X(f.t),Y(f[key]/scale)));c.stroke();}
  c.strokeStyle='#274755';c.setLineDash([4,4]);c.beginPath();c.moveTo(X(frame().t),T);c.lineTo(X(frame().t),H-B);c.stroke();c.setLineDash([]);
}
function drawProfile() {
  const snapshot = frame();
  const distance = Number($('profile-offset').value);
  const profile = saturationProfile(result, snapshot, distance);
  const thickness = result.p.thickness;
  const central = Math.abs(distance - thickness / 2) < 1e-8;
  $('profile-position').textContent = central ? 'Mittelachse' : `${fmt(distance, 2)} mm von der unteren Längskante`;
  $('profile-time').textContent = `t = ${fmt(snapshot.t)} s · Abstand ${fmt(distance, 2)} mm · Länge ${fmt(result.p.length)} mm`;
  $('profile-chart').setAttribute('aria-label', `Sättigungsprofil bei ${fmt(snapshot.t)} Sekunden, ${fmt(distance, 2)} Millimeter von der unteren Längskante.`);
  const context = $('profile-chart').getContext('2d');
  const width = 1100, height = 310;
  const left = 80, right = 35, top = 30, bottom = 65;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = position => left + position / result.p.length * plotWidth;
  const y = saturation => top + (1 - saturation) * plotHeight;
  context.clearRect(0, 0, width, height);
  context.font = '13px system-ui';
  for (let tick = 0; tick <= 4; tick++) {
    const fraction = tick / 4;
    context.strokeStyle = '#e2e9eb';
    context.beginPath();
    context.moveTo(left, y(fraction));
    context.lineTo(width - right, y(fraction));
    context.stroke();
    context.fillStyle = '#526e79';
    context.textAlign = 'right';
    context.fillText(fmt(fraction * 100, 0), left - 12, y(fraction) + 4);
    context.textAlign = 'center';
    context.fillText(fmt(fraction * result.p.length), x(fraction * result.p.length), height - bottom + 22);
  }
  context.textAlign = 'left';
  context.fillText('Sättigung [%]', left, 17);
  context.textAlign = 'center';
  context.fillText('Ort y [mm] · Haltestelle → freies Ende', width / 2, height - 12);
  context.beginPath();
  for (const [index, sample] of profile.entries()) {
    if (index === 0) context.moveTo(x(sample.position), y(sample.saturation));
    else context.lineTo(x(sample.position), y(sample.saturation));
  }
  context.strokeStyle = '#7942a0';
  context.lineWidth = 3;
  context.stroke();
}

function moveProfile(source) {
  if (!result || !source.validity.valid || source.value === '') return;
  const distance = Math.max(0, Math.min(result.p.thickness, Number(source.value)));
  $('profile-offset').value = distance;
  $('profile-slider').value = distance;
  render();
}
$('profile-offset').addEventListener('input', event => moveProfile(event.target));
$('profile-slider').addEventListener('input', event => moveProfile(event.target));
$('profile-center').onclick = () => {
  $('profile-offset').value = result.p.thickness / 2;
  moveProfile($('profile-offset'));
};
function download(data,type,name){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function metadata(){return '# Keks und Tee v1 – illustrative Lehrsimulation; keine validierten Material- oder Bruchdaten\n# Parameter: '+JSON.stringify(result.p)+'\n# '+result.reason+'\n# Dezimaltrennzeichen: Punkt; Spaltentrenner: Semikolon\n';}
$('settings').addEventListener('submit',e=>{e.preventDefault();calculate();});$('settings').addEventListener('input',dirty);$('food').addEventListener('change',foodDefaults);
$('reset').onclick=()=>{const food=$('food').value;$('settings').reset();$('food').value=food;foodDefaults();calculate();};
$('example').onclick=()=>{$('food').value='brownie';foodDefaults();$('angle').value=60;$('depth').value=35;$('hold').value=30;calculate();};
$('timeline').oninput=()=>{stop();fall=0;render();};$('view').onchange=render;
$('start').onclick=()=>{stop();fall=0;$('timeline').value=0;render();};$('end').onclick=()=>{stop();fall=0;$('timeline').value=$('timeline').max;render();};
$('play').onclick=()=>{if(playing){stop();return;}if($('timeline').value===$('timeline').max)$('timeline').value=0;playing=true;fall=0;playTime=frame().t;previousTime=performance.now();$('play').textContent='Ⅱ Pause';requestAnimationFrame(animate);};
function animate(now){if(!playing)return;const dt=Math.min(.2,(now-previousTime)/1000);previousTime=now;playTime+=dt*Number($('speed').value);let idx=Number($('timeline').value);while(idx<result.snapshots.length-1&&result.snapshots[idx+1].t<=playTime)idx++;$('timeline').value=idx;render();if(idx===result.snapshots.length-1){if(result.broken&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&fall<1){fall=Math.min(1,fall+dt);drawScene();}else {stop();return;}}requestAnimationFrame(animate);}
$('csv').onclick=()=>download(metadata()+'time_s;phase;depth_mm;uptake_g;mean_saturation;min_saturation;max_saturation;stress_strength_ratio\n'+result.snapshots.map(f=>[f.t,f.phase,f.depth,f.uptake,f.mean,f.min,f.max,f.ratio].join(';')).join('\n'),'text/csv;charset=utf-8','keks-und-tee-zeitverlauf.csv');
$('field').onclick=()=>{let rows=[];const f=frame();for(let j=0;j<result.ny;j++)for(let i=0;i<result.nx;i++){const q=j*result.nx+i;rows.push([(i+.5)*result.dx-result.p.thickness/2,(j+.5)*result.dy,f.s[q],f.soft[q]].join(';'));}download(metadata()+`# Zeitpunkt_s: ${f.t}\nx_mm;y_mm;saturation;relative_strength\n`+rows.join('\n'),'text/csv;charset=utf-8','keks-und-tee-querschnitt.csv');};
$('png').onclick=()=>$('scene').toBlob(blob=>{if(blob)download(blob,'image/png','keks-und-tee-querschnitt.png');});
foodDefaults();calculate();
