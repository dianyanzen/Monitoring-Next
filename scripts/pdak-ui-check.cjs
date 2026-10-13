// Local UI verification only. Opens/cancels confirmation; never commits upload data.
require('@next/env').loadEnvConfig(process.cwd());
require('./pdak-ts-loader.cjs');
const {chromium}=require('playwright');
const crypto=require('node:crypto'),fs=require('node:fs'),assert=require('node:assert/strict');
const {parsePdaKFile}=require('../src/lib/pdak/parser.ts');
(async()=>{
  fs.mkdirSync('logs/pdak-ui',{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1080}});
    // Ephemeral local test session; contains no real person's identity.
    const raw=encodeURIComponent(JSON.stringify({S_USER_ID:'PDAK_UI_TEST',S_SESSION_ID:crypto.randomUUID(),S_NIK:'0000000000000000',S_USER_LEVEL:5}));
    const sig=crypto.createHmac('sha256',process.env.SESSION_SECRET||'dev-secret-only-local').update(raw).digest('base64url');
    // Next's cookie serializer URL-encodes the already encoded application payload.
    await context.addCookies([{name:'session_user',value:encodeURIComponent(raw),url:'http://127.0.0.1:3314'},{name:'session_sig',value:sig,url:'http://127.0.0.1:3314'}]);
    const page=await context.newPage();page.setDefaultTimeout(90000);
    let finalUploadRequests=0;
    await page.route('**/api/pdak/upload',route=>{finalUploadRequests++;return route.abort();});
    // Messaging validates a real account separately; it is outside this isolated PDAK UI test.
    await page.route('**/api/messages/**',route=>route.fulfill({json:{success:true,count:0,data:{items:[]}}}));
    await page.route('**/api/menu',route=>route.fulfill({json:{success:true,data:[{MENU_ID:374,TITLE:'Upload Data PDAK',URL:'/pdak/upload',IS_ACTIVE:1,MENU_LEVEL:1},{MENU_ID:375,TITLE:'Data PDAK',URL:'/pdak/data',IS_ACTIVE:1,MENU_LEVEL:1}]}}));
    await page.route('**/dashboard*',route=>route.fulfill({status:204,body:''}));
    await page.addInitScript(()=>localStorage.setItem('theme','light'));
    await page.goto('http://127.0.0.1:3314/pdak/upload');
    await page.getByRole('heading',{name:'Upload Data PDAK',exact:true}).waitFor();
    const multi=page.locator('input[type=file][multiple]');await multi.waitFor();
    await page.waitForFunction(()=>!document.querySelector('input[multiple]')?.disabled);
    await page.waitForFunction(()=>document.querySelector('.pdak-upload__heading').getBoundingClientRect().top>=document.querySelector('header.fixed.top-0').getBoundingClientRect().bottom);
    await page.screenshot({path:'logs/pdak-ui/upload-light-desktop.png',fullPage:true});
    const files=['KIA.xls','Akta Kelahiran.xls','Target Perekaman.xls','Capaian Target Aktivasi Identitas Kependudukan Digital.xls'];
    await multi.setInputFiles(files.map(f=>'tests/pdak/fixtures/'+f));
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Simpan ke Database')&&!b.disabled));
    assert.equal(await page.locator('.pdak-upload__preview').count(),4);
    await page.getByRole('button',{name:'Simpan ke Database',exact:true}).click();
    await page.getByText('Simpan Data PDAK',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Batal',exact:true}).click();
    await page.screenshot({path:'logs/pdak-ui/upload-preview-desktop.png',fullPage:true});
    console.log('Desktop upload and real preview of four original files: PASS (no Save)');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>document.querySelector('.pdak-shell-main').scrollTop=0);
    await page.waitForFunction(()=>document.querySelector('.pdak-upload__heading').getBoundingClientRect().top>=document.querySelector('header.fixed.top-0').getBoundingClientRect().bottom);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:'logs/pdak-ui/upload-light-mobile.png',fullPage:true});
    console.log('Mobile upload: no page horizontal overflow: PASS');
    // Fixture-backed viewer display only. No fixture snapshots are written to Oracle.
    const d=await parsePdaKFile(fs.readFileSync('tests/pdak/fixtures/KIA.xls'));
    await page.route('**/api/pdak/data?*',route=>{const url=new URL(route.request().url());return route.fulfill({json:{success:true,message:'UI fixture',data:{date:url.searchParams.get('date')||'2026-10-13',latestDate:'2026-10-13',dates:['2026-10-13','2026-10-12'],fields:d.config.fields,rows:d.rows}}});});
    await page.setViewportSize({width:1440,height:1080});
    await page.goto('http://127.0.0.1:3314/pdak/data');
    await page.getByRole('heading',{name:'Data PDAK',exact:true}).waitFor();
    await page.locator('.pdak-data__table tbody tr').first().waitFor();
    await page.getByLabel('Tanggal snapshot').selectOption('2026-10-12');
    await page.waitForFunction(()=>document.querySelector('.pdak-data__meta strong')?.textContent==='2026-10-12');
    await page.getByPlaceholder('Kode atau nama wilayah').fill('32.73.01.1001');
    assert.equal(await page.locator('.pdak-data__table tbody tr').count(),1);
    await page.getByPlaceholder('Kode atau nama wilayah').fill('');
    await page.screenshot({path:'logs/pdak-ui/data-light-desktop.png',fullPage:true});
    await page.evaluate(()=>{document.documentElement.dataset.theme='dark';document.documentElement.classList.add('dark');});
    await page.screenshot({path:'logs/pdak-ui/data-dark-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>document.querySelector('.pdak-shell-main').scrollTop=0);
    await page.waitForFunction(()=>document.querySelector('.pdak-upload__heading').getBoundingClientRect().top>=document.querySelector('header.fixed.top-0').getBoundingClientRect().bottom);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:'logs/pdak-ui/data-dark-mobile.png',fullPage:true});
    assert.equal(finalUploadRequests,0);
    console.log('Fixture viewer date selection, search, dark/light and mobile overflow: PASS');
    console.log('Shared confirmation opened/cancelled; final upload requests: 0');
  }finally{await browser.close();}
})().catch(e=>{console.error('UI verification failed:',e.message);process.exitCode=1;});
