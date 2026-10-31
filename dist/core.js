export const SAMPLE = `Waller Street
Castro Street
Coco House, Noe Valley
Upper Terrace, Corona Heights
Presidio Terrace
Presidio Heights
Sea Cliff
Page Street
Tait Avenue, Almond Grove, Los Gatos
Willow Glen, San Jose
Orange Avenue, Los Altos
First Street, Pleasanton`;
export function parsePlaces(text) {
  return text.split(/\r?\n/).map(s=>s.replace(/^\s*(?:[-*•]+\s*|\d+[.)]\s+)/,'').replace(/\*\*/g,'').replace(/\s+/g,' ').trim()).filter(Boolean);
}
export function queryFor(text, context) {
  // A comma, parenthesis, or explicit city phrase is treated as qualification.
  text=text.replace(/^(Los Gatos|San Jose|Los Altos|Pleasanton):\s*(.+)$/i,'$2, $1').replace(/\s+(Los Gatos|San Jose|Los Altos|Pleasanton)$/i,', $1');
  const qualified=/[,()]/.test(text)||/\b(in|near)\b/i.test(text);
  return [text,qualified?'':context.city,context.state,context.country].filter(Boolean).join(', ');
}
export function candidate(feature) {
  const p=feature.properties||{},coords=feature.geometry?.coordinates;
  if(!Array.isArray(coords)||coords.length<2||!coords.slice(0,2).every(Number.isFinite)||Math.abs(coords[0])>180||Math.abs(coords[1])>90)return null;
  const type=p.osm_value||p.type||'place';
  const area=p.osm_key!=='highway'&&(['suburb','neighbourhood','quarter','city','town','village','hamlet','locality','residential','administrative'].includes(type)||p.osm_key==='boundary');
  const street=p.osm_key==='highway'||['street','road','pedestrian','living_street','tertiary','secondary','primary','service','unclassified'].includes(type);
  const label=[p.name,p.housenumber&&p.street?`${p.housenumber} ${p.street}`:p.street,p.locality,p.district,p.city,p.state,p.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
  return {name:p.name||p.street||'',lon:coords[0],lat:coords[1],label:label||'Unnamed mapped place',type,kind:area?'Neighborhood / area':street?'Street / road':p.housenumber?'Address':'Mapped place',approximate:area||street||!p.housenumber,country:p.country,state:p.state,countrycode:p.countrycode};
}
export const cost=(order,m)=>order.slice(1).reduce((n,v,i)=>n+m[order[i]][v],0);
export function optimize(matrix) {
  const n=matrix.length;
  if(n<2)return {order:Array.from({length:n},(_,i)=>i),exact:true};
  if(matrix.some(row=>row.length!==n||row.some(x=>!Number.isFinite(x)||x<0)))throw Error('Some stops cannot be connected by car. Refine or remove them before optimizing.');
  if(n<=15){
    const count=n-1, size=1<<count,dp=new Float64Array(size*count).fill(Infinity),prev=new Int16Array(size*count).fill(-1);
    for(let j=0;j<count;j++)dp[(1<<j)*count+j]=matrix[0][j+1];
    for(let mask=1;mask<size;mask++)for(let j=0;j<count;j++)if(mask&(1<<j)){
      const base=dp[mask*count+j];if(!Number.isFinite(base))continue;
      for(let k=0;k<count;k++)if(!(mask&(1<<k))){const next=mask|(1<<k),idx=next*count+k,val=base+matrix[j+1][k+1];if(val<dp[idx]){dp[idx]=val;prev[idx]=j;}}
    }
    let end=0;for(let j=1;j<count;j++)if(dp[(size-1)*count+j]<dp[(size-1)*count+end])end=j;
    let mask=size-1,tail=[];while(end>=0){tail.push(end+1);const old=end;end=prev[mask*count+end];mask^=1<<old;}
    return {order:[0,...tail.reverse()],exact:true};
  }
  let order=[0],remaining=new Set(Array.from({length:n-1},(_,i)=>i+1));
  while(remaining.size){const last=order.at(-1),next=[...remaining].sort((a,b)=>matrix[last][a]-matrix[last][b])[0];order.push(next);remaining.delete(next);}
  let improved=true;while(improved){improved=false;outer:for(let a=1;a<n-1;a++)for(let b=a+1;b<n;b++){
    const trial=[...order.slice(0,a),...order.slice(a,b+1).reverse(),...order.slice(b+1)];if(cost(trial,matrix)+.001<cost(order,matrix)){order=trial;improved=true;break outer;}
  }}
  return {order,exact:false};
}
export function googleLinks(points) {
  // At most 3 intermediate waypoints works on mobile browsers too. Overlap endpoints.
  const links=[];for(let i=0;i<points.length-1;i+=4){const chunk=points.slice(i,i+5),coord=p=>`${p.lat},${p.lon}`;
    const params=new URLSearchParams({api:'1',origin:coord(chunk[0]),destination:coord(chunk.at(-1)),travelmode:'driving'});
    if(chunk.length>2)params.set('waypoints',chunk.slice(1,-1).map(coord).join('|'));
    links.push({url:`https://www.google.com/maps/dir/?${params}`,from:i+1,to:i+chunk.length});
  }return links;
}

export function nameMatches(query,p) {
 const norm=s=>s.toLowerCase().replace(/\bst\b/g,'street').replace(/\bave\b/g,'avenue').replace(/[^a-z0-9]+/g,' ').trim();
 const target=norm(query.split(/[,(:]/)[0]),name=norm(p.name||'');
 return Boolean(target && name && (target===name || (p.kind==='Address' && norm(p.label).includes(target))));
}
