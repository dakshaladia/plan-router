import {CLARITY_PROJECT_ID} from './config.js';
const preferenceKey='halloween-router-analytics-consent';
const events=new Set(['places_search_started','places_search_completed','places_search_failed','location_confirmed','location_refined','stop_reordered','route_created','route_optimized','route_failed','google_maps_opened','sample_loaded']);
let active=false;
function preference(){try{return localStorage.getItem(preferenceKey);}catch{return null;}}
function save(value){try{localStorage.setItem(preferenceKey,value);}catch{}}
export function track(name){if(active&&events.has(name)&&typeof window.clarity==='function')window.clarity('event',name);}
function start(){
 if(active)return;active=true;
 window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments);};
 window.clarity('consentv2',{analytics_Storage:'granted',ad_Storage:'denied'});
 const script=document.createElement('script');script.async=true;script.src=`https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;document.head.append(script);
}
export function initAnalytics(){
 // Keep local development and unconfigured deployments out of production analytics.
 if(!/^[a-z0-9]+$/i.test(CLARITY_PROJECT_ID)||['localhost','127.0.0.1','::1'].includes(location.hostname))return;
 const panel=document.createElement('aside');panel.className='analytics-choice';panel.setAttribute('aria-label','Analytics preferences');panel.hidden=true;
 panel.innerHTML='<p>Help improve Halloween Router? Microsoft Clarity measures visits, time spent, and interactions, including session recordings. Form inputs and itinerary text are masked. <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener">Microsoft privacy statement</a></p><div><button type="button" data-choice="denied">No thanks</button><button type="button" data-choice="granted">Allow analytics</button></div>';
 document.body.append(panel);
 const settings=document.createElement('button');settings.type='button';settings.className='analytics-settings';settings.textContent='Analytics preferences';document.querySelector('footer').append(settings);settings.addEventListener('click',()=>panel.hidden=false);
 panel.addEventListener('click',event=>{const choice=event.target.closest('[data-choice]')?.dataset.choice;if(!choice)return;save(choice);panel.hidden=true;if(choice==='granted')start();else if(active){window.clarity('consentv2',{analytics_Storage:'denied',ad_Storage:'denied'});active=false;location.reload();}});
 if(preference()==='granted')start();else if(preference()!=='denied')panel.hidden=false;
}
