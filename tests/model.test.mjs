import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate,foods,position} from '../model.js';
const base={...foods.butterkeks,food:'butterkeks',liquid:'milch',angle:30,depth:30,down:2,hold:12,up:2,after:60,fracture:false};
test('Vier Phasen und kontinuierliche Bewegung',()=>{
 assert.equal(position(base,1).depth,15);assert.equal(position(base,5).phase,'Halten');assert.equal(position(base,15).depth,15);assert.equal(position(base,16).phase,'Nachverteilen');
 const instant={...base,down:0,up:0};assert.equal(position(instant,0).depth,30);assert.equal(position(instant,12).depth,0);
});
test('Ohne Kontakt bleibt S konstant und es wird keine Masse aufgenommen',()=>{
 const r=simulate({...base,depth:0});assert.match(r.reason,/nahezu/);assert.ok(r.snapshots.at(-1).t>=r.motionEnd+5-1e-8);
 for(const f of r.snapshots){assert.ok(Math.abs(f.uptake)<1e-10);assert.ok(Math.abs(f.mean-base.initial)<1e-12);}
});
test('Sättigung bleibt beschränkt; Aufnahme monoton im Bad; Masse nach Herausziehen erhalten',()=>{
 const r=simulate(base);const tail=r.snapshots.filter(f=>f.t>=r.motionEnd);assert.ok(tail.length>5);
 for(const f of r.snapshots){assert.ok(f.min>=0&&f.max<=1);assert.ok(Number.isFinite(f.ratio));}
 for(let i=1;i<r.snapshots.length;i++)assert.ok(r.snapshots[i].uptake>=r.snapshots[i-1].uptake-1e-9);
 const first=tail[0];for(const f of tail)assert.ok(Math.abs(f.uptake-first.uptake)<1e-9);
 assert.ok(tail.at(-1).max-tail.at(-1).min<first.max-first.min);
});
test('Winkel und Tiefe beeinflussen die Aufnahme',()=>{
 const mass=p=>simulate({...base,after:10,...p}).snapshots.at(-1).uptake;
 assert.ok(mass({depth:40})>mass({depth:10}));assert.ok(Math.abs(mass({angle:0})-mass({angle:80}))>.01);
});
test('Gitterverfeinerung verändert integrierte Aufnahme nur begrenzt',()=>{
 const p={...base,angle:0,depth:30,down:0,up:0,hold:10,after:10};
 const coarse=simulate({...p,nx:12,ny:60}).snapshots.at(-1).uptake;
 const fine=simulate({...p,nx:24,ny:120}).snapshots.at(-1).uptake;
 assert.ok(Math.abs(coarse-fine)/fine<.05,`${coarse} vs ${fine}`);
});
test('Bruch ist optional und beendet die Rechnung beim ersten Ereignis',()=>{
 const p={...base,angle:90,strength:1000,soften:20,hold:120,fracture:true};const r=simulate(p);
 assert.ok(r.broken);assert.ok(r.snapshots.at(-1).ratio>=1);assert.equal(r.snapshots.at(-1).t,r.broken.t);
 const no=simulate({...p,fracture:false,after:10});assert.equal(no.broken,null);
});
test('Alle sechs Speisen liefern endliche Ergebnisse',()=>{for(const [food,p]of Object.entries(foods)){const r=simulate({...base,...p,food,after:10});assert.ok(r.snapshots.at(-1).uptake>0);}});
test('Ungültige Eingaben werden abgewiesen',()=>{assert.throws(()=>simulate({...base,D:NaN}));assert.throws(()=>simulate({...base,down:0,up:0,hold:0}));});
test('Diagrammwerte und Modellbruch verwenden dieselbe Festigkeit und Belastung',()=>{
 const r=simulate({...base,angle:90,strength:1000,soften:20,hold:120,fracture:true});
 for(const snapshot of r.snapshots){
   const ratios=Array.from(snapshot.stressRows,(stress,row)=>stress/snapshot.strengthRows[row]).slice(2);
   assert.equal(Math.max(...ratios),snapshot.ratio);
 }
 const last=r.snapshots.at(-1);
 assert.ok(last.stressRows[r.broken.row]>=last.strengthRows[r.broken.row]);
});
