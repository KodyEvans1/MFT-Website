const fs = require('fs');
const path = require('path');
const presentation = require('./ui/clinician-presentation');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://www.mft.care';
const INDEXING = /^true$/i.test(process.env.SITE_INDEXING_ENABLED || '');
const VERIFY = (process.env.GOOGLE_SITE_VERIFICATION || '').trim();
const APPOINTMENT = 'https://marriagefamilytherapy.clientsecure.me/';
const INSURANCE = 'mailto:support@mft.care?subject=Benefits%20verification';
const PORTAL = 'https://marriagefamilytherapy.clientsecure.me/';
const DIRECTIONS = 'https://maps.app.goo.gl/SyW9QMpUgunaTFp19';

const images = {
  office: 'https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/1cbcf430-dfe2-4b69-9d9f-7ac53733849e/Individual%2BTherapy%2BLobby.png?format=1500w',
  family: 'https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/0dac4deb-e22c-42de-9d48-eaf4df2628e5/Family%2Btherapy%2Bspace%2Bserving%2BSammamish%2Band%2BWoodinville%2Bclients..jpg?format=1500w',
  kody: 'https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/ed7383ec-060e-4649-93bb-7e71fcea4a21/Kody%2B026FINAL.jpg?format=1000w',
  taylor: 'https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/83275db3-920a-42f3-9c8e-618474a34b52/Screenshot%2B2026-05-19%2B131341.png?format=1000w',
  emily: 'https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/832941fe-27a3-4b13-97d9-720a96c1bed2/share_11d04f47-8070-419a-8260-d34a52f6984e.jpg?format=1000w',
  gary: 'https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/b81f7500-fa68-425b-b2a9-8b0029f1fc04/Gary%2BAshley%2BNew.png?format=1000w',
  sonia: 'https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/adfbbf96-f0ab-49ce-9f82-3c3a2906adc0/sonia.jpg?format=1000w'
};

const serviceData = [
  ['Individual Therapy','new-page','Individual therapy in Woodinville','Support for where you are and where you want to go.','A supportive place for adults navigating anxiety, stress, depression, ADHD, grief, relationship patterns, and major life transitions.',['Anxiety and stress','Depression and grief','Trauma and difficult experiences','ADHD and focus','Self-esteem and growth','Life transitions'],images.office],
  ['Marriage and Couples Therapy','marriage-and-couples-therapy-counseling','Couples therapy in Woodinville','Reconnect, rebuild trust, and move forward together.','Collaborative relationship care for communication, conflict, emotional distance, trust, parenting stress, and major decisions.',['Communication','Conflict and repair','Trust rebuilding','Emotional connection','Parenting stress','Life transitions'],images.family],
  ['Marriage.Reset.','marriagereset','A structured relationship program','A clear path toward a stronger relationship.','A clinically guided framework for couples who want a purposeful process with practical skills and a clear roadmap.',['Clinical intake','Relationship assessment','Pattern identification','Stabilization','Skill building','Long-term growth'],images.office],
  ['Teen Counseling','teen-counseling','Teen counseling for ages 13+','Support for teens. Tools for life.','A respectful space where teens can talk openly, build confidence, manage emotions, and navigate life with practical support.',['Anxiety and overthinking','School pressure','Family communication','Friendship challenges','Identity and self-esteem','Life transitions'],images.family],
  ['Child Therapy','childrentherapy','Child therapy for ages 4+','Helping children thrive today and tomorrow.','Developmentally appropriate support that helps children express themselves, build confidence, and develop useful emotional skills.',['Anxiety and worry','School and social stress','Behavior changes','Grief and loss','Family transitions','Trauma recovery'],images.family],
  ['Family Therapy','family-therapy-group-counseling','Family therapy in Woodinville','Stronger families. Healthier relationships.','A structured, supportive place for family members to feel heard and work toward clearer communication and a more connected home.',['Communication','Parenting concerns','Blended families','Life transitions','Conflict resolution','Connection and trust'],images.family],
  ['Premarital Counseling','new-page-1','Premarital counseling in Woodinville','Build a thoughtful foundation for marriage.','Guided conversations and practical tools for communication, conflict, values, expectations, trust, and connection.',['Communication','Conflict skills','Shared values','Family expectations','Trust and attachment','Future planning'],images.office],
  ['Couples Retreat','new-page-2','Couples retreat information','Retreat details are being reviewed.','Join the interest list to receive verified dates, location, availability, pricing, and program details after approval.',['Dates pending review','Location pending review','Availability pending review'],images.family]
];

const services = serviceData.map(([name,slug,eyebrow,h1,summary,items,image]) => ({
  type:'service', name, slug, eyebrow, h1, summary, items, image,
  title:`${name} in Woodinville, WA | M.F.T.`,
  description:`Learn about ${name.toLowerCase()} from Marriage.Family.Therapy in Woodinville, with online options for eligible clients across Washington.`,
  body:`Care is collaborative and tailored to the person, relationship, or family. Sessions can combine thoughtful reflection with practical tools that support meaningful change outside the therapy room.`,
  index: slug !== 'new-page-2', review: slug === 'new-page-2' ? 'Hold until all retreat facts are verified' : 'Clinical and operational review required'
}));

const clinicianData = [
  ['Kody Evans','kody-evans-bio','Licensed Marriage & Family Therapist; Founder & Clinical Director','Adults, individuals, couples, and families','Couples and relationship issues; Marriage counseling; ADHD; Anxiety; Depression; Family conflict; Parenting; Life transitions; Men’s issues; Self-esteem; Stress; Divorce and discernment','Kody works with adults, couples, and families who want to understand recurring patterns and make thoughtful, practical changes.',images.kody],
  ['Dr. Taylor Nolan','dr-nolan','Ph.D.; LMHC (WA); LCPC (MT); Certified Sexologist','Adults, individuals, couples, and partners','Relationship issues; Intimacy and sex therapy; Anxiety; Life transitions; Self-esteem; Identity exploration; Body image; Grief and loss; Stress; Personal growth','Taylor supports individuals and partners through a collaborative, person-centered approach focused on relationships, life challenges, and personal growth.',images.taylor],
  ['Emily Johnsrud','emily-johnsrud-bio','Licensed Marriage and Family Therapist Associate (LMFTA)','Children 6+, teens, adults, couples, and families','Anxiety; Depression; Relationship challenges; Life transitions; Trauma; Grief; Emotional regulation; Family stress','Emily works with children ages 6+, teens, adults, couples, and families navigating emotional, relational, and life-transition concerns.',images.emily],
  ['Gary Ashley','gary-ashley','Licensed Mental Health Counselor Associate (LMHCA)','Children, teens, adults, individuals, and couples','Anxiety; Depression; Trauma and PTSD; Grief and loss; Relationship issues; Divorce; Life transitions; Self-esteem; Stress; Men’s issues; Faith-integrated counseling','Gary supports children, teens, adults, and couples with person-centered, strengths-based, cognitive behavioral, motivational, and Gottman-informed approaches.',images.gary],
  ['Sonia Hassan','new-page-47','Licensed Social Work Associate Independent Clinical (LSWAIC)','Teens, adults, older adults, and couples','Anxiety; Grief and loss; Life transitions; Stress management; Emotional adjustment; Caregiver stress; Chronic pain','Sonia supports teens, adults, older adults, and couples through life transitions, anxiety, grief, stress, and emotional adjustment concerns.',images.sonia]
];

