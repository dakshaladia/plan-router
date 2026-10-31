import {SAMPLE,parsePlaces,queryFor,candidate,optimize,googleLinks,nameMatches} from './core.js';
import {GEOCODER,ROUTER} from './config.js';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stops=[],busy=false,map,markers,road,context={},bias=null,routeVersion=0,lastRequest=0;
const cache=new Map();
try{const old=JSON.parse(localStorage.getItem('wayfarer-geocache-v2')||'{}');for(const [k,v] of Object.entries(old))if(Date.now()-v.time<7*86400000)cache.set(k,v);}catch{}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function lock(value){busy=value;document.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=value);availability();}
function availability(){const ready=stops.length>=2&&stops.every(s=>s.confirmed&&s.selected);$('route').disabled=busy||!ready;$('optimize').disabled=busy||!ready;}
function invalidate(){routeVersion++;if(road){road.remove();road=null;}$('summary').hidden=true;$('maps-links').replaceChildren();$('map-caption').textContent='Review every stop, then map or optimize your driving route.';}
function initMap(){
  if(!window.L){$('map-fallback').hidden=false;return;}
  map=L.map('map',{scrollWheelZoom:true}).setView([37.65,-122.23],9);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  markers=L.featureGroup().addTo(map);new ResizeObserver(()=>map.invalidateSize()).observe($('map'));
}
function drawMarkers(fit=false){if(!map)return;markers.clearLayers();stops.forEach((s,i)=>{const p=s.selected;if(!p)return;const marker=L.marker([p.lat,p.lon],{icon:L.divIcon({html:`<span class="pin ${s.confirmed?'':'unconfirmed'}">${s.start?'S':i+1}</span>`,className:'',iconSize:[32,32],iconAnchor:[16,16]})}).bindPopup(`<strong>${esc(s.name)}</strong><br>${esc(p.label)}<br>${esc(p.kind)} · ${s.confirmed?'Reviewed':'Needs review'}${p.approximate?'<br>Representative point; verify the actual driving destination.':''}`);marker.addTo(markers);});if(fit)fitMap();}
function fitMap(){if(map&&markers.getLayers().length)map.fitBounds(markers.getBounds(),{padding:[45,45],maxZoom:15});}
function render(){
  $('stops').innerHTML=stops.map((s,i)=>`<article class="stop" data-id="${s.id}"><span class="number">${s.start?'S':i+1}</span><div><h3 class="stop-title">${esc(s.name)}<span class="badge ${s.confirmed?'ok':''}">${s.confirmed?'Reviewed':s.error?'Search failed':s.candidates.length?'Review match':'No match'}</span></h3>${s.start?'<p>Starting point · fixed when optimizing</p>':''}${s.selected&&!s.selected.matches?'<p class="match-warning">Name differs from your request. This is a related search result, not a verified match. Refine the search, or deliberately choose this alternative.</p>':''}${s.selected?`<p>${esc(s.selected.kind)}${s.selected.approximate?' · Representative point, not a verified entrance.':''}</p>`:''}${s.error?`<p>${esc(s.error)}</p>`:''}${s.candidates.length?`<div class="review"><select aria-label="Match for ${esc(s.name)}" data-action="choose">${s.candidates.map((p,j)=>`<option value="${j}" ${s.selected===p?'selected':''}>${esc(p.label)} — ${esc(p.kind)}${p.matches?'':' · Name differs'}</option>`).join('')}</select><button data-action="confirm">${s.confirmed?'Reopen review':s.selected?.matches?'Use this location':'Use this alternative'}</button><button data-action="view">View on map</button></div>`:'<p>No reliable match found. Try an address, intersection, or a clearer place name and city. A nickname may not be listed.</p>'}<div class="refine"><input aria-label="Refine ${esc(s.name)}" value="${esc(s.query)}"><button data-action="search">Search again</button></div></div><div class="move"><button data-action="up" aria-label="Move ${esc(s.name)} up" ${i===0||s.start||stops[i-1]?.start?'disabled':''}>↑</button><button data-action="down" aria-label="Move ${esc(s.name)} down" ${i===stops.length-1||s.start?'disabled':''}>↓</button><button data-action="remove" aria-label="Remove ${esc(s.name)}">×</button></div></article>`).join('');
  $('results-title').textContent=`Your itinerary${stops.length?' · '+stops.length+' locations':''}`;availability();drawMarkers();
}
async function json(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error(r.status===429?'The map service is busy. Wait a moment and try again.':`Map service returned ${r.status}. Please try again.`);return await r.json();}catch(e){if(e.name==='AbortError')throw Error('The map service timed out. Please try again.');if(e instanceof TypeError)throw Error('Could not reach the map service. Check your connection and try again.');throw e;}finally{clearTimeout(timer);}}
async function geocode(query,locationBias){
  const url=new URL(GEOCODER);url.search=new URLSearchParams({q:query,limit:'6',lang:'en'});if(locationBias){url.searchParams.set('lat',locationBias.lat);url.searchParams.set('lon',locationBias.lon);}
  const key=url.href;if(cache.has(key))return cache.get(key).data;
  await new Promise(r=>setTimeout(r,Math.max(0,1100-(Date.now()-lastRequest))));lastRequest=Date.now();
  const data=await json(url);if(!Array.isArray(data.features))throw Error('Unexpected search response. Please try again.');
  const seen=new Set(),results=data.features.map(candidate).filter(Boolean).filter(p=>{const key=p.label+p.lat.toFixed(4)+p.lon.toFixed(4);if(seen.has(key))return false;seen.add(key);return true;});
  cache.set(key,{time:Date.now(),data:results});try{localStorage.setItem('wayfarer-geocache-v2',JSON.stringify(Object.fromEntries([...cache].slice(-150))));}catch{}return results;
}
async function searchStop(s){try{s.error='';s.candidates=(await geocode(s.query,bias)).map(p=>({...p,matches:nameMatches(s.query,p)})).sort((a,b)=>Number(b.matches)-Number(a.matches));s.selected=s.candidates[0]||null;s.confirmed=false;}catch(e){s.error=e.message;s.candidates=[];s.selected=null;s.confirmed=false;}}
$('plan-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const names=parsePlaces($('places').value);if(!names.length)return status('Add at least one place.',true);if(names.length>20)return status('Please use up to 20 places per plan.',true);
  context={country:$('country').value.trim(),state:$('state').value.trim(),city:$('city').value.trim()};invalidate();stops=[];render();lock(true);status('Finding your reference city…');
  try{
    const refs=await geocode([context.city,context.state,context.country].filter(Boolean).join(', '));bias=refs[0]||null;
    if(!bias)throw Error('Reference city not found. Check the country, state, and city, then try again.');
    const start=$('start').value.trim();const all=[...(start?[{name:start,start:true}]:[]),...names.map(name=>({name,start:false}))];
    for(let i=0;i<all.length;i++){const item=all[i];const s={...item,id:crypto.randomUUID(),query:queryFor(item.name,context),candidates:[],selected:null,confirmed:false};stops.push(s);status(`Finding location ${i+1} of ${all.length}: ${item.name}…`);await searchStop(s);render();lock(true);}
    drawMarkers(true);status(`Review all ${stops.length} locations below. Choose the correct match and select “Use this location”. Refine or remove any missing places. Reference city biases results; check the city and region on each match.`);$('results-title').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){status(e.message,true);}finally{lock(false);render();}
});
$('stops').addEventListener('change',e=>{if(e.target.dataset.action!=='choose')return;const s=stops.find(s=>s.id===e.target.closest('.stop').dataset.id);s.selected=s.candidates[Number(e.target.value)];s.confirmed=false;invalidate();render();});
$('stops').addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button||busy)return;const article=button.closest('.stop'),i=stops.findIndex(s=>s.id===article.dataset.id),s=stops[i],action=button.dataset.action;
  if(action==='view'){if(map&&s.selected)map.setView([s.selected.lat,s.selected.lon],15);return;}
  invalidate();if(action==='confirm')s.confirmed=!s.confirmed;
  if(action==='remove')stops.splice(i,1);
  if(action==='up'&&i>0&&!s.start&&!stops[i-1].start)[stops[i-1],stops[i]]=[stops[i],stops[i-1]];
  if(action==='down'&&i<stops.length-1&&!s.start)[stops[i],stops[i+1]]=[stops[i+1],stops[i]];
  if(action==='search'){const query=article.querySelector('.refine input').value.trim();if(!query)return status('Enter a more specific search.',true);s.query=query;lock(true);status(`Searching for ${query}…`);await searchStop(s);lock(false);}
  render();const remaining=stops.filter(s=>!s.confirmed).length;status(remaining?`${remaining} location${remaining===1?'':'s'} still need review. Broad roads and neighborhoods use representative points; refine to an address or intersection if needed.`:stops.length<2?'Add at least two locations to build a route.':'All locations reviewed. Map this order, or optimize driving time. Use ↑ and ↓ to reorder stops.');
});
function coordinates(){return stops.map(s=>`${s.selected.lon},${s.selected.lat}`).join(';');}
async function route(optimized=false){
  if(busy||stops.length<2||stops.some(s=>!s.confirmed))return;invalidate();const version=routeVersion;lock(true);let method='Manual visiting order';
  try{
    if(optimized){status('Comparing driving times between your stops…');const table=await json(`${ROUTER}/table/v1/driving/${coordinates()}?annotations=duration`);if(table.code!=='Ok'||!table.durations)throw Error('Could not calculate driving times. Refine any unreachable stops and try again.');const best=optimize(table.durations);stops=best.order.map(i=>stops[i]);method=best.exact?'Shortest driving time for these points and this fixed start':'Heuristic driving order; a global optimum is not guaranteed';render();lock(true);}
    status('Drawing your driving route…');const data=await json(`${ROUTER}/route/v1/driving/${coordinates()}?overview=full&geometries=geojson&steps=false`);
    if(version!==routeVersion)return;if(data.code!=='Ok'||!data.routes?.length)throw Error('No driving route connects these stops. Review access and refine or remove unreachable locations.');
    const r=data.routes[0];if(!r.geometry?.coordinates?.length||!Number.isFinite(r.distance)||!Number.isFinite(r.duration))throw Error('The routing service returned an incomplete route. Please try again.');
    if(map){road=L.geoJSON(r.geometry,{style:{color:'#214e3b',weight:5,opacity:.85}}).addTo(map);map.fitBounds(road.getBounds(),{padding:[35,35]});drawMarkers();}
    const snap=(data.waypoints||[]).map((p,i)=>p.distance>100?`${stops[i].name}: driving point about ${Math.round(p.distance)} m from its marker`:null).filter(Boolean);
    const minutes=Math.round(r.duration/60),duration=minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes} min`;
    $('summary').innerHTML=`<div><strong>${duration}</strong><small>Estimated driving time</small></div><div><strong>${Math.round(r.distance/1609.344)} mi</strong><small>Driving distance</small></div><div><strong>${stops.length}</strong><small>Reviewed locations</small></div><div class="method">${esc(method)}. First location is fixed; route ends at the final stop. No live traffic, closures, parking, or visit time included.</div>`;$('summary').hidden=false;
    const links=googleLinks(stops.map(s=>s.selected));$('maps-links').innerHTML=`<div class="links"><h3>Take your route with you ↗</h3><p>${links.length>1?'Split into mobile-friendly parts with shared endpoints. Open each part in order.':'Open your reviewed stops in Google Maps.'} Google Maps may choose different roads. Neighborhood / street points are approximate.</p>${links.map((l,i)=>`<a href="${esc(l.url)}" target="_blank" rel="noopener">${links.length>1?`Part ${i+1} · locations ${l.from}–${l.to}`:'Open in Google Maps'} ↗</a>`).join('')}</div>`;
    $('map-caption').textContent=`${stops.length} reviewed locations · ${duration} driving · ${Math.round(r.distance/1609.344)} miles`;
    status(`Route ready. ${optimized?'The first location stays fixed. ':''}Use ↑ / ↓ to change the order, then map it again.${snap.length?'\nCheck road access: '+snap.join('; ')+'.':''}`);
  }catch(e){status(e.message+' Your reviewed locations are preserved; you can retry.',true);}finally{lock(false);render();}
}
$('route').addEventListener('click',()=>route());$('optimize').addEventListener('click',()=>route(true));$('fit').addEventListener('click',fitMap);
function count(){$('line-count').textContent=`${parsePlaces($('places').value).length} places`;}
function sample(){$('country').value='United States';$('state').value='California';$('city').value='San Francisco';$('start').value='';$('places').value=SAMPLE;count();}
$('sample').addEventListener('click',()=>{sample();if(stops.length){stops=[];invalidate();render();status('Bay Area example loaded. Select “Find my places” to create a new itinerary.');}});$('places').addEventListener('input',count);
// An edited plan must be re-geocoded; stale route controls should never remain active.
$('plan-form').addEventListener('input',()=>{if(stops.length){stops=[];invalidate();render();status('Inputs changed. Select “Find my places” to refresh your itinerary.');}});
initMap();sample();
