'use strict';
// This control only prepares a mailto link. No requests, storage, or personal fields.
(()=>{
 const panel=document.querySelector('[data-retreat-inquiry]');if(!panel)return;
 const select=panel.querySelector('select'),link=panel.querySelector('[data-retreat-email]'),status=panel.querySelector('[data-retreat-selection]');
 const names={'unsure':'Not sure yet','half-day':'4-Hour Intensive','full-day':'Full-Day Retreat','overnight':'Overnight Retreat'};
 function update(value){
  const key=Object.hasOwn(names,value)?value:'unsure';select.value=key;
  const topic=names[key];link.href='mailto:support@mft.care?subject='+encodeURIComponent('Couples retreat information - '+topic)+'&body='+encodeURIComponent('Hello, I would like information about upcoming couples retreats. My format of interest is: '+topic+'. Please share the current formats, dates, inclusions, fees, and next steps.');
  status.textContent=key==='unsure'?'You can ask about any format.':'Your email will ask about the '+topic+'. Nothing has been sent.';
 }
 select.addEventListener('change',()=>update(select.value));
 document.querySelectorAll('[data-retreat-format]').forEach(a=>a.addEventListener('click',()=>update(a.dataset.retreatFormat)));
 update(select.value);
})();
