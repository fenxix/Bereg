// Планировка исходного острова (координаты автора). В игре весь план умножен на WORLD_SCALE.
export const WORLD_SCALE=1.5;

export const WORLD_ZONES={
  plaza:{id:'plaza',name:'Главная площадь',x:0,z:0,r:8,color:'#E8836B'},
  market:{id:'market',name:'Торговая улица',x:22,z:-8,r:11,color:'#E8C27A'},
  quarter:{id:'quarter',name:'Жилой квартал',x:-18,z:13,r:14,color:'#C98BB9'},
  harbor:{id:'harbor',name:'Рыбацкая гавань',x:0,z:44,r:14,color:'#6EC1D6'},
  meadow:{id:'meadow',name:'Цветочный луг',x:29,z:10,r:13,color:'#A8D08D'},
  pines:{id:'pines',name:'Сосновый лес',x:-27,z:-22,r:13,color:'#7FB069'},
  lighthouse:{id:'lighthouse',name:'Маяк на скале',x:-8,z:-39,r:9,color:'#FFF4E3'},
  cove:{id:'cove',name:'Тихая бухта',x:36,z:27.5,r:13,color:'#F4A6B8'},
};

const scaleZone=z=>({...z,x:z.x*WORLD_SCALE,z:z.z*WORLD_SCALE,radius:z.r*WORLD_SCALE});
export const ZONES=Object.values(WORLD_ZONES).map(scaleZone);
export const BASE_ZONES=Object.values(WORLD_ZONES).map(z=>({...z,radius:z.r}));
export const zoneById=id=>WORLD_ZONES[id]||null;

// Осевая геометрия исходных мощёных маршрутов. Дороги связывают площадь с каждой зоной.
export const PATHS=[
  {id:'plaza-ring',columns:2,points:[[5.2,0],[3.68,3.68],[0,5.2],[-3.68,3.68],[-5.2,0],[-3.68,-3.68],[0,-5.2],[3.68,-3.68],[5.2,0]]},
  {id:'to-market',columns:3,points:[[3.68,-3.68],[7,-4],[13,-7],[19,-8],[24,-9]]},
  {id:'to-quarter',columns:2,points:[[-3.68,3.68],[-7,7],[-12,11],[-18,13],[-24,13]]},
  {id:'to-pines',columns:2,points:[[-3.68,-3.68],[-8,-9],[-15,-15],[-22,-20],[-28,-22],[-34,-24]]},
  {id:'to-meadow',columns:2,points:[[3.68,3.68],[9,5],[15,7],[22,9],[29,10]]},
  {id:'to-harbor',columns:3,points:[[0,5.2],[0,11],[0,18],[0,25],[0,32],[0,40],[0,45]]},
  {id:'to-lighthouse',columns:2,points:[[-22,-20],[-18,-25],[-13,-32],[-9,-38]]},
  {id:'to-cove',columns:2,points:[[22,9],[26,13],[30,17],[34,20],[36,22]]},
];

const scaledRoads=Object.fromEntries(PATHS.map(path=>[path.id,path.points.map(([x,z])=>[x*WORLD_SCALE,z*WORLD_SCALE])]));
export const ROAD_NETWORK={...scaledRoads,plazaRing:scaledRoads['plaza-ring'],market:scaledRoads['to-market'],residential:scaledRoads['to-quarter'],grove:scaledRoads['to-pines'],farm:scaledRoads['to-meadow'],harbor:scaledRoads['to-harbor'],lighthouse:scaledRoads['to-lighthouse'],cove:scaledRoads['to-cove']};

export const RESOURCE_RULES={
  shells:{zones:['harbor','cove'],count:12,separation:2.4,height:[.02,.4]},
  butterflies:{zones:['pines','meadow','cove','market'],count:20,separation:3.5},
  beetles:{zones:['pines','lighthouse','quarter'],count:26,separation:2.2},
  caterpillars:{zones:['meadow','pines'],count:16,separation:2.8},
  bees:{zones:['meadow','cove'],count:10,separation:2.5},
  dragonflies:{zones:['harbor','cove'],count:8,separation:3},
};

export function getZoneAt(x,z){return ZONES.find(zone=>Math.hypot(x-zone.x,z-zone.z)<=zone.radius)||null;}

// Ближайшее расстояние до осевой линии любой главной дорожки.
function segmentDistance(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(px-a[0]-dx*t,pz-a[1]-dz*t);}
export function distToPaths(x,z){let best=Infinity;for(const path of PATHS)for(let i=1;i<path.points.length;i++)best=Math.min(best,segmentDistance(x,z,path.points[i-1],path.points[i]));return best;}

export function sampleZonePoint(zoneId,rand,groundHeight,{margin=1,minGround=.2,maxGround=4,avoid=[]}={}){
  const zone=ZONES.find(z=>z.id===zoneId);if(!zone)return null;
  for(let attempt=0;attempt<180;attempt++){
    const a=rand()*Math.PI*2,r=Math.sqrt(rand())*Math.max(0,zone.radius-margin),x=zone.x+Math.cos(a)*r,z=zone.z+Math.sin(a)*r,y=groundHeight(x,z);
    if(y<minGround||y>maxGround||avoid.some(p=>Math.hypot(p.x-x,p.z-z)<p.distance))continue;
    return {x,z,y};
  }
  return null;
}

