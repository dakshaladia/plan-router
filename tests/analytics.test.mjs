import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/analytics.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'');
function harness(id,hostname='example.com',saved=null){
 const nodes=[],scripts=[],store=new Map(saved?[['halloween-router-analytics-consent',saved]]:[]);
 const make=()=>({listeners:{},hidden:false,setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},append(node){nodes.push(node);}});
 const footer=make(),body=make(),head={append(node){scripts.push(node);}};
 const ctx=vm.createContext({CLARITY_PROJECT_ID:id,window:{},location:{hostname,reload(){}},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},document:{createElement:make,body,head,querySelector:()=>footer}});
 vm.runInContext(source+'\ninitAnalytics();',ctx);
 return {nodes,scripts,ctx,run:code=>vm.runInContext(code,ctx)};
}
test('missing project ID and local preview never load Clarity',()=>{
 for(const h of [harness(''),harness('project123','localhost','granted')]){assert.equal(h.scripts.length,0);assert.equal(h.nodes.length,0);}
});
test('Clarity only loads after opt-in and only allowed action names are sent',()=>{
 const h=harness('project123');assert.equal(h.scripts.length,0);assert.equal(h.nodes[0].hidden,false);
 h.nodes[0].listeners.click({target:{closest:()=>({dataset:{choice:'granted'}})}});
 assert.equal(h.scripts.length,1);assert.equal(h.scripts[0].src,'https://www.clarity.ms/tag/project123');
 h.run("track('route_created');track('123 Private Address');");
 const queue=h.ctx.window.clarity.q.map(args=>Array.from(args));
 assert.equal(queue[0][0],'consentv2');assert.equal(queue[0][1].ad_Storage,'denied');assert.equal(queue[0][1].analytics_Storage,'granted');
 assert.equal(queue.length,2);assert.equal(queue[1][1],'route_created');
});
test('remembered decline keeps recording disabled',()=>{
 const h=harness('project123','example.com','denied');assert.equal(h.scripts.length,0);assert.equal(h.nodes[0].hidden,true);
 h.run("track('route_created');");assert.equal(h.ctx.window.clarity,undefined);
});
