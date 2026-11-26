'use strict';
// Public owner-supplied prices only. No service IDs, clinical records, scheduler
// preselection, availability claims or measurement behavior belong in this view.
const costs=require('../content/appointment-starting-costs.json');
const contexts=new Set(['individual','couples','all']);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>'$'+value;

function inlineEvaluationPrice(){
 return money(costs.services.individualEvaluation.feeUsd)+' private pay, or applicable insurance benefits';
}

function renderStartingCosts({context='all',idPrefix='starting-costs'}={}){
 if(!contexts.has(context))throw Error('Unknown starting-cost context');
 if(typeof idPrefix!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(idPrefix))throw Error('Invalid starting-cost section ID');
 const s=costs.services;
 const shortRole=context==='individual'?'Optional for individual care; you may request the evaluation directly.':context==='couples'?
  'The required short consultation for couples, before each partner has a separate evaluation and before joint sessions.':
  'Optional for individual care. For couples, the short consultation comes before each partner\'s separate evaluation and joint sessions.';
 const cards=[
  {key:'complimentary-introduction',title:'Complimentary '+s.introduction.durationMinutes+'-minute introduction',fee:s.introduction.feeUsd,price:'Free',detail:'Phone or virtual.',text:'An optional, brief conversation about fit and the care process. It is not a diagnostic evaluation or therapy session.'},
  {key:'short-consultation',title:s.shortConsultation.durationMinutes+'-minute consultation',fee:s.shortConsultation.feeUsd,detail:'Scheduled in a '+s.shortConsultation.bookingBlockMinutes+'-minute block. Private pay.',text:shortRole+' This is a consultation, not a therapy session or diagnostic evaluation.'}
 ];
 if(context!=='couples'){
  const evaluation={key:'individual-evaluation',title:'Initial individual evaluation',fee:s.individualEvaluation.feeUsd,price:inlineEvaluationPrice(),detail:'Your first clinical appointment (90791).',text:'Neither optional consultation is required. Coverage depends on the clinician, service, plan and benefits; confirm the amount you may owe before care.'};
  if(context==='individual')cards.unshift(evaluation);else cards.push(evaluation);
 }else cards.unshift(cards.pop());
 if(context!=='individual'){
  cards.push({key:'couples-hour-consultation',title:'One-hour couples consultation',fee:s.couplesHourConsultation.feeUsd,detail:'A separate consultation option. Private pay.',text:'Do not assume this replaces the required short couples consultation or the separate partner evaluations. Confirm the intended appointment with the practice.'});
  cards.push({key:'reduced-cost-program',title:'Reduced-cost couples/family program',fee:s.reducedCostCouplesFamily.feeUsd,detail:'A separate reduced-cost program.',text:'This amount is not the fee for every ongoing couples or family session. Confirm program details and availability with the practice.',program:true});
 }
 const heading=context==='individual'?'Starting costs for individual care.':context==='couples'?'Keep the couples options distinct.':'Know the starting costs.';
 const intro=context==='individual'?'Begin with your evaluation, or choose an optional conversation first.':context==='couples'?'The short required consultation and the separate one-hour option are different appointments.':'Match the appointment to the step you intend to take.';
 const articles=cards.map(card=>`<article class="mft-starting-cost-card${card.program?' mft-starting-cost-program':''}" data-care-option="${card.key}" aria-labelledby="${idPrefix}-${card.key}"><h3 id="${idPrefix}-${card.key}">${esc(card.title)}</h3><p class="mft-starting-cost-price" data-care-price="${card.fee}">${esc(card.price||money(card.fee))}</p><p class="mft-starting-cost-detail">${esc(card.detail)}</p><p>${esc(card.text)}</p></article>`).join('');
 const partnerNote=context==='individual'?'':" Fees and any applicable coverage for the separate partner evaluations are confirmed separately; the initial individual-evaluation price is not a quote for those appointments.";
 return `<section class="section mft-starting-costs" id="${idPrefix}" data-starting-costs="${context}" aria-labelledby="${idPrefix}-title"><div class="section-heading"><p class="kicker">Appointments and starting costs</p><h2 id="${idPrefix}-title">${heading}</h2><p>${intro}</p></div><div class="mft-starting-cost-grid">${articles}</div><p class="mft-starting-cost-note">These amounts describe the named services, not a general price for ongoing care.${esc(partnerNote)} An appointment request is not a confirmed booking. <a href="/check-my-coverage/">Ask about insurance benefits</a>.</p></section>`;
}

module.exports={costs,inlineEvaluationPrice,renderStartingCosts};
