// zones.js — зоны, тропы, расстановка и расселение мелкой живности.
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

// Насекомые и мелочь расселяются по всему острову (сетка с рывком), а не по кругам зон.
// count — сколько штук; cell — размер клетки сетки в метрах (чем меньше, тем гуще и ровнее);
// minGround/maxGround — на какой высоте можно жить; pathBuffer — отступ от троп.
export const RESOURCE_RULES={
  shells:{zones:['harbor','cove'],count:12,separation:2.4,height:[.02,.4]},
  butterflies:{count:36,cell:15,minGround:.5,maxGround:3.2},
  beetles:{count:48,cell:12,minGround:.45,maxGround:3.5,pathBuffer:1},
  caterpillars:{count:30,cell:13,minGround:.5,maxGround:3,pathBuffer:1},
  bees:{count:16,cell:18,minGround:.5,maxGround:3},
  dragonflies:{count:10,cell:12,minGround:.05,maxGround:.8},
};

export function getZoneAt(x,z){return ZONES.find(zone=>Math.hypot(x-zone.x,z-zone.z)<=zone.radius)||null;}

// Ближайшее расстояние до осевой линии любой главной дорожки.
function segmentDistance(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(px-a[0]-dx*t,pz-a[1]-dz*t);}
export function distToPaths(x,z){let best=Infinity;for(const path of PATHS)for(let i=1;i<path.points.length;i++)best=Math.min(best,segmentDistance(x,z,path.points[i-1],path.points[i]));return best;}

// ===== Плавные тропы =====
// Исходные точки PATHS — это только «каркас». Тропа проходит через них по плавной кривой (Catmull-Rom),
// плитки лежат строго вдоль кривой на равном расстоянии, поэтому на поворотах нет изломов.
// Небольшой «изгиб» делает тропу живой. У магистральных троп он нулевой, чтобы ответвления стыковались ровно.
const PATH_WOBBLE={'to-market':.55,'to-quarter':.55,'to-lighthouse':.3,'to-cove':.4};

export function smoothPath(points,{wobble=0,seed=0,step=.9}={}){
  const n=points.length,closed=n>2&&Math.hypot(points[0][0]-points[n-1][0],points[0][1]-points[n-1][1])<.01;
  const P=closed?points.slice(0,-1):points,m=P.length,segs=closed?m:m-1;
  const at=i=>closed?P[((i%m)+m)%m]:P[Math.max(0,Math.min(m-1,i))];
  const cr=(a,b,c,d,t)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  const dense=[];
  for(let i=0;i<segs;i++){const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);for(let k=0;k<16;k++){const t=k/16;dense.push([cr(p0[0],p1[0],p2[0],p3[0],t),cr(p0[1],p1[1],p2[1],p3[1],t)]);}}
  dense.push(closed?dense[0].slice():P[m-1].slice());
  const len=[0];for(let i=1;i<dense.length;i++)len.push(len[i-1]+Math.hypot(dense[i][0]-dense[i-1][0],dense[i][1]-dense[i-1][1]));
  const total=len[len.length-1];
  const pos=s=>{s=Math.max(0,Math.min(total,s));let i=1;while(i<len.length-1&&len[i]<s)i++;const t=(s-len[i-1])/Math.max(1e-6,len[i]-len[i-1]);return [dense[i-1][0]+(dense[i][0]-dense[i-1][0])*t,dense[i-1][1]+(dense[i][1]-dense[i-1][1])*t];};
  const count=Math.max(1,closed?Math.round(total/step):Math.floor(total/step)),pitch=total/count;
  const offset=s=>closed?0:wobble*Math.sin(s*.28+seed)*Math.min(1,s/5,(total-s)/5);
  const shifted=s=>{const a=pos(s-.3),b=pos(s+.3),dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,o=offset(s),p=pos(s);return [p[0]-dz/l*o,p[1]+dx/l*o];};
  const out=[];
  for(let i=0;i<count;i++){
    const s=closed?i*pitch:(i+.5)*pitch,p=shifted(s),a=shifted(s-.3),b=shifted(s+.3),dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
    out.push({x:p[0],z:p[1],tx:dx/l,tz:dz/l});
  }
  return out;
}

