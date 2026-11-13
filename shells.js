// shells.js — физика ракушек: падают, подпрыгивают и спокойно лежат на песке
import * as THREE from 'three';
const WANT = 12;
const PICKUP_R = 1.35;
function makeRandom(seed) {
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
}
export function createShells({ scene, groundHeight, economy }) {
  const rand=makeRandom(2024), spots=[];
  for(let i=0;i<4000&&spots.length<WANT;i++){
    const a=rand()*Math.PI*2,r=14+rand()*18,x=Math.cos(a)*r,z=Math.sin(a)*r,g=groundHeight(x,z);
    if(g<0.1||g>0.38)continue;
    if(Math.abs(x)<3&&z>8)continue;
    if(spots.some(s=>Math.hypot(s.x-x,s.z-z)<5))continue;
    spots.push({x,z,y:g});
  }
  const geo=new THREE.SphereGeometry(0.22,10,7);
  const mat=new THREE.MeshStandardMaterial({color:0xFFE3D6,emissive:0xF4A6B8,emissiveIntensity:0.14,roughness:0.78,flatShading:true});
  const items=spots.map((s,i)=>{
    const mesh=new THREE.Mesh(geo,mat);mesh.name='ракушка-'+i;mesh.scale.set(1,0.5,1.15);
    mesh.position.set(s.x,s.y+0.8+rand()*0.7,s.z);
    mesh.rotation.set((rand()-0.5)*0.8,rand()*Math.PI*2,(rand()-0.5)*0.8);
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
    return {...s,mesh,velocityY:-0.25-rand()*0.8,spin:(rand()-0.5)*3,settled:false,ready:true};
  });
  let nearby=null;
  function update(dt,p){
    dt=Math.min(dt,0.05);nearby=null;let best=PICKUP_R;
    for(const item of items){
      if(!item.ready)continue;
      if(!item.settled){
        item.velocityY-=9.8*dt;
        item.mesh.position.y+=item.velocityY*dt;
        item.mesh.rotation.x+=item.spin*dt;
        item.mesh.rotation.z+=item.spin*dt*0.7;
        const floor=item.y+0.11;
        if(item.mesh.position.y<=floor){
          item.mesh.position.y=floor;
          if(Math.abs(item.velocityY)>0.75){item.velocityY=-item.velocityY*0.2;item.spin*=0.38;}
          else{item.velocityY=0;item.spin=0;item.settled=true;item.mesh.rotation.x=0;item.mesh.rotation.z=0;}
        }
      }
      const d=Math.hypot(p.x-item.x,p.z-item.z);
      if(item.settled&&d<best){best=d;nearby=item;}
    }
    return nearby?{label:'Взять ракушку',type:'shell'}:null;
  }
  function collect(){
    if(!nearby||!nearby.ready||!nearby.settled)return null;
    const item=nearby;nearby=null;
    const roll=Math.random(),id=roll<0.025?'starShell':roll<0.22?'pinkShell':'shell';
    if(!economy.add(id))return {error:'Сумка заполнена'};
    item.ready=false;scene.remove(item.mesh);
    setTimeout(()=>{item.ready=true;item.settled=false;item.velocityY=-0.2;item.spin=0;item.mesh.position.set(item.x,item.y+0.9,item.z);scene.add(item.mesh);},180000);
    return {item:id};
  }
  return {update,collect};
}
