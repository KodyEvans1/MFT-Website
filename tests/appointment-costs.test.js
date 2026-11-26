'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {costs,inlineEvaluationPrice,renderStartingCosts}=require('../src/appointment-costs');
const {startMain}=require('../src/start-page');
const launch=require('../src/launch-content');
const plain=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const keys=html=>[...html.matchAll(/data-care-option="([^"]+)"/g)].map(m=>m[1]);

test('owner-supplied costs distinguish consultation length, calendar block and service scope',()=>{
 assert.equal(costs.provenance.ownerProvidedOn,'2026-11-25');
 assert.match(costs.provenance.verificationLimit,/no priced service catalog or service IDs/);
 assert.equal(costs.services.introduction.durationMinutes,10);assert.equal(costs.services.introduction.feeUsd,0);
 assert.equal(costs.services.shortConsultation.durationMinutes,26);assert.equal(costs.services.shortConsultation.bookingBlockMinutes,30);assert.equal(costs.services.shortConsultation.feeUsd,75);
 assert.equal(costs.services.couplesHourConsultation.durationMinutes,60);assert.equal(costs.services.couplesHourConsultation.feeUsd,150);
 assert.equal(costs.services.couplesHourConsultation.replacementForRequiredShortConsultationConfirmed,false);
 assert.equal(costs.services.individualEvaluation.feeUsd,150);assert.equal(costs.services.individualEvaluation.insuranceMayApply,true);assert.equal(costs.services.individualEvaluation.consultationRequired,false);
 assert.equal(costs.services.reducedCostCouplesFamily.feeUsd,150);assert.equal(costs.services.reducedCostCouplesFamily.generalOngoingSessionFee,false);
});
test('individual costs lead with direct evaluation and keep both consultations optional',()=>{
 const html=renderStartingCosts({context:'individual',idPrefix:'individual-starting-costs'}),text=plain(html);
 assert.deepEqual(keys(html),['individual-evaluation','complimentary-introduction','short-consultation']);
 assert.equal(inlineEvaluationPrice(),'$150 private pay, or applicable insurance benefits');
 for(const phrase of ['Neither optional consultation is required','Phone or virtual','26-minute consultation','Scheduled in a 30-minute block','$75','Coverage depends'])assert.ok(text.includes(phrase),phrase);
 assert.doesNotMatch(text,/One-hour couples consultation|Reduced-cost couples\/family program/);
});
test('couples prices keep the required short consultation separate from the hour and reduced-cost program',()=>{
 const html=renderStartingCosts({context:'couples',idPrefix:'couples-starting-costs'}),text=plain(html);
 assert.deepEqual(keys(html),['short-consultation','complimentary-introduction','couples-hour-consultation','reduced-cost-program']);
 assert.equal((html.match(/data-care-price="150"/g)||[]).length,2);
 for(const phrase of ['required short consultation','One-hour couples consultation','Do not assume this replaces','Reduced-cost couples/family program','not the fee for every ongoing couples or family session','partner evaluations are confirmed separately'])assert.ok(text.includes(phrase),phrase);
 assert.doesNotMatch(html,/data-care-option="individual-evaluation"/);
});
test('cost blocks contain no public intake, scheduler service preselection or tracking behavior',()=>{
 const first=renderStartingCosts(),second=renderStartingCosts({context:'individual',idPrefix:'second-costs'});
 assert.equal(keys(first).length,5);assert.equal(new Set(keys(first)).size,5);
 const html=first+second,ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 assert.doesNotMatch(html,/<(?:form|input|textarea|script)\b|clientsecure|serviceId=|locationId=|gtag\(|dataLayer|onclick=/i);
 for(const match of html.matchAll(/href="([^"]+)"/g))assert.match(match[1],/^\/(?!\/)/);
 assert.throws(()=>renderStartingCosts({context:'all-therapy'}));assert.throws(()=>renderStartingCosts({idPrefix:'x" onclick="x'}));
});
test('starting guide publishes the costs anchor and preserves the required couples preparation sequence',()=>{
 const html=startMain(),text=plain(html),couples=plain(html.match(/<section[^>]+id="couples-journey"[\s\S]*?<\/section>/)[0]);
 assert.match(html,/id="starting-costs"/);assert.match(html,/href="#starting-costs"/);assert.match(html,/id="individual-journey"/);
 assert.equal(keys(html).length,5);
 for(const phrase of ['26-minute conversation in a 30-minute booking block','all three preparation appointments','separate individual therapist','does not automatically replace this required preparation'])assert.ok(couples.includes(phrase),phrase);
 assert.ok(couples.indexOf('Short couples consultation')<couples.indexOf('One diagnostic evaluation per partner'));
 assert.ok(couples.indexOf('One diagnostic evaluation per partner')<couples.indexOf('53-minute couples sessions'));
 assert.ok(text.includes(inlineEvaluationPrice()));assert.doesNotMatch(html,/<(?:form|input|textarea)\b/);
});
test('benefits inquiry asks for the secure next step without soliciting private details in the email template',()=>{
 const fixture='<html><body><main></main></body></html>',html=launch.apply(fixture,'check-my-coverage');
 assert.equal(launch.apply(html,'check-my-coverage'),html);
 const email=html.match(/href="(mailto:support@mft\.care\?subject=Benefits%20verification[^\"]*)"/)[1].replace(/&amp;/g,'&');
 const body=new URL(email).searchParams.get('body');
 assert.match(body,/start a benefits inquiry/);assert.match(body,/secure next step/);
 assert.doesNotMatch(body,/My name:|phone number:|Insurance company:|Service I am seeking:|date of birth:|diagnosis:/i);
 const steps=[...html.matchAll(/data-benefits-step="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(steps,['email','secure','review']);
 const text=plain(html);assert.match(text,/not instant benefits verification/);assert.match(text,/not a guarantee of coverage or payment/);assert.match(text,/Couples consultations and couples sessions are private pay/);
 assert.doesNotMatch(html,/<(?:form|input|textarea)\b/);
});
