// quests.js — первые поручения жителей, журнал и сохранение наград
const QUESTS=[
 {id:'mira-shells',npc:'mira',title:'Подарок для Миры',item:'shell',amount:3,reward:80},
 {id:'timofey-fish',npc:'timofey',title:'Улов для Тимофея',item:'smallFish',amount:2,reward:100},
 {id:'anna-flowers',npc:'anna',title:'Цветы для пекарни',item:'flower',amount:2,reward:60},
 {id:'lea-pinkshell',npc:'lea',title:'Ракушка для этюда',item:'pinkShell',amount:1,reward:90},
 {id:'noah-fish',npc:'noah',title:'Обед смотрителя',item:'mediumFish',amount:1,reward:120},
 {id:'rosa-flowers',npc:'rosa',title:'Букет с луга',item:'flower',amount:3,reward:70},
 {id:'kai-shells',npc:'kai',title:'Охота за ракушками',item:'shell',amount:2,reward:45},
 {id:'uma-fish',npc:'uma',title:'Угощение для кота',item:'smallFish',amount:1,reward:55},
 {id:'felix-fish',npc:'felix',title:'Рыбацкая песня',item:'mediumFish',amount:1,reward:80},
 {id:'sam-shell',npc:'sam',title:'Сувенир в дорогу',item:'shell',amount:1,reward:50},
];
const KEY='quiet-shore-quests-v1';
export function createQuestSystem(economy){let state={active:null,done:[]};try{state={...state,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{}const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}};const get=id=>QUESTS.find(q=>q.id===id);return{get active(){return state.active?get(state.active):null;},isDone(id){return state.done.includes(id);},accept(id){if(state.active)return{ok:false,message:'Сначала закончи текущее задание.'};if(state.done.includes(id))return{ok:false,message:'Это задание уже выполнено.'};if(!get(id))return{ok:false,message:'Задание не найдено.'};state.active=id;save();return{ok:true,message:'Задание добавлено в журнал.'};},progress(){const q=state.active&&get(state.active);if(!q)return null;return{...q,have:economy.inventory[q.item]||0,done:state.done.length};},finish(){const q=state.active&&get(state.active);if(!q)return{ok:false,message:'Нет активного задания.'};if(!economy.remove(q.item,q.amount))return{ok:false,message:'Пока не хватает предметов.'};economy.addCoins(q.reward);state.done.push(q.id);state.active=null;save();return{ok:true,message:'Задание выполнено! Награда: '+q.reward+' монет.'};}};}
