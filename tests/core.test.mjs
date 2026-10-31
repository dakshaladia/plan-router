import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLE,parsePlaces,queryFor,candidate,optimize,cost,googleLinks} from '../dist/core.js';
const context={city:'San Francisco',state:'California',country:'United States'};
test('freeform paste cleans bullets and keeps compound places intact',()=>{
 assert.deepEqual(parsePlaces('  **Waller Street**\r\n\n- Sea Cliff\n3. Presidio Terrace and Presidio Heights'),['Waller Street','Sea Cliff','Presidio Terrace and Presidio Heights']);
 assert.equal(parsePlaces(SAMPLE).length,12);
 assert.equal(queryFor('Waller Street',context),'Waller Street, San Francisco, California, United States');
 for(const name of ['Orange Avenue Los Altos','First Street, Pleasanton','Los Gatos: Tait Avenue'])assert.ok(!queryFor(name,context).includes('San Francisco'));
});
test('road and neighborhood results explicitly identify representative points',()=>{
 const feature={geometry:{coordinates:[-122.4,37.7]},properties:{osm_key:'highway',osm_value:'residential',name:'Waller Street',city:'San Francisco'}};
 assert.equal(candidate(feature).kind,'Street / road');assert.equal(candidate(feature).approximate,true);
 feature.properties={osm_key:'place',osm_value:'suburb',name:'Sea Cliff'};assert.equal(candidate(feature).kind,'Neighborhood / area');
 assert.equal(candidate({geometry:{coordinates:[999,50]}}),null);
});
function permutations(a){return a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(p=>[x,...p])):[[]];}
test('optimizer matches brute force for asymmetric driving matrices with fixed start and free end',()=>{
 let seed=89;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)%300)+1;
 for(let run=0;run<12;run++){
 const n=7,m=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:rand()));
 const result=optimize(m),best=Math.min(...permutations([1,2,3,4,5,6]).map(t=>cost([0,...t],m)));
 assert.equal(cost(result.order,m),best);assert.equal(result.order[0],0);assert.equal(result.exact,true);
 }
});
test('unreachable pairs are rejected instead of becoming zero-cost travel',()=>assert.throws(()=>optimize([[0,null],[20,0]]),/cannot be connected/));
test('large-route heuristic preserves every location and start',()=>{
 const m=Array.from({length:20},(_,i)=>Array.from({length:20},(_,j)=>Math.abs(i-j)*12));const r=optimize(m);
 assert.equal(r.exact,false);assert.equal(r.order[0],0);assert.equal(new Set(r.order).size,20);assert.equal(cost(r.order,m),228);
});
test('Google directions parts include every leg in order, with no more than 3 waypoints',()=>{
 for(let n=2;n<=21;n++){
 const points=Array.from({length:n},(_,i)=>({lat:i,lon:-120})),links=googleLinks(points),pairs=[];
 for(const link of links){const params=new URL(link.url).searchParams,via=(params.get('waypoints')||'').split('|').filter(Boolean);assert.ok(via.length<=3);assert.equal(params.get('travelmode'),'driving');
 const seq=[params.get('origin'),...via,params.get('destination')];for(let i=1;i<seq.length;i++)pairs.push([seq[i-1],seq[i]]);
 }
 assert.deepEqual(pairs,points.slice(1).map((p,i)=>[`${points[i].lat},-120`,`${p.lat},-120`]));
 }
});
