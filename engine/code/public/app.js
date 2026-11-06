'use strict';
const $=id=>document.getElementById(id);
const form=$('ask-form'),jurisdiction=$('jurisdiction'),query=$('query'),button=$('submit');
const labels={recycle_bin:'Recycling',compost_bin:'Compost / greenwaste',garbage:'Garbage',drop_off_special:'Special drop-off / collection',deposit_return:'Deposit return'};
let controller=null,requestId=0,ready=false;
function clearResult(){requestId++;controller?.abort();controller=null;$('result').hidden=true;$('error').hidden=true;$('status').textContent='';button.disabled=!ready;button.textContent='Check local rules →';form.removeAttribute('aria-busy');}
function list(id,values,render){const target=$(id);target.replaceChildren();for(const value of values){const li=document.createElement('li');if(render)render(li,value);else li.textContent=value;target.append(li);}}
function render(answer){
 const result=$('result');result.dataset.behavior=answer.behavior;
 $('result-context').textContent=jurisdiction.selectedOptions[0].textContent;
 $('result-heading').textContent=answer.behavior==='answer'?labels[answer.stream]:answer.behavior==='abstain'?'We don’t know from these rules':answer.behavior==='clarify'?'One detail makes a difference':'It depends on the item';
 $('item').textContent=answer.item_interpreted||query.value.trim();
 $('question-block').hidden=answer.behavior!=='clarify';$('question').textContent=answer.clarifying_question||'';
 $('conditions').hidden=answer.behavior!=='conditional';
 list('conditions',answer.conditions||[],(li,c)=>{li.append(document.createTextNode(c.if));const stream=document.createElement('strong');stream.textContent=labels[c.stream];li.append(stream);});
 $('prep-block').hidden=!['answer','conditional'].includes(answer.behavior);
 list('prep',answer.prep);$('no-prep').hidden=answer.prep.length!==0;
 $('explanation').replaceChildren();for(const paragraph of answer.explanation.split('\n\n')){const p=document.createElement('p');p.textContent=paragraph;$('explanation').append(p);}
 list('sources',answer.source_urls,(li,url)=>{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))return;const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`Official/source reference · ${parsed.hostname}`;li.append(a);});
 $('rule-ids').textContent=answer.rule_ids.length?`Rule references: ${answer.rule_ids.join(', ')}`:'No matching local rule is cited.';
 result.hidden=false;result.focus({preventScroll:true});
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!ready||!form.reportValidity())return;
 if(!query.value.trim()){query.setCustomValidity('Describe an item before checking.');query.reportValidity();return;}
 clearResult();const id=requestId;controller=new AbortController();button.disabled=true;button.textContent='Checking…';form.setAttribute('aria-busy','true');$('status').textContent='Checking the local rules. This may take a moment…';
 try{
  const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jurisdiction:jurisdiction.value,query:query.value.trim()}),signal:controller.signal});
  const answer=await response.json();if(!response.ok)throw new Error(answer.error||'The request could not be completed.');
  if(id!==requestId)return;render(answer);$('status').textContent='Local guidance is ready.';
 }catch(error){if(id!==requestId||error.name==='AbortError')return;$('error').textContent='Unable to check right now. Please try again. '+error.message;$('error').hidden=false;$('status').textContent='';}
 finally{if(id===requestId){button.disabled=false;button.textContent='Check local rules →';form.removeAttribute('aria-busy');controller=null;}}
});
query.addEventListener('input',()=>{query.setCustomValidity('');clearResult();});jurisdiction.addEventListener('change',clearResult);
async function start(){try{
 const response=await fetch('/api/jurisdictions');if(!response.ok)throw new Error('Unavailable');const choices=await response.json();
 jurisdiction.replaceChildren(new Option('Choose your jurisdiction',''));for(const choice of choices)jurisdiction.add(new Option(choice.name,choice.id));
 ready=true;jurisdiction.disabled=false;button.disabled=false;
}catch{$('error').textContent='We couldn’t load jurisdictions. Refresh this page to try again.';$('error').hidden=false;}}
start();
