import puppeteer from 'puppeteer-core';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const br=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--host-resolver-rules=MAP admin.kevindupas.com 82.64.114.218']});
const p=await br.newPage(); await p.setViewport({width:1300,height:800});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('https://admin.kevindupas.com/login',{waitUntil:'networkidle2',timeout:25000});
await p.type('input[type="email"]','admin@admin.com'); await p.type('input[type="password"]','x3cYfWynGHCt4XUu');
await p.click('button[type="submit"]');
await p.waitForFunction(()=>!location.pathname.includes('login'),{timeout:15000}).catch(()=>{});
await p.keyboard.press('Escape'); await new Promise(r=>setTimeout(r,400));
await p.goto('https://admin.kevindupas.com/notes',{waitUntil:'networkidle2',timeout:20000});
await new Promise(r=>setTimeout(r,1000));
// select first note
await p.evaluate(()=>{const b=document.querySelector('button[class*="border-b"]'); b&&b.click();});
await new Promise(r=>setTimeout(r,500));
// put cursor at end of textarea, click Table toolbar btn (title="Table")
await p.evaluate(()=>{const t=document.querySelector('textarea'); if(t){t.focus(); t.setSelectionRange(t.value.length,t.value.length);}});
await p.evaluate(()=>{const b=[...document.querySelectorAll('button[title]')].find(x=>x.title==='Table'); b&&b.click();});
await new Promise(r=>setTimeout(r,400));
await p.evaluate(()=>{const b=[...document.querySelectorAll('button[title]')].find(x=>x.title==='Title'); /*noop*/});
await p.screenshot({path:'/tmp/notes-edit.png'});
// switch to Preview
await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/preview/i.test(x.textContent)); b&&b.click();});
await new Promise(r=>setTimeout(r,800));
await p.screenshot({path:'/tmp/notes-preview.png'});
console.log('errors:', errs.slice(0,3).join(' | ')||'none');
await br.close();