const clinicians = clinicianData.map(([name,slug,credential,clients,specialties,summary,image]) => ({
  type:'clinician', name:presentation.person(slug).name, slug, credential, clients, specialties, eyebrow:credential, h1:presentation.person(slug).name, summary, image,
  title:`${name} | Marriage.Family.Therapy`, description:`Meet ${name}, serving clients through Marriage.Family.Therapy in Woodinville and online in Washington.`,
  body:`Therapy is tailored to the client’s needs, goals, relationships, and experiences. Review populations served and focus areas, then use the secure appointment pathway for current availability.`,
  items:specialties.split('; '), index:true, review:'Clinician must confirm credentials, scope, specialties, availability, and photo'
}));

const concernData = [
  ['Anxiety and Stress','anxiety-stress-therapy','When worry, tension, or overwhelm keeps taking up too much space.',['Persistent worry','Overthinking','Stress and burnout','Panic or physical tension']],
  ['Depression and Mood','depression-therapy','Support for low mood, lost motivation, disconnection, and the patterns that make daily life feel heavier.',['Low mood','Reduced motivation','Isolation','Changes in routine']],
  ['ADHD and Neurodivergence','adhd-neurodivergence-therapy','Strength-aware support for attention, organization, emotional regulation, relationships, and everyday systems.',['Attention and focus','Organization','Emotional regulation','Relationship patterns']],
  ['Trauma Recovery','trauma-therapy','Trauma-informed support focused on safety, understanding, coping, and paced recovery.',['Difficult experiences','Triggers','Safety and trust','Coping skills']],
  ['Grief and Loss','grief-counseling','A steady place to process loss, changing roles, and the emotions that do not follow a simple timeline.',['Bereavement','Ambiguous loss','Changing identity','Family adjustment']],
  ['Self-Esteem and Identity','self-esteem-identity-therapy','Explore self-worth, identity, belonging, boundaries, and a more supportive relationship with yourself.',['Self-criticism','Identity questions','Boundaries','Confidence']],
  ['Relationship Concerns','relationship-issues-therapy','Understand recurring relationship patterns and build clearer, healthier ways of communicating and connecting.',['Conflict cycles','Emotional distance','Trust','Communication']],
  ['Parenting and Family Stress','parenting-family-stress-therapy','Support for parenting strain, family transitions, conflict, communication, and changing roles at home.',['Parenting stress','Family transitions','Co-parenting','Communication']],
  ['Life Transitions','life-transitions-therapy','Support through changes in work, relationships, family roles, location, identity, or direction.',['Career changes','Relationship changes','Relocation','New roles']],
  ['Substance Use and Recovery Support','substance-use-recovery-therapy','Therapy support for patterns of use, coping, relationships, motivation, and recovery goals when clinically appropriate.',['Triggers','Motivation','Coping','Family support']]
];

const concerns = concernData.map(([name,slug,summary,items]) => ({
  type:'concern', name, slug, eyebrow:'What we help with', h1:`Therapy for ${name}`, summary, items, image:images.office,
  title:`${name} | Therapy in WA | M.F.T.`,
  description:`Explore therapy support for ${name.toLowerCase()} in Woodinville and online for eligible clients across Washington State.`,
  body:'People experience concerns differently. Therapy begins with understanding what is happening in your life, what you want to change, and which kind of support fits your needs.',
  index:true, review:'Clinical review required before launch'
}));

const approachData = [
  ['Cognitive Behavioral Therapy','cognitive-behavioral-therapy-cbt','CBT','A structured approach that explores connections among thoughts, emotions, and behavior.'],
  ['Dialectical Behavior Therapy Skills','dialectical-behavior-therapy-dbt','DBT skills','Skills-oriented work that may support mindfulness, emotional regulation, distress tolerance, and relationships.'],
  ['Emotionally Focused Therapy','emotionally-focused-therapy-eft','EFT','An attachment-informed approach often used to understand emotional patterns and strengthen connection.'],
  ['Gottman Method Informed Therapy','gottman-method-couples-therapy','Gottman-informed','Relationship work informed by research on friendship, conflict, repair, trust, and shared meaning.'],
  ['Internal Family Systems Informed Therapy','internal-family-systems-ifs','IFS-informed','An approach that can help clients relate to different internal experiences with greater curiosity and compassion.'],
  ['Solution Focused Brief Therapy','solution-focused-brief-therapy','SFBT','A goal-oriented approach that notices strengths, exceptions, resources, and practical next steps.'],
  ['Narrative Therapy','narrative-therapy','Narrative therapy','An approach that separates people from problems and examines the stories shaping identity and possibility.'],
  ['Motivational Interviewing','motivational-interviewing','Motivational interviewing','A collaborative approach for exploring ambivalence, values, motivation, and personally meaningful change.'],
  ['Attachment Based Therapy','attachment-based-therapy','Attachment-based','Therapy informed by how early and current relationships can influence safety, connection, and response patterns.'],
  ['Family Systems Therapy','family-systems-therapy','Family systems','An approach that considers relationships, roles, patterns, and context rather than isolating one person as the problem.'],
  ['Mindfulness Based Therapy','mindfulness-based-therapy','Mindfulness-based','Practices that may help clients notice internal experiences and respond with greater awareness and choice.'],
  ['Trauma Informed Therapy','trauma-informed-therapy','Trauma-informed','Care organized around safety, choice, collaboration, trust, and sensitivity to the effects of difficult experiences.']
];

const approaches = approachData.map(([name,slug,short,summary]) => ({
  type:'approach', name, slug, eyebrow:'Therapy approaches', h1:name, summary, short, image:images.family,
  title:`${short} Therapy in Woodinville & WA | M.F.T.`,
  description:`Learn how ${name} may be used by appropriate Marriage.Family.Therapy clinicians in Woodinville and online across Washington.`,
  body:'No single method fits every person. Clinicians integrate approaches according to their training, scope, the client’s needs, and the goals established together.',
  items:['What the approach emphasizes','Questions to discuss with a therapist','How clinician fit is considered','When another approach may be more appropriate'],
  index:true, review:'Clinicians must confirm which team members use this approach and within what scope'
}));

