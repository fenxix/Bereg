// interiors.js — шесть простых тёплых комнат, расположенных отдельно от острова
import * as THREE from 'three';
const NAMES=['Пекарня','Лавка торговки','Дом рыбака','Мастерская художницы','Маяк','Твой домик'];
export function createInteriors(scene){
 const rooms=NAMES.map((name,index)=>{
  const originX=1000+index*24,group=new THREE.Group();group.name='Интерьер: '+name;group.position.x=originX;group.visible=false;
  const wall=new THREE.MeshStandardMaterial({color:0xFFF4E3,roughness:1}),floorMat=new THREE.MeshStandardMaterial({color:0xB98A62,roughness:1}),accent=new THREE.MeshStandardMaterial({color:[0xE8836B,0xC98BB9,0x6B9AC4,0xA8D08D,0xE8C27A,0xF4A6B8][index],roughness:1});
  const box=(w,h,d,mat,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  box(8,.18,6,floorMat,0,-.09,0);box(8,3,.18,wall,0,1.5,-3);box(.18,3,6,wall,-4,1.5,0);box(.18,3,6,wall,4,1.5,0);
  // Низкая мебель меняется по комнате и касается пола.
  if(index===0){box(2.4,.75,.8,accent,-1,.38,-1.5);box(.7,.45,.7,floorMat,2,.22,-1.8);}
  else if(index===1){box(2.6,1,.7,accent,1,.5,-2);box(.9,.5,.7,floorMat,-1.5,.25,-2);}
  else if(index===2){box(2,.65,.25,accent,-2,.33,-1.7);box(1.4,.8,.7,floorMat,1,.4,-1.7);}
  else if(index===3){box(.18,1.7,1.2,accent,2,.85,-2);box(.5,.5,.5,floorMat,-1,.25,-1.5);}
  else if(index===4){box(1.2,1.5,1.2,accent,0,.75,-1);box(.5,.4,.5,floorMat,2,.2,-1.8);}
  else{box(2,.45,1.2,accent,-1,.22,-1.6);box(1,.65,.7,floorMat,1.6,.33,-1.7);}
  scene.add(group);return {name,group,x:originX};
 });
 const colliders=[{kind:'rect',x:0,z:-2.88,hw:3.9,hd:.12,rot:0},{kind:'rect',x:-3.88,z:0,hw:.12,hd:2.8,rot:0},{kind:'rect',x:3.88,z:0,hw:.12,hd:2.8,rot:0},{kind:'rect',x:-1,z:-1.5,hw:1.25,hd:.42,rot:0},{kind:'rect',x:1.5,z:-1.7,hw:.55,hd:.4,rot:0}];
 return {rooms,colliders,surface:(x,z)=>Math.abs(x)<3.7&&z>-2.7&&z<2.65?0:-1,show(index){for(const room of rooms)room.group.visible=false;const room=rooms[index%rooms.length];room.group.visible=true;return room;},hide(){for(const room of rooms)room.group.visible=false;}};
}
