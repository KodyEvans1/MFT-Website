'use strict';
const ui=require('./ui/home-components');
const destinations=[
 ['new-page','Individual therapy','Space to work on your own priorities, patterns, and daily life.'],
 ['marriage-and-couples-therapy-counseling','Marriage and couples therapy','Understand recurring interactions, communication, and what you want to work on together.'],
 ['childrentherapy','Child therapy','Explore support for your child, caregiver involvement, and the first conversation.'],
 ['teen-counseling','Teen counseling',"Make room for a teen's own perspective, relationships, and practical needs."],
 ['family-therapy-group-counseling','Family therapy','Look at roles, communication, transitions, and the space between family members.'],
 ['new-page-1','Premarital counseling','Discuss expectations and decisions behind the plans you are making together.'],
 ['marriagereset','Marriage.Reset','Explore a clinician-guided process of assessment, priorities, practice, and review.'],
 ['new-page-2','Couples retreats','Compare a proposed extended format, provisional pricing, and current-information inquiries.']
];
function render(){
 const hero={kicker:'Marriage.Family.Therapy | Services',title:'Different starting points. One place to explore them.',summary:'Choose the kind of support you are looking for, then go deeper into how that care can work. You do not need to know the name of a therapy approach before beginning.',actions:[{label:'Compare care options',href:'#care-options'},{label:'Meet the team',href:'/team/'}],panel:{kicker:'Start with your question',title:'Who is the support for?',text:'Explore a full guide, compare the people who provide care, or ask a practical question before requesting an appointment.',items:[{title:'A question about benefits',text:'Contact support rather than assuming coverage.',href:'mailto:support@mft.care?subject=Benefits%20question'},{title:'A first appointment',text:'Understand the difference between an introduction and clinical care.',href:'/how-to-start-therapy/'}]}};
 const cards={id:'care-options',title:'Find a guide for the care you are considering.',columns:4,intro:'Each guide explains the service, gives examples, and answers practical questions. An inquiry or appointment request is not a confirmed booking.',items:destinations.map(([slug,title,text])=>({title,text,href:'/'+slug+'/',action:'Explore this service'}))};
 const steps={id:'next-step',title:'Choose a next step without figuring everything out first.',items:[{title:'Understand the care',text:'Read the guide that comes closest to your question. Examples and comparisons can help make an unfamiliar process concrete.'},{title:'Choose the person',text:'Review clinician profiles and confirm current services, ages, format, and availability.',link:{label:'Compare the team',href:'/team/'}},{title:'Make the appropriate request',text:'Routine appointment requests open SimplePractice. Retreat inquiries request information only.',link:{label:'Request an appointment',href:'https://marriagefamilytherapy.clientsecure.me'}}]};
 return `<main id="main" data-reference-page="services" data-page-family="service-directory" data-design-system="homepage-shared-v1">${ui.hero(hero)}${ui.cards(cards)}${ui.steps(steps)}</main>`;
}
module.exports={render,destinations};