const locationData = [
  ['Spokane','online-therapy-spokane-wa','Spokane and the Inland Northwest','Online therapy can reduce cross-town travel and widen the clinician search for eligible clients in Spokane, Spokane Valley, Liberty Lake, Cheney, Airway Heights, and nearby Washington communities.','Existing public page'],
  ['Yakima','online-therapy-yakima-wa','Yakima and the Yakima Valley','A statewide telehealth option for eligible clients balancing work, school, caregiving, and travel across Yakima Valley communities.','Existing public page'],
  ['Tri-Cities','online-therapy-tri-cities-wa','Kennewick, Pasco, Richland, and West Richland','One online pathway for eligible clients across the Tri-Cities who want to choose care based on fit, schedule, and benefits rather than one side of the river.','Existing public page'],
  ['Wenatchee','online-therapy-wenatchee-wa','Wenatchee and North Central Washington','Online therapy can widen the clinician search and reduce recurring regional travel for eligible clients in Wenatchee, East Wenatchee, and nearby communities.','Existing public page'],
  ['Vancouver','online-therapy-vancouver-wa','Vancouver and southwest Washington','Secure online care for eligible clients physically located in Washington, including Vancouver and nearby southwest Washington communities.','Existing public page'],
  ['Bothell','online-therapy-bothell-wa','Bothell and north King County','Clients near Bothell may consider the Woodinville office or online therapy while physically located in Washington, depending on clinical fit and availability.','Demand-supported draft'],
  ['Kirkland','online-therapy-kirkland-wa','Kirkland and the Eastside','A Woodinville-area and statewide online option for eligible Kirkland clients seeking individual, relationship, child, teen, or family support.','Demand-supported draft'],
  ['Redmond','online-therapy-redmond-wa','Redmond and the Eastside','Eligible Redmond clients can explore the nearby Woodinville office or meet online while physically located in Washington.','Demand-supported draft'],
  ['Bremerton','online-therapy-bremerton-wa','Bremerton and Kitsap County','Online therapy gives eligible Bremerton-area clients a statewide option without requiring recurring travel to the Woodinville office.','Demand-supported draft'],
  ['Fircrest','online-therapy-fircrest-wa','Fircrest and the South Sound','A statewide telehealth option for eligible clients in Fircrest and surrounding Washington communities.','Demand-supported draft'],
  ['King County','online-therapy-king-county-wa','King County, Washington','M.F.T. provides in-person care at its Woodinville office and online therapy for eligible clients physically located throughout King County.','Verified service-area hub'],
  ['Snohomish County','online-therapy-snohomish-county-wa','Snohomish County, Washington','Eligible clients in Snohomish County can explore secure telehealth and, when appropriate, the Woodinville office.','Verified service-area hub'],
  ['Oak Harbor','new-page-4','Oak Harbor and Whidbey Island','A corrected holding page for the publicly discoverable legacy Oak Harbor URL while its usefulness, final URL, and indexing status are reviewed.','Observed legacy page with broken template placeholders',false]
];

const locations = locationData.map(([name,slug,area,summary,status,index=true]) => ({
  type:'location', name:`Online Therapy in ${name}`, slug, area, status, eyebrow:area,
  h1:`Online Therapy in ${name}, Washington`, summary, image:images.office,
  title:`Online Therapy in ${name}, WA | M.F.T.`,
  description:`Secure online therapy for eligible clients in ${name} and elsewhere in Washington. Review clinicians, services, insurance support, and next steps.`,
  body:'Telehealth eligibility depends on the client’s physical location, clinical circumstances, clinician availability, and insurance benefits. M.F.T. does not claim a physical office in this community.',
  items:['Washington-licensed clinicians','Online appointments','Insurance verification available','Individual, relationship, child, teen, and family care'],
  index, review: status.includes('broken') ? 'HOLD: public legacy page contains unrelated locations and unresolved template placeholders' : status.includes('draft') ? 'Owner and clinical review required; confirm unique local usefulness before launch' : 'Operational and clinical review required'
}));

const resourceData = [
  ['How to Start Therapy','how-to-start-therapy','A clear first step can make beginning therapy feel more manageable.','Review services and clinicians, use the secure appointment pathway, and verify benefits when relevant.'],
  ['How to Choose a Therapist','how-to-choose-a-therapist','Fit includes more than a list of specialties.','Consider population served, approach, communication style, format, availability, benefits, and what you hope will change.'],
  ['Online or In Person Therapy','online-vs-in-person-therapy','Choose the format that supports appropriate, consistent care.','M.F.T. offers an office in Woodinville and secure online options for eligible clients located in Washington.'],
  ['Understanding Therapy Insurance Benefits','therapy-insurance-benefits','Coverage depends on the plan, clinician, service, network, and specific benefits.','Use the secure verification workflow before care begins and avoid relying on a general carrier logo alone.']
];

const resources = resourceData.map(([name,slug,summary,body]) => ({
  type:'resource', name, slug, eyebrow:'Practical guide', h1:name, summary, body, image:images.family,
  title:`${name} | Marriage.Family.Therapy`, description:`A practical M.F.T. guide to ${name.toLowerCase()} for people considering therapy in Woodinville or online in Washington.`,
  items:['Clarify what you are looking for','Review current clinician information','Use secure practice workflows','Ask questions before ongoing care'],
  index:true, review:'Editorial and clinical review required'
}));

const assessment = {
  type:'assessment',
  name:'Marriage.Reset Assessment',
  slug:'marriage-reset-assessment',
  eyebrow:'Free relationship assessment access',
  h1:'Start by discovering your relationship.',
  summary:'Each partner answers separately. Marriage.Reset helps you identify the conversations that may deserve a closer look together.',
  title:'Free Marriage.Reset Relationship Assessment | M.F.T.',
  description:'Request free access for both partners to the Marriage.Reset relationship assessment from Marriage.Family.Therapy.',
  body:'Marriage.Reset is a therapist-built relationship program designed to help couples understand what may be happening beneath recurring conversations and decide what deserves attention next.',
  items:['Two separate partner experiences','Progressive questions','Focused areas for reflection','A clearer next conversation'],
  image:images.family,
  index:true,
  review:'Approve copy, privacy notice, email workflow, retention schedule, and assessment access process before production launch'
};

const assessmentThanks = {
  type:'assessment-thanks',
  name:'Assessment Access Requested',
  slug:'marriage-reset-assessment/thanks',
  eyebrow:'Request received',
  h1:'Your Marriage.Reset access request is in.',
  summary:'M.F.T. will review the request and email each partner with the next step.',
  title:'Assessment Access Requested | Marriage.Reset',
  description:'Confirmation that a Marriage.Reset assessment access request was submitted.',
  body:'Please allow time for the access emails to arrive and check spam or junk folders. For privacy, do not send relationship details by email.',
  items:['Both addresses will receive separate instructions','No relationship details are needed by email','Participation remains voluntary','The assessment is not therapy or emergency support'],
  image:images.office,
  index:false,
  review:'Operational confirmation page; keep noindex'
};

