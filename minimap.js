// minimap.js — карта острова, восемь зон и положение героини
import { ZONES, ROAD_NETWORK, WORLD_SCALE } from './zones.js';
const ABBR = { plaza:'Площадь', harbor:'Пирс', market:'Рынок', quarter:'Дома', meadow:'Луг', pines:'Лес', lighthouse:'Маяк', cove:'Бухта' };
const LIMIT = 88;
const ZOOM_KEY = 'quiet-shore-map-zoom-v1';
export function createMinimap({ smallCanvas, largeCanvas, hero }) {
  const smallCtx=smallCanvas.getContext('2d'), largeCtx=largeCanvas.getContext('2d');
  const modal=document.getElementById('map-modal');
  let zoom=1;
  try { zoom=Math.min(2.5,Math.max(.65,Number(localStorage.getItem(ZOOM_KEY))||1)); } catch {}
  const zoomReadout=document.getElementById('map-zoom-value');
  zoomReadout.textContent=Math.round(zoom*100)+'%';
  const legend=document.getElementById('zone-legend');
  legend.replaceChildren();
  for(const zone of ZONES){const row=document.createElement('div');row.className='zone-key';const swatch=document.createElement('i');swatch.style.background=zone.color;const name=document.createElement('span');name.textContent=zone.name;row.append(swatch,name);legend.append(row);}
  function draw(ctx,canvas,position,large=false){
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),size=Math.max(1,Math.floor(rect.width*dpr));
    if(canvas.width!==size||canvas.height!==size){canvas.width=size;canvas.height=size;}
    const s=size/2,cx=s,cy=s,r=s*.45,scale=r/(LIMIT/zoom);
    ctx.clearRect(0,0,size,size);
    ctx.fillStyle='#79bdca';ctx.fillRect(0,0,size,size);
    const water=ctx.createLinearGradient(0,0,size,size);water.addColorStop(0,'#91d2df');water.addColorStop(1,'#4b9eb5');ctx.fillStyle=water;ctx.fillRect(0,0,size,size);
    // Неровная линия берега совпадает с формулой рельефа в world.js
    ctx.beginPath();
    for(let i=0;i<=180;i++){const a=i/180*Math.PI*2,shore=(48+4.6*Math.sin(3*a+1)+2.8*Math.sin(5*a+2))*WORLD_SCALE,x=cx+Math.cos(a)*shore*scale,y=cy+Math.sin(a)*shore*scale;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
    ctx.closePath();ctx.fillStyle='#b7d996';ctx.fill();ctx.strokeStyle='#f4e0b9';ctx.lineWidth=Math.max(2,size*.012);ctx.stroke();
    // Гавань и круглая бухта вырезаны в суше так же, как в рельефе мира.
    ctx.save();ctx.beginPath();ctx.rect(0,0,size,size);ctx.clip();
    ctx.beginPath();ctx.moveTo(cx,cy+30.6*WORLD_SCALE*scale);ctx.lineTo(cx,cy+90*WORLD_SCALE*scale);ctx.lineCap='round';ctx.strokeStyle='#79bdca';ctx.lineWidth=22*WORLD_SCALE*scale;ctx.stroke();
    ctx.beginPath();ctx.arc(cx+36*WORLD_SCALE*scale,cy+27.5*WORLD_SCALE*scale,9*WORLD_SCALE*scale,0,Math.PI*2);ctx.fillStyle='#79bdca';ctx.fill();
    ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(0,0,size,size);ctx.clip();
    for(const route of Object.values(ROAD_NETWORK)){
      ctx.beginPath();route.forEach((point,i)=>{const x=cx+point[0]*scale,y=cy+point[1]*scale;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
      ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(106,86,69,.42)';ctx.lineWidth=Math.max(3,size*.024);ctx.stroke();ctx.strokeStyle='#f1ddba';ctx.lineWidth=Math.max(2,size*.016);ctx.stroke();
    }

    for(const zone of ZONES){const x=cx+zone.x*scale,y=cy+zone.z*scale,rr=Math.max(3,zone.radius*scale);ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fillStyle=zone.color+'38';ctx.fill();ctx.strokeStyle=zone.color;ctx.lineWidth=Math.max(1.2,size*.004);ctx.stroke();ctx.beginPath();ctx.arc(x,y,Math.max(2,size*.012),0,Math.PI*2);ctx.fillStyle=zone.color;ctx.fill();if(large){ctx.font='600 '+Math.max(10,size*.026)+'px system-ui';ctx.textAlign='center';ctx.fillStyle='#503b32';ctx.fillText(zone.name,x,y-rr-4);}else{ctx.font='700 '+Math.max(7,size*.035)+'px system-ui';ctx.textAlign='center';ctx.fillStyle='#503b32';ctx.fillText(ABBR[zone.id],x,y+rr+Math.max(7,size*.035));}}
    ctx.restore();
    const hx=cx+position.x*scale,hy=cy+position.z*scale;
    ctx.save();ctx.translate(hx,hy);ctx.rotate(Math.PI-hero.rotation.y);ctx.beginPath();ctx.moveTo(0,-size*.035);ctx.lineTo(size*.022,size*.027);ctx.lineTo(0,size*.014);ctx.lineTo(-size*.022,size*.027);ctx.closePath();ctx.fillStyle='#fff';ctx.strokeStyle='#7f5061';ctx.lineWidth=Math.max(1,size*.004);ctx.fill();ctx.stroke();ctx.restore();
    ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=Math.max(1.5,size*.008);ctx.strokeRect(1,1,size-2,size-2);
  }
  function update(position){draw(smallCtx,smallCanvas,position,false);if(!modal.hidden)draw(largeCtx,largeCanvas,position,true);}
  smallCanvas.addEventListener('click',()=>{modal.hidden=false;update(hero.position);});
  document.getElementById('map-zoom-in').addEventListener('click',()=>{zoom=Math.min(2.5,Math.round((zoom+0.25)*100)/100);zoomReadout.textContent=Math.round(zoom*100)+'%';try{localStorage.setItem(ZOOM_KEY,String(zoom));}catch{}update(hero.position);});
  document.getElementById('map-zoom-out').addEventListener('click',()=>{zoom=Math.max(.65,Math.round((zoom-.25)*100)/100);zoomReadout.textContent=Math.round(zoom*100)+'%';try{localStorage.setItem(ZOOM_KEY,String(zoom));}catch{}update(hero.position);});
  document.getElementById('map-close').addEventListener('click',()=>{modal.hidden=true;});
  modal.addEventListener('click',event=>{if(event.target===modal)modal.hidden=true;});
  window.addEventListener('resize',()=>update(hero.position));
  update(hero.position);
  return {update};
}