// Плитки одной тропы: по ширине columns штук, по длине — через каждые 0.9
export function pathTilePlan(path){
  const seed=[...path.id].reduce((a,c)=>a+c.charCodeAt(0),0),cols=path.columns||2,out=[];
  smoothPath(path.points,{wobble:PATH_WOBBLE[path.id]||0,seed}).forEach((p,i)=>{
    const rot=Math.atan2(p.tx,p.tz);
    for(let c=0;c<cols;c++){const off=(c-(cols-1)/2)*.9;out.push({x:p.x-p.tz*off,z:p.z+p.tx*off,rot,shade:(i+c)%2});}
  });
  return out;
}

// Равномерное расселение по суше: остров режется на клетки, в каждой клетке пробуем найти точку.
// Так мелкие существа не сбиваются в одну кучу. Координаты — в мировых единицах (с учётом WORLD_SCALE).
export function spreadLandPoints(count,rand,groundHeight,{minGround=.45,maxGround=3.5,cell=12,pathBuffer=0}={}){
  const R=60*WORLD_SCALE,found=[];
  for(let pass=0;pass<4&&found.length<count*2;pass++){
    for(let gx=-R;gx<R;gx+=cell)for(let gz=-R;gz<R;gz+=cell){
      for(let t=0;t<8;t++){
        const x=gx+rand()*cell,z=gz+rand()*cell;if(Math.hypot(x,z)>R)continue;
        const y=groundHeight(x,z);if(y<minGround||y>maxGround)continue;
        if(pathBuffer&&distToPaths(x/WORLD_SCALE,z/WORLD_SCALE)<pathBuffer)continue;
        found.push({x,z,y});break;
      }
    }
  }
  for(let i=found.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[found[i],found[j]]=[found[j],found[i]];}
  return found.slice(0,count);
}

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
  const layout={houses:[],hut:null,lighthouse:null,lamps:[],boats:[],trees:[],flowers:[],stalls:[],crates:[],barrels:[],nets:[],fences:[],mailboxes:[],mushrooms:[],rocks:[],loungers:[],umbrellas:[],benches:[],bushes:[],tufts:[],steps:[],swing:null,colliders:[],doorPaths:[]};
  const occupied=[];
  const pointInZone=(zoneId,options={})=>{const zone=zoneById(zoneId);for(let i=0;i<700;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*(zone.r-(options.margin||1)),x=zone.x+Math.cos(a)*r,z=zone.z+Math.sin(a)*r,y=groundHeight(x,z);if(y<(options.minGround??.45)||y>(options.maxGround??8))continue;if(options.pathMin!==undefined&&distToPaths(x,z)<options.pathMin)continue;if(options.pathMax!==undefined&&distToPaths(x,z)>options.pathMax)continue;if(blocked(x,z)||reserved.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+(options.reserve||0)))continue;if(occupied.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+(options.separation||0)))continue;return{x,z,y};}return null;};
  const occupy=(point,r)=>occupied.push({x:point.x,z:point.z,r});
  const addMany=(zoneId,count,separation,dest,make,options={})=>{let placed=0;for(let i=0;i<count*100&&placed<count;i++){const p=pointInZone(zoneId,{...options,separation});if(!p)break;const item=make(p,placed);dest.push(item);if(options.collider)layout.colliders.push(options.collider(p,item));occupy(p,options.occupyRadius??separation*.45);placed++;}return placed;};
  const nearestPath=(x,z)=>{let best={x:0,z:0,distance:Infinity};for(const path of PATHS)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1))),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.distance)best={x:px,z:pz,distance:d};}return best;};

  for(const r of reserved)occupy(r,3.2);   // дома кольца у площади тоже занимают место
  // Дома в жилом квартале располагаются рядом с центральной улицей, с палисадом и выходом к дороге.
  for(let i=0;i<40&&layout.houses.length<11;i++){
    const p=pointInZone('quarter',{margin:2,minGround:.5,maxGround:5,pathMin:3.2,pathMax:10,separation:3,occupyRadius:3.2});if(!p)break;
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

  // ===== Заполнение пустых мест =====
  // Рощицы, кусты, трава, камни и цветочные пятна по всему острову. Всё стоит вне троп, домов и склонов.
  const slopeAt=(x,z)=>Math.hypot(groundHeight(x+.7,z)-groundHeight(x-.7,z),groundHeight(x,z+.7)-groundHeight(x,z-.7))/1.4;
  for(const d of layout.doorPaths){const len=Math.hypot(d.bx-d.ax,d.bz-d.az),n=Math.max(1,Math.ceil(len));for(let i=0;i<=n;i++)occupy({x:d.ax+(d.bx-d.ax)*i/n,z:d.az+(d.bz-d.az)*i/n},1.1);}
  occupy(layout.lighthouse,3.5);if(layout.hut)occupy(layout.hut,4);
  for(const l of layout.lamps)occupy(l,.9);
  // Быстрый поиск занятых мест: решётка 7×7, проверяем только соседние клетки
  const grid=new Map(),CELL=7,gkey=(cx,cz)=>cx+','+cz;
  const gridAdd=o=>{const k=gkey(Math.floor(o.x/CELL),Math.floor(o.z/CELL));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(o);};
  for(const o of occupied)gridAdd(o);
  const occupyW=(p,r)=>{const o={x:p.x,z:p.z,r};occupied.push(o);gridAdd(o);};
  const crowded=(x,z,r)=>{const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const list=grid.get(gkey(cx+i,cz+j));if(list)for(const p of list)if(Math.hypot(x-p.x,z-p.z)<p.r+r)return true;}return false;};
  const tryPlace=(x,z,{r=1,minGround=.5,maxGround=3.4,pathMin=1.6,maxSlope=.3}={})=>{
    if(Math.hypot(x,z)>57)return null;
    const y=groundHeight(x,z);if(y<minGround||y>maxGround)return null;
    if(crowded(x,z,r)||reserved.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r)||blocked(x,z))return null;
    if(distToPaths(x,z)<pathMin||slopeAt(x,z)>maxSlope)return null;
    return {x,z,y};
  };
  const randomLand=opts=>{for(let i=0;i<25;i++){const p=tryPlace((rand()*2-1)*57,(rand()*2-1)*57,opts);if(p)return p;}return null;};
  const addBush=(p,variant)=>{const scale=.8+rand()*.5;layout.bushes.push({...p,rotY:rand()*Math.PI*2,scale,variant});layout.colliders.push({kind:'circle',x:p.x,z:p.z,r:.55*scale});occupyW(p,1.1);};
  const addTuft=p=>{layout.tufts.push({...p,rotY:rand()*Math.PI*2,scale:.8+rand()*.6});occupyW(p,.9);};

  // Рощицы: 14 групп деревьев, каждая с кустами по краю. Рядом с сосновым лесом растут сосны, дальше — лиственные.
  const groves=[];
  for(let i=0;i<80&&groves.length<14;i++){
    const c=randomLand({r:2,pathMin:5,minGround:.55,maxSlope:.2});
    if(!c||Math.hypot(c.x,c.z)<14||groves.some(g=>Math.hypot(g.x-c.x,g.z-c.z)<16))continue;
    groves.push(c);
  }
  for(const g of groves){
    const pineBias=Math.hypot(g.x-WORLD_ZONES.pines.x,g.z-WORLD_ZONES.pines.z)<22,want=5+Math.floor(rand()*4);let placed=0;
    for(let k=0;k<want*8&&placed<want;k++){
      const a=rand()*Math.PI*2,rr=.6+Math.sqrt(rand())*5,p=tryPlace(g.x+Math.cos(a)*rr,g.z+Math.sin(a)*rr,{r:1.5,pathMin:2.8,maxSlope:.35});if(!p)continue;
      const roll=rand(),type=pineBias?(roll<.7?'pine':roll<.85?'round':'blossom'):(roll<.5?'round':roll<.8?'blossom':'pine');
      layout.trees.push({...p,type,rotY:rand()*Math.PI*2,scale:.8+rand()*.55,scaleY:.85+rand()*.4});
      layout.colliders.push({kind:'circle',x:p.x,z:p.z,r:1});occupyW(p,1.5);placed++;
    }
    const extra=4+Math.floor(rand()*4);let b=0;
    for(let k=0;k<extra*8&&b<extra;k++){const a=rand()*Math.PI*2,rr=3.5+rand()*3.5,p=tryPlace(g.x+Math.cos(a)*rr,g.z+Math.sin(a)*rr,{r:1.1,pathMin:1.8,maxSlope:.35});if(!p)continue;addBush(p,rand()<.3?1:0);b++;}
  }

  // Кусты и цветы вдоль троп (по обе стороны, с отступом от плиток)
  for(const path of PATHS){
    const edge=smoothPath(path.points,{step:3.2}),cols=path.columns||2;
    edge.forEach((pt,i)=>{
      const side=(i+path.id.length)%2?1:-1,off=cols*.45+1.4+rand()*.8,x=pt.x-pt.tz*off*side,z=pt.z+pt.tx*off*side,roll=rand();
      const p=tryPlace(x,z,{r:.8,pathMin:1.9,minGround:.5,maxSlope:.4});if(!p)return;
      if(roll<.4)addTuft(p);else if(roll<.7)addBush(p,rand()<.35?1:0);
      else if(roll<.9)for(let f=0;f<3;f++)layout.flowers.push({x:p.x+(rand()-.5)*1.2,z:p.z+(rand()-.5)*1.2,rotY:rand()*Math.PI*2,scale:.7+rand()*.5});
      else{layout.rocks.push({...p,rotY:rand()*Math.PI*2,scale:.5+rand()*.5});occupyW(p,.9);}
    });
  }

  // Отдельные кусты в поле
  for(let i=0,n=0;i<260&&n<70;i++){const p=randomLand({r:1.1,pathMin:1.8,maxSlope:.35});if(!p)continue;addBush(p,rand()<.3?1:0);n++;}

  // Цветочные пятна: 26 небольших клумб по острову
  for(let i=0,n=0;i<120&&n<26;i++){
    const c=randomLand({r:1.4,pathMin:1.4,maxSlope:.35});if(!c)continue;
    const cnt=3+Math.floor(rand()*3);
    for(let f=0;f<cnt;f++){const a=rand()*Math.PI*2,rr=rand()*.9;layout.flowers.push({x:c.x+Math.cos(a)*rr,z:c.z+Math.sin(a)*rr,rotY:rand()*Math.PI*2,scale:.7+rand()*.6});}
    occupyW(c,1.4);n++;
  }

  // Камни на склонах и в поле
  for(let i=0,n=0;i<200&&n<22;i++){const p=randomLand({r:1.2,pathMin:2.2,minGround:.45,maxGround:5,maxSlope:.6});if(!p)continue;layout.rocks.push({...p,rotY:rand()*Math.PI*2,scale:.6+rand()*.7});occupyW(p,1.2);n++;}

  // Трава: самая мелкая россыпь, ставится последней в оставшиеся свободные места
  for(let i=0,n=0;i<900&&n<320;i++){const p=randomLand({r:.9,pathMin:1,minGround:.5,maxSlope:.45});if(!p)continue;addTuft(p);n++;}
  return layout;
}