const core = [
  {type:'home',name:'Home',slug:'',eyebrow:'Marriage.Family.Therapy',h1:'Therapy that is kind, practical, and focused on what matters to you.',summary:'In-person care in Woodinville and secure telehealth options for eligible clients across Washington State.',title:'Marriage.Family.Therapy | Woodinville & Online in Washington',description:'Therapy for individuals, couples, children, teens, and families in Woodinville, with online care available across Washington State.',body:'Meet with a therapist who brings empathy, useful tools, and a plan shaped around your goals. Explore services and clinicians or begin through the secure client-care system.',items:['Individual therapy','Marriage and couples therapy','Child and teen counseling','Family therapy'],image:images.family,index:true,review:'Owner approval required'},
  {type:'hub',name:'Services',slug:'services',eyebrow:'Care across life stages',h1:'Therapy services for individuals, relationships, and families.',summary:'Explore in-person care in Woodinville and online therapy for eligible clients located across Washington.',title:'Therapy Services in Woodinville & Washington | M.F.T.',description:'Explore individual, couples, child, teen, family, premarital, and structured relationship therapy from Marriage.Family.Therapy.',body:'The right starting point depends on who needs support, what is getting in the way, and the kind of care that feels appropriate.',items:services.map(x=>x.name),image:images.office,index:true,review:'Clinical review required',children:'services'},
  {type:'hub',name:'What We Help With',slug:'what-we-help-with',eyebrow:'Concerns and goals',h1:'Start with what is affecting daily life.',summary:'Explore common reasons people seek therapy, then review clinicians and services that may fit.',title:'What We Help With | Therapy in Woodinville & Washington',description:'Explore concerns supported by Marriage.Family.Therapy, including anxiety, relationships, ADHD, grief, trauma, family stress, and life transitions.',body:'These guides provide orientation, not diagnosis or a promise that every clinician treats every concern.',items:concerns.map(x=>x.name),image:images.family,index:true,review:'Clinical review required',children:'concerns'},
  {type:'hub',name:'Therapy Approaches',slug:'therapy-approaches',eyebrow:'How therapy may work',h1:'Approaches tailored to the client and the work.',summary:'Learn about approaches represented across clinician profiles and discuss the exact fit with your therapist.',title:'Therapy Approaches in Woodinville & Washington | M.F.T.',description:'Learn about therapy approaches used by appropriate M.F.T. clinicians, including CBT, DBT skills, EFT, Gottman-informed work, and family systems.',body:'Training and use vary by clinician. Profiles and direct confirmation remain the source of truth for a specific therapist.',items:approaches.map(x=>x.short),image:images.office,index:true,review:'Clinician review required',children:'approaches'},
  {type:'hub',name:'Resources',slug:'resources',eyebrow:'Practical information',h1:'Clear information for choosing and beginning care.',summary:'Use these guides to understand common first steps without sharing private clinical information on the public website.',title:'Therapy Resources | Marriage.Family.Therapy',description:'Practical guides for starting therapy, choosing a therapist, comparing online and in-person care, and understanding insurance verification.',body:'For personal scheduling, insurance, or clinical questions, use the approved secure workflows or contact the practice directly.',items:resources.map(x=>x.name),image:images.family,index:true,review:'Editorial review required',children:'resources'},
  {type:'team',name:'Our Team',slug:'team',eyebrow:'Meet the team',h1:'Find a therapist whose experience and style fit your needs.',summary:'Review populations served, specialties, credentials, and current appointment pathways for the Marriage.Family.Therapy team.',title:'Therapists in Woodinville & Washington | M.F.T. Team',description:'Meet the Marriage.Family.Therapy team serving Woodinville and eligible telehealth clients across Washington State.',body:'Availability can change. Use the secure appointment system for current options and contact the practice when you would like help choosing a clinician.',items:clinicians.map(x=>x.name),image:images.family,index:true,review:'Every team member must approve profile details'},
  {type:'standard',name:'About',slug:'about',eyebrow:'About Marriage.Family.Therapy',h1:'Compassionate, practical care for the relationships that shape your life.',summary:'The practice supports children, teens, adults, couples, and families with individualized, evidence-informed care.',title:'About Marriage.Family.Therapy | Woodinville, WA',description:'Learn about Marriage.Family.Therapy’s family-centered approach for children, teens, adults, couples, and families in Woodinville and Washington.',body:'Care is collaborative and tailored to each client. The practice combines warmth, thoughtful reflection, and practical strategies that can be used beyond the therapy room.',items:['Collaborative care','Family-centered support','Practical tools','In-person and online options'],image:images.office,index:true,review:'Owner and clinical review required'},
  {type:'contact',name:'Contact',slug:'therapy-contact-woodinville',eyebrow:'Contact M.F.T.',h1:'Begin your therapy journey with a clear next step.',summary:'Contact the practice, request an appointment securely, or review clinicians before choosing how to begin.',title:'Contact Marriage.Family.Therapy | Woodinville, WA',description:'Contact Marriage.Family.Therapy in Woodinville, Washington. Request an appointment securely, review the team, or call the office.',body:'Phone: (425) 659-0654. Email: Support@mft.care. Office: 19151 NE 144th Ave, Suite L, Woodinville, WA 98072.',items:['Woodinville office','Secure appointment request','Washington telehealth','Insurance verification'],image:images.family,index:true,review:'Confirm address, phone, email, hours, and directions'},
  {type:'insurance',name:'Insurance',slug:'check-my-coverage',eyebrow:'Insurance support',h1:'Check your benefits before care begins.',summary:'Use the secure insurance workflow to verify benefits and receive information about likely coverage before beginning care.',title:'Verify Insurance for Therapy | Marriage.Family.Therapy',description:'Use Marriage.Family.Therapy’s secure insurance verification process before beginning therapy in Woodinville or online in Washington.',body:'Network participation and benefits can vary by clinician, service, and plan. Couples sessions remain private pay unless the practice confirms otherwise.',items:['Secure external workflow','Plan-specific verification','No insurance data in this website','Out-of-network questions welcome'],image:images.office,index:true,review:'Confirm every insurance and payment statement'},
  {type:'online',name:'Online Therapy in Washington',slug:'online-therapy-washington',eyebrow:'Statewide telehealth',h1:'Online therapy throughout Washington State.',summary:'Meet securely with an appropriate clinician while you are physically located in Washington.',title:'Online Therapy in Washington State | M.F.T.',description:'Online therapy for eligible clients across Washington State, including individual, couples, child, teen, family, and premarital support.',body:'The physical office is in Woodinville. Telehealth expands access across Washington without implying a branch office in every community.',items:['Individual therapy','Marriage and couples therapy','Children and teens','Family therapy'],image:images.office,index:true,review:'Confirm statewide eligibility and service availability'},
  {type:'directory',name:'Washington Locations',slug:'online-therapy-locations',eyebrow:'Washington service areas',h1:'Explore online therapy by Washington region.',summary:'M.F.T. has one physical office in Woodinville and serves eligible telehealth clients located across Washington.',title:'Online Therapy Locations in Washington | M.F.T.',description:'Browse M.F.T. online therapy information for Washington communities and counties. Woodinville is the practice’s only physical office.',body:'Location pages describe access to statewide telehealth. They do not represent local branch offices, and publication requires a useful, distinct reason for each page.',items:locations.map(x=>x.name),image:images.family,index:true,review:'Review every location page for usefulness and no-office clarity',children:'locations'}
];

const allPages = [...core, ...services, assessment, assessmentThanks, ...clinicians, ...locations, ...concerns, ...approaches, ...resources];

const collections = { services, clinicians, locations, concerns, approaches, resources };
const esc = (v='') => String(v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const urlFor = p => `${SITE}${p.slug ? `/${p.slug}` : '/'}`;
const localFor = p => p.slug ? `/${p.slug}/` : '/';
const write = (file, content) => { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, content); };
const safeJson = obj => JSON.stringify(obj).replace(/</g, '\\u003c');

