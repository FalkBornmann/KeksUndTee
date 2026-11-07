// All lengths in mm, time in s; mechanical calculations convert to SI.
export const foods = {
  butterkeks: {name:'Butterkeks',length:60,thickness:6,breadth:40,D:1.8,porosity:.45,initial:.02,density:650,strength:160000,soften:9},
  zwieback: {name:'Zwieback',length:65,thickness:15,breadth:50,D:3.2,porosity:.65,initial:.02,density:350,strength:90000,soften:8},
  loeffelbiskuit: {name:'Löffelbiskuit',length:95,thickness:18,breadth:25,D:3.8,porosity:.65,initial:.03,density:330,strength:70000,soften:7},
  brownie: {name:'Brownie',length:60,thickness:30,breadth:45,D:.45,porosity:.3,initial:.25,density:800,strength:30000,soften:5},
  toast: {name:'Toastbrot',length:80,thickness:12,breadth:80,D:4.5,porosity:.7,initial:.15,density:280,strength:15000,soften:5},
  cantuccini: {name:'Cantuccini',length:65,thickness:22,breadth:25,D:.65,porosity:.35,initial:.02,density:750,strength:250000,soften:10}
};
export const liquids = {milch:{name:'Milch',factor:.65,density:1030},tee:{name:'Tee',factor:1,density:1000}};
export function validate(p) {
  const ranges={length:[10,150],thickness:[2,60],breadth:[5,120],D:[.05,15],porosity:[.1,.85],initial:[0,.8],density:[100,1500],strength:[1000,1000000],soften:[0,20],angle:[0,90],depth:[0,250],down:[0,60],hold:[0,180],up:[0,60],after:[10,1800]};
  for(const [k,[a,b]] of Object.entries(ranges)) if(!Number.isFinite(p[k])||p[k]<a||p[k]>b) throw new Error(`Ungültiger Parameter ${k}: erlaubt ${a} bis ${b}.`);
  if(!liquids[p.liquid]) throw new Error('Unbekannte Flüssigkeit.');
  if(p.down+p.hold+p.up===0) throw new Error('Mindestens eine Bewegungs- oder Haltezeit muss größer als null sein.');
}
export function position(p,t) {
  if(t<p.down) return {depth:p.depth*t/p.down,phase:'Eintauchen'};
  if(t<p.down+p.hold) return {depth:p.depth,phase:'Halten'};
  if(t<p.down+p.hold+p.up) return {depth:p.depth*(1-(t-p.down-p.hold)/p.up),phase:'Herausziehen'};
  return {depth:0,phase:'Nachverteilen'};
}
export function simulate(p, progress=()=>{}) {
  validate(p);
  const nx=p.nx || Math.max(6,Math.round(p.thickness/1.2)), ny=p.ny || Math.max(20,Math.round(p.length/1.2));
  const dx=p.thickness/nx,dy=p.length/ny,n=nx*ny, angle=p.angle*Math.PI/180, sn=Math.sin(angle),cs=Math.cos(angle);
  let s=new Float64Array(n).fill(p.initial), dose=new Float64Array(n),t=0,steps=0;
  const diff=new Float64Array(n),kappa=new Float64Array(n),fluid=liquids[p.liquid],D=p.D*fluid.factor;
  const dtMax=.22/(D*(1/dx**2+1/dy**2)),motionEnd=p.down+p.hold+p.up,end=motionEnd+p.after;
  const interval=Math.max(.15,end/350), snapshots=[];
  let nextSample=0,stable=0,broken=null,reason='Zeitlimit der Nachverteilung erreicht',lastRate=Infinity;
  const z=(x,y,depth)=>depth-(p.length-y)*cs-(p.thickness/2-x)*sn;
  const dv=dx*dy*p.breadth/1000; // ml per cell
  let initialMass=p.initial*n*dv*p.porosity*fluid.density/1000;
  const wet=(x,y,depth)=>depth>0 && z(x,y,depth)>0;
  const stressRows = new Float64Array(ny);
  const strengthRows = new Float64Array(ny);
  function mechanics(depth) {
    let worst=0, row=-1, minStrength=Infinity,force=0,moment=0;
    const area=p.thickness*p.breadth*1e-6, section=p.breadth*p.thickness**2*1e-9/6;
    for(let j=ny-1;j>=0;j--){
      moment+=force*sn*dy/1000;
      let rowForce=0,str=0;
      for(let i=0;i<nx;i++){
        const q=j*nx+i;
        const mass=(p.density+s[q]*p.porosity*fluid.density)*dv*1e-6;
        const buoyancy=wet((i+.5)*dx-p.thickness/2,(j+.5)*dy,depth)?fluid.density*dv*1e-6:0;
        rowForce+=(mass-buoyancy)*9.81;
        str+=p.strength*Math.exp(-p.soften*dose[q]);
      }
      str/=nx; minStrength=Math.min(minStrength,str);
      const stress=Math.abs((force+rowForce/2)*cs)/area+Math.abs(moment+rowForce/2*sn*dy/2000)/section;
      const ratio=stress/str;
      stressRows[j] = stress;
      strengthRows[j] = str;
      if(j>1 && ratio>worst){worst=ratio;row=j;}
      force+=rowForce;
    }
    return {ratio:worst,row,minStrength};
  }
  function sample(m) {
    let total=0,min=1,max=0;
    for(const v of s){total+=v;min=Math.min(min,v);max=Math.max(max,v);}
    snapshots.push({t,depth:position(p,t).depth,phase:position(p,t).phase,s:Float32Array.from(s),soft:Float32Array.from(dose,x=>Math.exp(-p.soften*x)),mean:total/n,min,max,uptake:total*dv*p.porosity*fluid.density/1000-initialMass,ratio:m.ratio,stressRows:stressRows.slice(),strengthRows:strengthRows.slice()});
  }
  sample(mechanics(position(p,0).depth));nextSample=interval;
  while(t<end-1e-8){
    let dt=Math.min(dtMax,end-t,nextSample-t);
    for(const boundary of [p.down,p.down+p.hold,motionEnd]) if(boundary>t+1e-8) dt=Math.min(dt,boundary-t);
    if(dt<1e-9) {nextSample+=interval;continue;}
    const depth=position(p,t+dt/2).depth;
    diff.fill(0);
    for(let q=0;q<n;q++) kappa[q]=D*(.2+.8*s[q]);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const q=j*nx+i,x=(i+.5)*dx-p.thickness/2,y=(j+.5)*dy;
      if(i+1<nx){const r=q+1, f=2*kappa[q]*kappa[r]/(kappa[q]+kappa[r])*(s[r]-s[q])/dx**2;diff[q]+=f;diff[r]-=f;}
      if(j+1<ny){const r=q+nx, f=2*kappa[q]*kappa[r]/(kappa[q]+kappa[r])*(s[r]-s[q])/dy**2;diff[q]+=f;diff[r]-=f;}
      // Wet boundary at half-cell distance; dry boundary has zero flux.
      if(i===0 && wet(-p.thickness/2,y,depth))diff[q]+=2*kappa[q]*(1-s[q])/dx**2;
      if(i===nx-1 && wet(p.thickness/2,y,depth))diff[q]+=2*kappa[q]*(1-s[q])/dx**2;
      if(j===0 && wet(x,0,depth))diff[q]+=2*kappa[q]*(1-s[q])/dy**2;
      if(j===ny-1 && wet(x,p.length,depth))diff[q]+=2*kappa[q]*(1-s[q])/dy**2;
    }
    lastRate=0;
    for(let q=0;q<n;q++){
      s[q]+=dt*diff[q];
      if(s[q]<-1e-9||s[q]>1+1e-9||!Number.isFinite(s[q]))throw new Error('Numerische Stabilitätsgrenze verletzt.');
      dose[q]+=dt*Math.max(0,s[q]-p.initial)/30;
      lastRate=Math.max(lastRate,Math.abs(diff[q]));
    }
    t+=dt;steps++;
    const m=mechanics(position(p,t).depth);
    if(p.fracture && m.ratio>=1){broken={t,row:m.row,y:(m.row+.5)*dy};reason='Erster Modellbruch – physikalische Berechnung beendet';sample(m);break;}
    if(t>=motionEnd && lastRate<1e-5)stable+=dt;else stable=0;
    if(t>=nextSample-1e-8){sample(m);nextSample+=interval;}
    if(stable>=5){reason='Flüssigkeitsverteilung nahezu unverändert';break;}
    if(steps%1000===0)progress(t/end);
  }
  if(Math.abs(snapshots.at(-1).t-t)>1e-8)sample(mechanics(position(p,t).depth));
  return {p,nx,ny,dx,dy,snapshots,broken,reason,steps,lastRate,motionEnd};
}