export function buildRoadGraph(){
  const nodes=[],edges=[],getNode=point=>{let i=nodes.findIndex(n=>Math.hypot(n[0]-point[0],n[1]-point[1])<.05);if(i<0){i=nodes.length;nodes.push(point);}return i;};
  for(const path of PATHS)for(let i=1;i<path.points.length;i++){const a=getNode(path.points[i-1]),b=getNode(path.points[i]),cost=Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1])*WORLD_SCALE;edges.push([a,b,cost],[b,a,cost]);}
  const unique=[],seen=new Set();for(const e of edges){const k=e[0]+':'+e[1];if(!seen.has(k)){seen.add(k);unique.push(e);}}
  return {nodes:nodes.map(([x,z])=>[x*WORLD_SCALE,z*WORLD_SCALE]),edges:unique};
}

// Стабильное размещение городских объектов. Рандом ограничен зоной, уклоном,
// занятыми участками и отступом от путей — модели не попадают на дороги и друг в друга.
export function layoutZones({groundHeight,rand,pier,blocked=()=>false,reserved=[]}){
  const layout={houses:[],hut:null,lighthouse:null,lamps:[],boats:[],trees:[],flowers:[],stalls:[],crates:[],barrels:[],nets:[],fences:[],mailboxes:[],mushrooms:[],rocks:[],loungers:[],umbrellas:[],benches:[],steps:[],swing:null,colliders:[],doorPaths:[]};
  const occupied=[];
  const pointInZone=(zoneId,options={})=>{const zone=zoneById(zoneId);for(let i=0;i<700;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*(zone.r-(options.margin||1)),x=zone.x+Math.cos(a)*r,z=zone.z+Math.sin(a)*r,y=groundHeight(x,z);if(y<(options.minGround??.45)||y>(options.maxGround??8))continue;if(options.pathMin!==undefined&&distToPaths(x,z)<options.pathMin)continue;if(options.pathMax!==undefined&&distToPaths(x,z)>options.pathMax)continue;if(blocked(x,z)||reserved.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+(options.reserve||0)))continue;if(occupied.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+(options.separation||0)))continue;return{x,z,y};}return null;};
  const occupy=(point,r)=>occupied.push({x:point.x,z:point.z,r});
  const addMany=(zoneId,count,separation,dest,make,options={})=>{let placed=0;for(let i=0;i<count*100&&placed<count;i++){const p=pointInZone(zoneId,{...options,separation});if(!p)break;const item=make(p,placed);dest.push(item);if(options.collider)layout.colliders.push(options.collider(p,item));occupy(p,options.occupyRadius??separation*.45);placed++;}return placed;};
  const nearestPath=(x,z)=>{let best={x:0,z:0,distance:Infinity};for(const path of PATHS)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1))),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.distance)best={x:px,z:pz,distance:d};}return best;};

  // Дома в жилом квартале располагаются рядом с центральной улицей, с палисадом и выходом к дороге.
  for(let i=0;i<14&&layout.houses.length<11;i++){
    const p=pointInZone('quarter',{margin:2,minGround:.5,maxGround:5,pathMin:3.2,pathMax:9,separation:5.6,occupyRadius:3.2});if(!p)break;
    const street=nearestPath(p.x,p.z),rot=Math.atan2(street.x-p.x,street.z-p.z),variant=layout.houses.length%3,front=2.72,doorX=p.x+Math.sin(rot)*front,doorZ=p.z+Math.cos(rot)*front;
    const h={x:p.x,z:p.z,rotY:rot,variant,doorX,doorZ};layout.houses.push(h);layout.colliders.push({kind:'rect',x:p.x,z:p.z,hw:2.3,hd:2.1,rot});
    layout.doorPaths.push({ax:doorX,az:doorZ,bx:street.x,bz:street.z});layout.mailboxes.push({x:doorX+Math.cos(rot)*1.25,z:doorZ-Math.sin(rot)*1.25,rotY:rot});
    layout.fences.push({x:p.x+Math.cos(rot)*3.7,z:p.z-Math.sin(rot)*3.7,rotY:rot,scale:1});
    for(const side of [-1,1])layout.flowers.push({x:p.x+side*3.0*Math.cos(rot)+Math.sin(rot)*1.2,z:p.z-side*3.0*Math.sin(rot)+Math.cos(rot)*1.2,rotY:rand()*Math.PI*2,scale:.8+rand()*.4});
    occupy(p,3.2);
  }

  const light=zoneById('lighthouse');layout.lighthouse={x:light.x,z:light.z,rotY:.3};
  layout.hut={x:14,z:36,rotY:-Math.PI/2};
  layout.colliders.push({kind:'circle',x:layout.lighthouse.x,z:layout.lighthouse.z,r:1.5},{kind:'rect',x:layout.hut.x,z:layout.hut.z,hw:2.5,hd:2.1,rot:layout.hut.rotY});

  addMany('market',3,5,layout.stalls,(p,i)=>({...p,rotY:i%2?Math.PI/2:-Math.PI/2}),{margin:3,minGround:.5,pathMin:2.5,pathMax:7,occupyRadius:2.5,collider:p=>({kind:'rect',x:p.x,z:p.z,hw:1.6,hd:1.1,rot:0})});
  addMany('market',8,2.8,layout.crates,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.5,pathMin:1.3,pathMax:6,occupyRadius:.8});
  addMany('market',4,4,layout.barrels,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.5,pathMin:1.2,pathMax:6,occupyRadius:1});
  addMany('harbor',5,3,layout.nets,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.4,pathMin:1.5,pathMax:9,occupyRadius:1.2});
  addMany('harbor',9,2.4,layout.crates,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.3,pathMin:2,pathMax:10,occupyRadius:.8});
  addMany('harbor',5,4,layout.barrels,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.3,pathMin:2,pathMax:10,occupyRadius:1});
  addMany('harbor',3,7,layout.boats,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:-1.4,maxGround:.2,pathMin:4,occupyRadius:3});

  addMany('pines',50,3.1,layout.trees,(p,i)=>({...p,type:i%4===0?'blossom':i%3===0?'round':'pine',rotY:rand()*Math.PI*2,scale:.82+rand()*.5,scaleY:.85+rand()*.4}),{margin:1,minGround:.5,pathMin:2.8,occupyRadius:1.4,collider:p=>({kind:'circle',x:p.x,z:p.z,r:1.05})});
  addMany('meadow',9,4,layout.trees,p=>({...p,type:'blossom',rotY:rand()*Math.PI*2,scale:.8+rand()*.5}),{margin:2,minGround:.5,pathMin:2.5,occupyRadius:1.5,collider:p=>({kind:'circle',x:p.x,z:p.z,r:.8})});
  for(const zone of ['meadow','cove','quarter']){
    const count=zone==='meadow'?76:zone==='cove'?24:12;
    addMany(zone,count,zone==='meadow'?1.5:2,layout.flowers,p=>({...p,rotY:rand()*Math.PI*2,scale:.7+rand()*.6}),{margin:1,minGround:.35,pathMin:1.8,occupyRadius:.7});
  }
  addMany('pines',20,3.1,layout.mushrooms,p=>({...p,rotY:rand()*Math.PI*2,scale:.8+rand()*.5}),{margin:1,minGround:.5,pathMin:2.5,occupyRadius:1});
  addMany('pines',14,3,layout.rocks,p=>({...p,rotY:rand()*Math.PI*2,scale:.6+rand()*.7}),{margin:1,minGround:.5,pathMin:2.5,occupyRadius:1});
  addMany('cove',14,3.4,layout.rocks,p=>({...p,rotY:rand()*Math.PI*2,scale:.6+rand()*.7}),{margin:1,minGround:-.1,maxGround:.6,pathMin:2,occupyRadius:1});
  addMany('cove',6,4.2,layout.loungers,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.1,maxGround:.8,pathMin:2.8,occupyRadius:1.8});
  addMany('cove',4,5,layout.umbrellas,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.1,maxGround:.8,pathMin:2.8,occupyRadius:2});
  addMany('meadow',6,7,layout.benches,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.5,pathMin:2,occupyRadius:1.5,collider:p=>({kind:'rect',x:p.x,z:p.z,hw:.85,hd:.35,rot:0})});
  addMany('pines',1,10,layout.benches,p=>({...p,rotY:rand()*Math.PI*2}),{margin:2,minGround:.5,pathMin:2,occupyRadius:1.5,collider:p=>({kind:'rect',x:p.x,z:p.z,hw:.85,hd:.35,rot:0})});

  // Ступени появляются только там, где путь к маяку пересекает крутой склон.
  for(const path of PATHS.filter(p=>p.id==='to-lighthouse'))for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));
    for(let j=0;j<steps;j++){const t=j/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;if(groundHeight(x,z)>.8)layout.steps.push({x,z,rotY:Math.atan2(b[0]-a[0],b[1]-a[1]),scale:1});}
  }
  const swingPoint=pointInZone('pines',{margin:3,minGround:.5,pathMin:4,pathMax:9,separation:8});if(swingPoint)layout.swing={...swingPoint,rotY:rand()*Math.PI*2,scale:1};

  // Отдельные светильники вдоль жилой и торговой улиц, не на самом покрытии.
  for(const pathId of ['to-market','to-quarter']){const path=PATHS.find(p=>p.id===pathId);for(let i=1;i<path.points.length-1;i+=2){const p=path.points[i];layout.lamps.push({x:p[0]+1.8,z:p[1]+1.1});}}
  for(const h of layout.houses)layout.lamps.push({x:h.doorX+1.5,z:h.doorZ});
  return layout;
}