function relatedFor(p) {
  if (p.children && collections[p.children]) return collections[p.children];
  if (p.slug === 'marriagereset') return [assessment, services.find(x=>x.slug==='marriage-and-couples-therapy-counseling'), resources.find(x=>x.slug==='how-to-start-therapy')];
  if (p.type === 'service') return concerns.slice(0,4);
  if (p.type === 'concern') return [...services.slice(0,2), ...clinicians.slice(0,2)];
  if (p.type === 'approach') return clinicians.slice(0,4);
  if (p.type === 'location') return [core.find(x=>x.slug==='online-therapy-washington'), ...services.slice(0,3)];
  if (p.type === 'clinician') return services.slice(0,4);
  if (p.type === 'resource') return [core.find(x=>x.slug==='team'), core.find(x=>x.slug==='check-my-coverage'), core.find(x=>x.slug==='online-therapy-washington')];
  if (p.type.startsWith('assessment')) return [assessment, services.find(x=>x.slug==='marriagereset'), services.find(x=>x.slug==='marriage-and-couples-therapy-counseling')];
  return services.slice(0,4);
}

function breadcrumb(p) {
  const parent = p.type === 'service' ? ['Services','/services/'] : p.type === 'clinician' ? ['Team','/team/'] : p.type === 'location' ? ['Locations','/online-therapy-locations/'] : p.type === 'concern' ? ['What We Help With','/what-we-help-with/'] : p.type === 'approach' ? ['Therapy Approaches','/therapy-approaches/'] : p.type === 'resource' ? ['Resources','/resources/'] : p.type.startsWith('assessment') ? ['Marriage.Reset','/marriagereset/'] : null;
  const links = [{name:'Home',href:'/'}];
  if (parent) links.push({name:parent[0],href:parent[1]});
  if (p.slug) links.push({name:p.name,href:localFor(p)});
  return links;
}

function schemaFor(p, crumbs) {
  const graph = [
    {'@type':'Organization','@id':`${SITE}/#organization`,name:'Marriage.Family.Therapy',url:`${SITE}/`,telephone:'+1-425-659-0654',email:'Support@mft.care',address:{'@type':'PostalAddress',streetAddress:'19151 NE 144th Ave, Suite L',addressLocality:'Woodinville',addressRegion:'WA',postalCode:'98072',addressCountry:'US'}},
    {'@type':'WebSite','@id':`${SITE}/#website`,url:`${SITE}/`,name:'Marriage.Family.Therapy',publisher:{'@id':`${SITE}/#organization`}},
    {'@type':'WebPage','@id':`${urlFor(p)}#webpage`,url:urlFor(p),name:p.title,description:p.description,isPartOf:{'@id':`${SITE}/#website`},about:{'@id':`${SITE}/#organization`}},
    {'@type':'BreadcrumbList','@id':`${urlFor(p)}#breadcrumb`,itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,name:c.name,item:`${SITE}${c.href}`}))}
  ];
  if (p.type === 'clinician') graph.push({'@type':'Person','@id':`${urlFor(p)}#person`,name:p.name,jobTitle:p.credential,image:p.image,url:urlFor(p),worksFor:{'@id':`${SITE}/#organization`}});
  return {'@context':'https://schema.org','@graph':graph};
}

function nav() {
  return `<header class="site-header"><a class="brand" href="/" aria-label="Marriage Family Therapy home"><span class="brand-mark">M.F.T.</span><span class="brand-name">Marriage.Family.Therapy</span></a><button class="menu-button" aria-expanded="false" aria-controls="primary-nav"><span></span><span></span><span></span><span class="sr-only">Menu</span></button><nav id="primary-nav" class="primary-nav" aria-label="Primary"><a href="/services/">Services</a><a href="/what-we-help-with/">What we help with</a><a href="/team/">Team</a><a href="/online-therapy-washington/">Online therapy</a><a href="/resources/">Resources</a><a class="nav-action" href="${APPOINTMENT}">Request appointment</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="footer-grid"><div><a class="footer-brand" href="/">Marriage.Family.Therapy</a><p>In-person care in Woodinville and secure telehealth for eligible clients physically located in Washington State.</p></div><div><h2>Contact</h2><p><a href="tel:+14256590654">(425) 659-0654</a><br><a href="mailto:Support@mft.care">Support@mft.care</a><br>19151 NE 144th Ave, Suite L<br>Woodinville, WA 98072</p><p><a href="${DIRECTIONS}">Get directions</a></p></div><div><h2>Start here</h2><p><a href="${APPOINTMENT}">Request appointment</a><br><a href="${INSURANCE}">Verify insurance</a><br><a href="${PORTAL}">Existing client portal</a></p></div></div><div class="footer-bottom"><span>© ${new Date().getUTCFullYear()} Marriage.Family.Therapy</span><span>This website is not an emergency service. If you are in immediate danger or experiencing a life-threatening emergency, call 911 or go to the nearest emergency department.</span></div></footer>`;
}

function related(p) {
  const items = relatedFor(p).filter(x=>x && x.slug!==p.slug).slice(0,12);
  const title = p.children ? `Explore ${p.name.toLowerCase()}` : 'Continue exploring';
  return `<section class="section related reveal"><div class="section-heading"><p class="kicker">Related information</p><h2>${esc(title)}</h2></div><div class="link-grid">${items.map(x=>`<a href="${localFor(x)}"><span>${esc(x.name)}</span><small>${esc(x.summary || x.eyebrow)}</small><b aria-hidden="true">→</b></a>`).join('')}</div></section>`;
}

function teamGrid() {
  return `<section class="section team-section"><div class="section-heading"><p class="kicker">Clinicians</p><h2>Meet the therapy team.</h2><p>Review each profile for populations served, credentials, focus areas, and current pathways.</p></div><div class="people-grid">${clinicians.map(c=>`<a class="person" href="${localFor(c)}">${presentation.portrait(c.image,c.name,'directory')}${presentation.identity(c.slug,'b')}</a>`).join('')}</div><div class="staff-note"><h3>Clinical operations</h3><p><b>Charlene Brister, Clinical Manager</b><br>Client support, clinical operations, care coordination, and practice growth.</p></div></section>`;
}

