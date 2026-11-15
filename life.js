// Уличные маршруты и распределённые по острову насекомые.
import * as THREE from 'three';
import { createHeroine, animateCharacter } from './models.js';
import { RESOURCE_RULES, ROAD_NETWORK, sampleZonePoint } from './zones.js';

function makeRandom(seed){let value=seed>>>0;return()=>{value=(value+0x6D2B79F5)|0;let t=Math.imul(value^(value>>>15),1|value);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function routeLoop(points){return [...points,...points.slice(0,-1).reverse()];}

export function createIslandLife(scene,groundHeight){
  const traffic=[],random=makeRandom(4417);
  const plazaLoop=ROAD_NETWORK.plazaRing;
  const routes=[
    {kind:'bike',color:0xE8836B,points:routeLoop(ROAD_NETWORK.market)},
    {kind:'bike',color:0x638FA8,points:routeLoop(ROAD_NETWORK.residential)},
    {kind:'skate',color:0xBF83A5,points:plazaLoop.slice(0,-1)},
    {kind:'skate',color:0xE4B65D,points:routeLoop(ROAD_NETWORK.farm)},
  ];
  routes.forEach((route,index)=>{
    const rig=new THREE.Group(),rider=createHeroine({dressColor:route.color,hairColor:[0x493A34,0x725340,0x342E31,0x795039][index],hairStyle:['short','ponytail','curly','bob'][index],height:.92});
    rig.add(rider);
    if(route.kind==='bike'){
      const dark=new THREE.MeshStandardMaterial({color:0x4B5052,roughness:.8}),frame=new THREE.MeshStandardMaterial({color:route.color,roughness:.7});
      for(const x of [-.58,.58]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.31,.035,6,14),dark);wheel.rotation.y=Math.PI/2;wheel.position.set(x,.36,0);rig.add(wheel);}
      const tube=(a,b,r=.035)=>{const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=new THREE.Vector3().subVectors(vb,va);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),6),frame);m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());rig.add(m);};
      tube([-.58,.36,0],[0,.72,0]);tube([0,.72,0],[.58,.36,0]);tube([-.58,.36,0],[.58,.36,0]);tube([-.06,.73,0],[.28,.73,0]);tube([.55,.38,0],[.48,.8,0]);rider.position.set(0,.73,0);rider.scale.setScalar(.62);
    }else{
      const board=new THREE.Mesh(new THREE.BoxGeometry(.48,.08,.88),new THREE.MeshStandardMaterial({color:0xD49A70,roughness:.85}));board.position.y=.12;rig.add(board);
      for(const x of [-.16,.16])for(const z of [-.27,.27]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.07,8),new THREE.MeshStandardMaterial({color:0x48545B}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.065,z);rig.add(wheel);}
      rider.scale.setScalar(.76);rider.position.y=.18;
    }
    scene.add(rig);traffic.push({...route,rig,rider,segment:index,phase:index*2,speed:route.kind==='bike'?2.1:2.7});
  });

  const insects=[];
  function addFlyingInsect(kind,point,index){
    const root=new THREE.Group(),color=kind==='bee'?(index%2?0xF4C849:0xDFAF39):kind==='dragonfly'?0x82C4D0:[0xF4A6B8,0xF3D36A,0x8AB8DD,0xCBA4D8,0xF4F0DE][index%5];
    const mat=new THREE.MeshStandardMaterial({color,roughness:.8,side:THREE.DoubleSide});
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(kind==='bee'?.045:.02,kind==='dragonfly'?.19:.11,2,5),new THREE.MeshStandardMaterial({color:kind==='bee'?0x604D37:0x584940}));body.rotation.z=Math.PI/2;root.add(body);
    const wingGeo=new THREE.SphereGeometry(1,7,5),wingScale=kind==='dragonfly'?.15:.11;
    for(const side of [-1,1]){const wing=new THREE.Mesh(wingGeo,mat);wing.scale.set(wingScale,.016,kind==='dragonfly'?.045:.08);wing.position.set(0,.04,side*.07);wing.name='wing'+side;root.add(wing);}
    scene.add(root);insects.push({kind,root,x:point.x,z:point.z,baseY:point.y,phase:index*2.31+random()*6,range:kind==='dragonfly'?1.8:.8});
  }
  let insectId=0;
  for(const [kind,zoneIds] of [['butterfly',RESOURCE_RULES.butterflies.zones],['bee',RESOURCE_RULES.bees.zones],['dragonfly',RESOURCE_RULES.dragonflies.zones]]){
    const rule=RESOURCE_RULES[kind==='butterfly'?'butterflies':kind==='bee'?'bees':'dragonflies'];let count=0,tries=0;
    while(count<rule.count&&tries<rule.count*100){tries++;const zoneId=zoneIds[tries%zoneIds.length],point=sampleZonePoint(zoneId,random,groundHeight,{margin:1,minGround:.4,maxGround:3});if(!point)continue;const tooClose=insects.some(item=>item.kind===kind&&Math.hypot(item.x-point.x,item.z-point.z)<rule.separation);if(tooClose)continue;addFlyingInsect(kind,point,insectId++);count++;}
  }

  const beetleRule=RESOURCE_RULES.beetles,beetlePoints=[];let tries=0;
  while(beetlePoints.length<beetleRule.count&&tries<beetleRule.count*100){tries++;const zoneId=beetleRule.zones[tries%beetleRule.zones.length],point=sampleZonePoint(zoneId,random,groundHeight,{margin:1,minGround:.4,maxGround:3});if(!point||beetlePoints.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<beetleRule.separation))continue;beetlePoints.push({...point,phase:random()*6});}
  const beetles=new THREE.InstancedMesh(new THREE.SphereGeometry(.075,7,5),new THREE.MeshStandardMaterial({color:0x476B45,roughness:.9}),beetlePoints.length),dummy=new THREE.Object3D();scene.add(beetles);

  const caterpillarRule=RESOURCE_RULES.caterpillars,caterpillars=[];tries=0;
  while(caterpillars.length<caterpillarRule.count&&tries<caterpillarRule.count*120){tries++;const zoneId=caterpillarRule.zones[tries%caterpillarRule.zones.length],point=sampleZonePoint(zoneId,random,groundHeight,{margin:1,minGround:.4,maxGround:3});if(!point||caterpillars.some(c=>Math.hypot(c.x-point.x,c.z-point.z)<caterpillarRule.separation))continue;
    const group=new THREE.Group();for(let j=0;j<5;j++){const s=new THREE.Mesh(new THREE.SphereGeometry(j===4?.045:.055,6,5),new THREE.MeshStandardMaterial({color:j===4?0x4D7644:0x80A64A,roughness:1}));s.position.set((j-2)*.075,.04+Math.sin(j*.8)*.018,0);group.add(s);}group.position.set(point.x,groundHeight(point.x,point.z)+.025,point.z);scene.add(group);caterpillars.push({group,x:point.x,z:point.z,phase:random()*6});
  }

  function update(dt,time){
    for(const actor of traffic){let a=actor.points[actor.segment],b=actor.points[(actor.segment+1)%actor.points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);actor.progress=(actor.progress||0)+dt*actor.speed/Math.max(.1,length);while(actor.progress>=1){actor.progress-=1;actor.segment=(actor.segment+1)%actor.points.length;a=actor.points[actor.segment];b=actor.points[(actor.segment+1)%actor.points.length];length=Math.hypot(b[0]-a[0],b[1]-a[1]);}const x=THREE.MathUtils.lerp(a[0],b[0],actor.progress),z=THREE.MathUtils.lerp(a[1],b[1],actor.progress);actor.rig.position.set(x,groundHeight(x,z),z);actor.rig.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);actor.phase+=dt*8;animateCharacter(actor.rider,actor.phase,.75);}
    for(const insect of insects){const t=time*.55+insect.phase,x=insect.x+Math.sin(t*.7)*insect.range,z=insect.z+Math.cos(t*.51)*insect.range,y=groundHeight(x,z)+(insect.kind==='dragonfly'?1.5:insect.kind==='bee'?1:.72)+Math.sin(t*2.3)*.34;insect.root.position.set(x,y,z);insect.root.rotation.y=t*.8;for(const child of insect.root.children)if(child.name.startsWith('wing'))child.rotation.z=Math.sin(t*15)*.58;}
    for(let i=0;i<beetlePoints.length;i++){const bug=beetlePoints[i],t=time*.18+bug.phase,x=bug.x+Math.sin(t)*.12,z=bug.z+Math.cos(t*.8)*.1;dummy.position.set(x,groundHeight(x,z)+.075,z);dummy.rotation.y=t;dummy.scale.setScalar(i%5===0?1.2:.8);dummy.updateMatrix();beetles.setMatrixAt(i,dummy.matrix);}beetles.instanceMatrix.needsUpdate=true;
    for(const c of caterpillars){const t=time*.34+c.phase,x=c.x+Math.sin(t)*.12,z=c.z+Math.cos(t*.8)*.1;c.group.position.set(x,groundHeight(x,z)+.025,z);c.group.rotation.y=t;}
  }
  return {update};
}
