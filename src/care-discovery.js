'use strict';
const fs=require('node:fs'),path=require('node:path');
// Two small entry points, rather than duplicating the services comparison.
function prepare(root) {
 const dist=path.join(root,'dist');
 const homeFile=path.join(dist,'index.html');
 let home=fs.readFileSync(homeFile,'utf8');
 const section=home.match(/<section\b[^>]*class="[^"]*home-questions[^"]*"[^>]*>[\s\S]*?<\/section>/);
 if(!section)throw Error('Missing homepage care choices');
 const link='<p class="care-discovery-link"><a href="/services/#therapy-formats">Individual, conjoint, couples or family? Compare types of care <span aria-hidden="true">&rarr;</span></a></p>';
 home=home.replace(section[0],section[0].replace(/<\/section>$/,link+'</section>'));
 fs.writeFileSync(homeFile,home);
 const startFile=path.join(dist,'how-to-start-therapy/index.html');
 let start=fs.readFileSync(startFile,'utf8');
 if(!start.includes('</main>'))throw Error('Missing starting-care main');
 const aside='<aside class="care-start-link"><h2>Still choosing the kind of care?</h2><p>Age and treatment focus are different questions. <a href="/services/#therapy-formats">Compare individual, conjoint, couples and family therapy &rarr;</a></p></aside>';
 start=start.replace('</main>',aside+'</main>');fs.writeFileSync(startFile,start);
 fs.appendFileSync(path.join(dist,'assets/styles.css'),fs.readFileSync(path.join(root,'src/assets/care-discovery.css'),'utf8'));
}
module.exports={prepare};