function assessmentBody() {
  return `<section id="how-it-works" class="section assessment-intro reveal"><div class="section-heading"><p class="kicker">What is Marriage.Reset?</p><h2>Better conversations start with understanding what is really happening.</h2></div><div class="prose"><p>Relationships rarely struggle because two people simply have not talked enough. Often, they have talked about the same subjects many times: money, sex, parenting, family, chores, trust, time, work, closeness, or feeling alone.</p><p>The conversation on the surface is not always the conversation underneath. A disagreement about money may also involve responsibility. Chores may raise questions about care. Family decisions may bring up loyalty. Marriage.Reset helps couples slow those moments down and begin discovering what is happening between them.</p></div></section>
  <section class="section assessment-band reveal"><div class="section-heading"><p class="kicker">You do not have to know where to start</p><h2>Begin with each partner's experience.</h2></div><div class="assessment-columns"><div><h3>Two people. One relationship. Two experiences.</h3><p>One partner may experience a conversation as an attempt to connect while the other experiences criticism. One may believe they are giving space while the other experiences distance. Marriage.Reset gives each person room to reflect before the couple makes sense of what they are creating together.</p></div><div><h3>Progressive assessment</h3><p>The assessment explores areas such as safety, regulation, patterns, emotional access, respect, understanding, attachment, intimacy, support, equality, empathy, affection, and belonging. Follow-up questions can become more specific without making every couple complete the same enormous questionnaire.</p></div></div></section>
  <section class="section assessment-intro reveal"><div class="section-heading"><p class="kicker">From assessment to conversation</p><h2>Find the next conversation worth having.</h2></div><div class="prose"><p>The assessment is not designed to declare a relationship good or bad, decide who is right, or reduce two people to a score. It is intended to help identify areas that appear strong, areas that may be difficult, and places where further exploration may be useful.</p><p>Marriage.Reset can then connect couples with focused conversations, reflections, exercises, and practices. The purpose is not to label your relationship. It is to help you approach important conversations with less accusation and mind-reading, and with more reflection, curiosity, understanding, and choice.</p></div></section>
  <section id="request-access" class="section assessment-band reveal"><div class="section-heading"><p class="kicker">Free access for now</p><h2>Request access for both partners.</h2><p>We currently provide the assessment without charge. Enter only the two email addresses needed to send separate access instructions. Do not include relationship, clinical, insurance, or emergency information.</p></div><form class="access-form" name="marriage-reset-access" method="POST" action="/marriage-reset-assessment/thanks/" data-netlify="true" data-netlify-honeypot="bot-field"><input type="hidden" name="form-name" value="marriage-reset-access"><p class="honeypot"><label>Do not fill this out <input name="bot-field" autocomplete="off"></label></p><div class="form-field"><label for="your-email">Your email address</label><input id="your-email" name="your-email" type="email" autocomplete="email" required></div><div class="form-field"><label for="partner-email">Your partner's email address</label><input id="partner-email" name="partner-email" type="email" autocomplete="off" required></div><label class="form-check"><input name="partner-permission" type="checkbox" value="confirmed" required><span>I confirm that my partner gave me permission to provide their email address and receive a Marriage.Reset invitation.</span></label><label class="form-check"><input name="program-understanding" type="checkbox" value="confirmed" required><span>I understand that requesting or using this assessment does not create a therapist-client relationship and is not therapy, diagnosis, crisis support, or emergency care.</span></label><button class="form-submit" type="submit">Request free access</button><p class="form-note">By submitting, you are asking M.F.T. to email both addresses about assessment access. Participation is voluntary. Please do not submit relationship details or other sensitive information.</p></form></section>
  <section class="section assessment-intro reveal"><div class="section-heading"><p class="kicker">With therapy or on your own</p><h2>A place to begin, not a substitute for care.</h2></div><div class="prose"><p>Marriage.Reset can be used independently or alongside couples therapy. A therapist may help when partners repeatedly become stuck or when an issue needs more support than a self-guided program can provide.</p><p>This assessment is not appropriate for emergencies or situations where participating together could feel unsafe or coerced. If you are in immediate danger or experiencing a life-threatening emergency, call 911 or go to the nearest emergency department.</p><p>Relationships keep changing. Marriage.Reset is designed to support renewed reflection over time: reassess, recognize growth, and discover what deserves attention now.</p></div></section>`;
}

function assessmentThanksBody() {
  return `<section class="section assessment-intro reveal"><div class="section-heading"><p class="kicker">What happens next</p><h2>Look for two separate access emails.</h2></div><div class="prose"><p>M.F.T. will use the submitted addresses only to administer the Marriage.Reset access request and related program communication, subject to the practice's approved privacy and retention procedures.</p><p>Do not reply with relationship details, assessment answers, clinical information, insurance information, or emergency concerns.</p><p><a class="text-link" href="/marriagereset/">Learn more about Marriage.Reset</a></p></div></section>`;
}

function pageBody(p) {
  if (p.type === 'assessment') return assessmentBody();
  if (p.type === 'assessment-thanks') return assessmentThanksBody();
  const list = (p.items || []).map(x=>`<li>${esc(x)}</li>`).join('');
  const clinicianDetail = p.type === 'clinician' ? `<dl class="facts"><div><dt>Clients</dt><dd>${esc(p.clients)}</dd></div><div><dt>Focus areas</dt><dd>${esc(p.specialties)}</dd></div></dl>` : '';
  const locationNote = p.type === 'location' ? `<p class="clarifier"><b>Location clarity:</b> M.F.T.’s physical office is in Woodinville. This page describes statewide telehealth access and does not represent an office in ${esc(p.name.replace('Online Therapy in ',''))}.</p>` : '';
  const contactExtra = p.type === 'contact' ? `<div class="contact-actions"><a href="tel:+14256590654"><b>Call</b><span>(425) 659-0654</span></a><a href="mailto:Support@mft.care"><b>Email</b><span>Support@mft.care</span></a><a href="${DIRECTIONS}"><b>Visit</b><span>Woodinville directions</span></a></div>` : '';
  return `<section class="section content-section reveal"><div class="section-heading"><p class="kicker">How we can help</p><h2>Care begins with understanding what matters now.</h2></div><div class="prose"><p>${esc(p.body)}</p><p>In-person appointments are available in Woodinville. Secure telehealth may be available to eligible clients physically located in Washington, subject to clinical fit, clinician availability, and applicable requirements.</p>${locationNote}</div></section>${clinicianDetail}${contactExtra}<section class="section focus-section reveal"><div class="section-heading"><p class="kicker">At a glance</p><h2>A clear place to begin.</h2></div><ul class="focus-list">${list}</ul></section>`;
}

function pageHtml(p) {
  const crumbs = breadcrumb(p);
  const robots = INDEXING && p.index ? 'index,follow,max-image-preview:large' : 'noindex,nofollow';
  const canonical = urlFor(p);
  const schema = schemaFor(p, crumbs);
  const heroAlt = p.type === 'clinician' ? `${p.name}, clinician at Marriage.Family.Therapy` : 'Marriage.Family.Therapy counseling space in Woodinville, Washington';
  const breadcrumbHtml = crumbs.map((c,i)=>`${i?'<span aria-hidden="true">/</span>':''}<a href="${c.href}"${i===crumbs.length-1?' aria-current="page"':''}>${esc(c.name)}</a>`).join('');
  const extra = p.type === 'team' ? teamGrid() : '';
  const heroActions = p.type === 'assessment' ? '<a class="button primary" href="#request-access">Request free access</a><a class="button ghost" href="#how-it-works">How it works</a>' : p.type === 'assessment-thanks' ? '<a class="button primary" href="/marriagereset/">Learn about Marriage.Reset</a>' : p.slug === 'marriagereset' ? '<a class="button primary" href="/marriage-reset-assessment/">Start the free assessment</a><a class="button ghost" href="https://ops.mft.care/">Request appointment</a>' : `<a class="button primary" href="${APPOINTMENT}">Request appointment</a><a class="button ghost" href="${INSURANCE}">Verify insurance</a>`;
  const finalCta = p.type.startsWith('assessment') ? '' : `<section class="section final-cta reveal"><p class="kicker">Next step</p><h2>Start through the secure client-care system.</h2><p>Review current appointment options without placing private clinical or insurance information in this public website.</p><div class="actions"><a class="button light" href="${APPOINTMENT}">Request appointment</a><a class="button ghost" href="${PORTAL}">Existing client portal</a></div></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="Marriage.Family.Therapy"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${esc(p.image)}"><meta name="twitter:card" content="summary_large_image">${VERIFY?`<meta name="google-site-verification" content="${esc(VERIFY)}">`:''}<meta name="theme-color" content="#163f3d"><link rel="stylesheet" href="/assets/styles.css"><script type="application/ld+json">${safeJson(schema)}</script></head><body><a class="skip-link" href="#main">Skip to content</a>${nav()}<main id="main"><nav class="breadcrumbs" aria-label="Breadcrumb">${breadcrumbHtml}</nav>${p.type==='clinician'?presentation.hero(p,heroActions):`<section class="hero"><img class="hero-media" src="${p.image}" alt="${esc(heroAlt)}" fetchpriority="high" referrerpolicy="no-referrer"><div class="hero-shade"></div><div class="hero-copy reveal"><p class="kicker">${esc(p.eyebrow)}</p><h1>${esc(p.h1)}</h1><p class="hero-summary">${esc(p.summary)}</p><div class="actions">${heroActions}</div></div></section>`}${pageBody(p)}${extra}${related(p)}${finalCta}</main>${footer()}<script src="/assets/site.js" defer></script></body></html>`;
}

const css = `:root{--ink:#173e3c;--deep:#102f2e;--teal:#2a6662;--mist:#edf4f1;--paper:#fbfaf6;--gold:#c69b4c;--white:#fff;--line:rgba(23,62,60,.18);--serif:Georgia,'Times New Roman',serif;--sans:Arial,Helvetica,sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 var(--sans)}body.menu-open{overflow:hidden}a{color:inherit}img{display:block;max-width:100%}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.skip-link{position:fixed;left:1rem;top:-100px;background:#fff;padding:.75rem 1rem;z-index:100}.skip-link:focus{top:1rem}.site-header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(1rem,4vw,4.5rem);background:rgba(251,250,246,.97);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:50}.brand{display:flex;align-items:center;gap:.75rem;text-decoration:none}.brand-mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--gold);font:700 .73rem var(--serif)}.brand-name{font:700 1rem var(--serif)}.primary-nav{display:flex;align-items:center;gap:1.2rem}.primary-nav a{text-decoration:none;font-size:.86rem}.nav-action{background:var(--ink);color:#fff;padding:.65rem .9rem}.menu-button{display:none;width:44px;height:44px;background:none;border:0;padding:10px}.menu-button span:not(.sr-only){display:block;height:2px;background:var(--ink);margin:5px 0}.breadcrumbs{max-width:1480px;margin:auto;padding:.65rem clamp(1rem,4vw,4.5rem);font-size:.75rem;color:#53706e}.breadcrumbs a{text-decoration:none}.breadcrumbs span{padding:0 .5rem}.hero{min-height:calc(82svh - 112px);position:relative;display:grid;align-items:end;overflow:hidden;background:var(--deep)}.hero-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,38,36,.92) 0%,rgba(9,38,36,.67) 48%,rgba(9,38,36,.22) 100%)}.hero-copy{position:relative;z-index:1;color:#fff;max-width:850px;padding:clamp(3rem,8vw,8rem) clamp(1rem,7vw,7rem)}.kicker{text-transform:uppercase;letter-spacing:.14em;font-weight:700;font-size:.73rem;color:var(--gold);margin:0 0 .7rem}h1,h2,h3{font-family:var(--serif);font-weight:500;line-height:1.08;letter-spacing:0}h1{font-size:clamp(2.7rem,6vw,5.7rem);margin:0 0 1.2rem;max-width:820px}h2{font-size:clamp(2rem,4vw,3.35rem);margin:.1rem 0 1rem}h3{font-size:1.4rem}.hero-summary{font-size:clamp(1rem,1.7vw,1.26rem);max-width:680px;margin:0}.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2rem}.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:.75rem 1.05rem;border:1px solid #fff;text-decoration:none;font-weight:700}.button.primary,.button.light{background:#fff;color:var(--ink)}.button.ghost{background:transparent;color:#fff}.section{padding:clamp(4rem,8vw,8rem) clamp(1rem,7vw,7rem)}.content-section,.focus-section{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(2rem,7vw,8rem);align-items:start}.content-section{background:var(--mist)}.section-heading{max-width:640px}.section-heading>p:not(.kicker){font-size:1.05rem}.prose{max-width:720px;font-size:1.08rem}.prose p:first-child{margin-top:0}.clarifier{border-top:2px solid var(--gold);padding-top:1rem}.focus-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.focus-list li{padding:1.05rem 0;border-bottom:1px solid var(--line)}.focus-list li:nth-child(odd){padding-right:1rem}.focus-list li:nth-child(even){padding-left:1rem;border-left:1px solid var(--line)}.facts{margin:0;padding:0 clamp(1rem,7vw,7rem) clamp(4rem,8vw,8rem);display:grid;grid-template-columns:1fr 2fr}.facts div{padding:1.5rem;border-top:1px solid var(--line)}.facts dt{font-weight:700}.facts dd{margin:.5rem 0 0}.contact-actions{padding:0 clamp(1rem,7vw,7rem) clamp(4rem,8vw,8rem);display:grid;grid-template-columns:repeat(3,1fr)}.contact-actions a{padding:1.5rem;border-top:1px solid var(--line);text-decoration:none;display:flex;flex-direction:column}.related{background:#fff}.link-grid{border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.link-grid a{display:grid;grid-template-columns:1fr auto;gap:.35rem 1rem;padding:1.25rem 0;text-decoration:none;border-bottom:1px solid var(--line)}.link-grid a:nth-child(odd){padding-right:1.25rem}.link-grid a:nth-child(even){padding-left:1.25rem;border-left:1px solid var(--line)}.link-grid span{font:500 1.2rem var(--serif)}.link-grid small{grid-column:1;line-height:1.4;color:#4f6d6b}.link-grid b{grid-column:2;grid-row:1/3;align-self:center;color:var(--gold);font-size:1.3rem}.team-section{background:var(--mist)}.people-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1rem;margin-top:2.5rem}.person{text-decoration:none}.person img{width:100%;aspect-ratio:4/5;object-fit:cover;background:#dfe8e4}.person span{display:block;padding:1rem 0}.person b,.person small{display:block}.person small{line-height:1.35;margin-top:.35rem;color:#4f6d6b}.staff-note{max-width:700px;border-top:1px solid var(--line);margin-top:3rem;padding-top:1.5rem}.final-cta{background:var(--deep);color:#fff;text-align:center}.final-cta>p:not(.kicker),.final-cta h2{max-width:700px;margin-left:auto;margin-right:auto}.final-cta .actions{justify-content:center}.site-footer{background:#0a2726;color:#fff;padding:4rem clamp(1rem,7vw,7rem) 2rem}.footer-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:3rem}.footer-grid h2{font:700 .75rem var(--sans);text-transform:uppercase;letter-spacing:.14em;color:var(--gold)}.footer-brand{font:500 1.5rem var(--serif);text-decoration:none}.footer-bottom{margin-top:3rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.2);display:grid;grid-template-columns:.5fr 1.5fr;gap:2rem;font-size:.78rem;opacity:.78}.reveal{opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .55s ease}.reveal.in{opacity:1;transform:none}@media(max-width:980px){.primary-nav{gap:.7rem}.primary-nav a{font-size:.77rem}.people-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.site-header{height:68px}.brand-name{display:none}.menu-button{display:block}.primary-nav{display:none;position:fixed;top:68px;inset-inline:0;bottom:0;background:var(--paper);padding:2rem;align-items:stretch;flex-direction:column;gap:0}.primary-nav.open{display:flex}.primary-nav a{font-size:1rem;padding:1rem 0;border-bottom:1px solid var(--line)}.nav-action{background:none;color:var(--ink)}.hero{min-height:calc(82svh - 101px)}.hero-shade{background:linear-gradient(0deg,rgba(9,38,36,.93),rgba(9,38,36,.35))}.content-section,.focus-section,.facts,.footer-grid,.footer-bottom{grid-template-columns:1fr}.focus-list,.link-grid{grid-template-columns:1fr}.focus-list li:nth-child(even),.link-grid a:nth-child(even){padding-left:0;border-left:0}.link-grid a:nth-child(odd){padding-right:0}.people-grid{grid-template-columns:repeat(2,1fr)}.contact-actions{grid-template-columns:1fr}.footer-grid{gap:1.5rem}}@media(max-width:420px){.people-grid{grid-template-columns:1fr}.hero-copy{padding-bottom:3rem}h1{font-size:2.55rem}.actions{display:grid}.button{width:100%}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.reveal{opacity:1;transform:none;transition:none}}`;

const formCss = `.assessment-intro{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(2rem,7vw,8rem);align-items:start}.assessment-band{background:var(--mist)}.assessment-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(2rem,5vw,5rem);margin-top:2rem}.assessment-columns>div{border-top:2px solid var(--gold);padding-top:1rem}.access-form{max-width:720px;background:#fff;border-top:4px solid var(--gold);padding:clamp(1.25rem,4vw,2.5rem);box-shadow:0 14px 40px rgba(16,47,46,.08)}.form-field{display:grid;gap:.4rem;margin-bottom:1.2rem}.form-field label{font-weight:700}.form-field input{width:100%;min-height:50px;border:1px solid var(--line);border-radius:0;background:#fff;color:var(--ink);font:inherit;padding:.7rem .8rem}.form-field input:focus{outline:3px solid rgba(198,155,76,.35);border-color:var(--ink)}.form-check{display:grid;grid-template-columns:22px 1fr;gap:.75rem;align-items:start;margin:1rem 0;font-size:.94rem}.form-check input{width:18px;height:18px;margin-top:.2rem;accent-color:var(--ink)}.form-submit{min-height:50px;border:1px solid var(--ink);border-radius:0;background:var(--ink);color:#fff;font:700 1rem var(--sans);padding:.75rem 1.1rem;cursor:pointer;margin-top:.5rem}.form-submit:hover,.form-submit:focus{background:var(--teal)}.form-note{font-size:.78rem;line-height:1.5;color:#4f6d6b;margin:1rem 0 0}.honeypot{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}.text-link{font-weight:700;text-underline-offset:.2em}@media(max-width:760px){.assessment-intro,.assessment-columns{grid-template-columns:1fr}.access-form{margin-top:2rem}}`;

const js = `document.querySelector('.menu-button')?.addEventListener('click',e=>{const n=document.querySelector('.primary-nav');const open=n.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));document.body.classList.toggle('menu-open',open)});const o=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target)}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>o.observe(e));`;

fs.rmSync(DIST, {recursive:true, force:true});
write(path.join(DIST,'assets/styles.css'), css + formCss);
write(path.join(DIST,'assets/site.js'), js);
for (const p of allPages) {
  const file = p.slug ? path.join(DIST,p.slug,'index.html') : path.join(DIST,'index.html');
  write(file, pageHtml(p));
}

const robots = INDEXING ? `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n` : `User-agent: *\nDisallow: /\n`;
write(path.join(DIST,'robots.txt'), robots);
const indexed = allPages.filter(p=>p.index);
write(path.join(DIST,'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed.map(p=>`  <url><loc>${urlFor(p)}</loc></url>`).join('\n')}\n</urlset>\n`);
write(path.join(DIST,'llms.txt'), `# Marriage.Family.Therapy\n\nOfficial website: ${SITE}/\n\nMarriage.Family.Therapy provides in-person therapy from one physical office in Woodinville, Washington, and online therapy for eligible clients physically located in Washington State. Appointment and insurance workflows are external secure services. This website is not an emergency service.\n`);
write(path.join(DIST,'404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Page not found | M.F.T.</title><link rel="stylesheet" href="/assets/styles.css"></head><body>${nav()}<main id="main"><section class="section"><p class="kicker">404</p><h1>That page could not be found.</h1><p>The page may have moved, or the address may be incomplete.</p><p><a class="button" style="background:var(--ink);color:#fff" href="/">Return home</a></p></section></main>${footer()}<script src="/assets/site.js" defer></script></body></html>`);

const headers = `${INDEXING ? '' : '/*\n  X-Robots-Tag: noindex, nofollow\n'}/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; img-src 'self' https://images.squarespace-cdn.com data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-src 'none'; base-uri 'self'; form-action 'self' https://ops.mft.care https://marriagefamilytherapy.clientsecure.me\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`;
write(path.join(DIST,'_headers'), headers);
write(path.join(DIST,'_redirects'), `# No content redirects are active until each mapping is explicitly approved.\n`);
write(path.join(DIST,'redirects-pending-review.txt'), `# Do not activate without explicit approval and Search Console validation.\n# /home-1 / 301\n# /new-page /individual-therapy 301\n# /new-page-1 /premarital-counseling 301\n# /new-page-2 /couples-retreat 301\n# /new-page-4 /online-therapy-oak-harbor-wa 301\n# /new-page-47 /sonia-hassan 301\n`);

const backlog = ['Bellingham','Mount Vernon','Oak Harbor','Everett','Lynnwood','Olympia','Tacoma','Port Orchard','Port Angeles','Forks','Sequim','Port Townsend','Walla Walla','Pullman','Ellensburg','Moses Lake','Longview','Centralia','Aberdeen','Battle Ground','Camas'];
write(path.join(DIST,'location-backlog-do-not-publish.json'), JSON.stringify({note:'Research backlog only. Do not mass-publish. Require demand, service fit, unique usefulness, clinical review, and owner approval.',cities:backlog},null,2));

const csvQuote = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
const inventoryHeaders = ['URL','Type','Name','Title','Description','H1','Canonical','Index after launch','Review status','Image source'];
const inventoryRows = allPages.map(p=>[urlFor(p),p.type,p.name,p.title,p.description,p.h1,urlFor(p),p.index?'Yes':'No',p.review,p.image]);
write(path.join(DIST,'page-inventory.csv'), [inventoryHeaders,...inventoryRows].map(r=>r.map(csvQuote).join(',')).join('\n')+'\n');
write(path.join(DIST,'LAUNCH-GAP-REPORT.md'), fs.readFileSync(path.join(ROOT,'reports','LAUNCH-GAP-REPORT.md'),'utf8'));

console.log(JSON.stringify({indexingEnabled:INDEXING,htmlPages:allPages.length+1,contentPages:allPages.length,indexableAfterLaunch:indexed.length,noindexContentPages:allPages.length-indexed.length},null,2));
