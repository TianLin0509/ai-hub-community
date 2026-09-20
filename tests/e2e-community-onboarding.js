'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),net=require('net');
const assert=require('node:assert/strict');
const {launchIsolatedHub,gracefulQuit}=require('./helpers/hub-launcher');
const {connectFirstPage}=require('./helpers/cdp-client');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'community onboarding '));
 const home=path.join(root,'home'),data=path.join(root,'data');
 const exeIndex=process.argv.indexOf('--executable');
 const customExecutable=exeIndex>=0?path.resolve(process.argv[exeIndex+1]):null;
 const packaged=process.argv.includes('--packaged')||!!customExecutable;
 const out=path.resolve('artifacts/onboarding'+(packaged?'-packaged':''));
 fs.mkdirSync(home,{recursive:true});fs.mkdirSync(out,{recursive:true});
 const env={CLAUDE_HUB_HOME_DIR:home,HOME:home,USERPROFILE:home,APPDATA:path.join(home,'AppData/Roaming'),LOCALAPPDATA:path.join(home,'AppData/Local'),CODEX_HOME:path.join(home,'.codex'),CLAUDE_CONFIG_DIR:path.join(home,'.claude'),AI_HUB_WORKSPACE_ROOT:path.join(root,'workspaces')};
 for(const key of Object.keys(process.env))if(/KEY|TOKEN|SECRET|PASSWORD|FIXTURE|ANTHROPIC|OPENAI|GEMINI|KIMI/i.test(key))env[key]='';
 const pk=Object.keys(process.env).find(k=>k.toLowerCase()==='path')||'PATH';
 env[pk]=[path.join(process.env.SystemRoot,'System32'),path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0')].join(';');
 for(const provider of ['CODEX','CLAUDE','KIMI','GEMINI'])env['HUB_SESSION_SEARCH_'+provider+'_ROOTS']=path.join(root,'empty');
 let hub,cdp,phase=0;
 const report={checks:[],packaged,providerNetworkTested:false};
 const until=async(expr,label=expr)=>{const deadline=Date.now()+35000;while(Date.now()<deadline){if(await cdp.eval(expr))return;await sleep(150);}throw Error('Timeout '+label);};
 // Dispatch actual mouse input, not IPC or application controller calls.
 async function click(selector){
  const p=await cdp.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing element');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden element');return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});
 }
 async function shot(name){const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.data,'base64'));}
 async function start(){
  const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
  hub=await launchIsolatedHub({dataDir:data,port,windowMode:'hidden',extraEnv:env,...(packaged?{executablePath:customExecutable||path.resolve('dist/win-unpacked/AI Hub Community.exe')}:{})});
  cdp=await connectFirstPage(hub);await until('document.querySelectorAll(".community-provider").length===4');
 }
 async function stop(){if(cdp){await cdp.close();cdp=null;}if(hub){const owned=hub;hub=null;fs.writeFileSync(path.join(out,'hub-'+phase+++'.log'),owned.log().join('\n'));await gracefulQuit(owned);}}
 try{
  await start();
  assert.equal(await cdp.eval('(async()=> (await ipcRenderer.invoke("community:setup")).ready)()'),true);
  assert.equal(await cdp.eval('(async()=> (await ipcRenderer.invoke("community:setup")).providers.every(p=>!p.installed))()'),true);
  assert.equal(await cdp.eval('sessions.size'),0);
  assert.equal(await cdp.eval('document.querySelectorAll(".community-provider button").length'),4);
  await shot('01-clean-home');
  await click('#home-create-session');await click('#new-session-submit');
  await until('document.querySelector("#new-session-error").innerText.includes("未找到")');
  assert.equal(await cdp.eval('sessions.size'),0);
  await shot('02-missing-cli');
  report.checks.push('Empty PATH and fresh HOME: missing CLI stays in form with installation guidance; no broken session created');
  await click('#new-session-cancel');await click('#community-accounts');
  await until('document.querySelector("[data-ac=login][data-id=claude]")');
  await click('[data-ac=login][data-id=claude]');
  await until('document.querySelector("#account-page").innerText.includes("未找到")');
  report.checks.push('Missing CLI login reports an actionable failure');
  await click('[data-ac=close]');
  // Install a synthetic npm-style Claude in the fake HOME, outside PATH.
  // This exercises the real command resolver and OS child process, not an
  // executable override. The child speaks a fixture protocol, never a model.
  const npm=path.join(env.APPDATA,'npm'),script=path.join(npm,'node_modules/@anthropic-ai/claude-code/cli.js');
  fs.mkdirSync(path.dirname(script),{recursive:true});
  fs.writeFileSync(path.join(npm,'claude.cmd'),'@echo off\r\n');
  fs.writeFileSync(script,`if(process.argv[2]==='auth'){console.log(JSON.stringify({loggedIn:false}));}else{require(${JSON.stringify(path.resolve('tests/fixtures/claude-stream.js'))});}`);
  await click('#community-refresh');
  await until('document.querySelector("#community-providers").innerText.includes("Claude Code · 已安装")');
  await click('#home-create-group');
  await until('document.querySelector(".mcm-create")?.getBoundingClientRect().width > 0');
  await click('.mcm-create');
  await until('document.querySelector(".mcm-error")?.innerText.includes("Codex")');
  assert.equal(await cdp.eval('Object.keys(meetings).length'),0);
  assert.equal(await cdp.eval('sessions.size'),0);
  report.checks.push('Mixed availability group is rejected before any member or room starts');
  await click('#new-session-close');
  await click('#home-create-session');await click('#new-session-submit');
  await until('[...sessions.values()].some(s=>s.kind==="claude"&&s.nativeRuntime?.state==="idle")');
  const id=await cdp.eval('[...sessions.values()].find(s=>s.kind==="claude").id');
  const box='.floating-input-bar[data-session-id="'+id+'"] .floating-input-box';
  const send='.floating-input-bar[data-session-id="'+id+'"] .floating-input-send';
  await click(box);await cdp.send('Input.insertText',{text:'community onboarding message'});await click(send);
  await until(`sessions.get(${JSON.stringify(id)})?.nativeRuntime?.state === 'completed'`);
  await until('document.body.innerText.includes("完成 🧪")');
  await shot('03-first-reply');
  const nativeId=await cdp.eval(`sessions.get(${JSON.stringify(id)}).ccSessionId`);
  report.checks.push('Mouse/keyboard creates Claude, sends prompt and renders reply through resolved npm CLI under a spaced path');
  await stop();
  env.CLAUDE_HUB_CODEX_APP_SERVER_FIXTURE=path.resolve('tests/fixtures/codex-app-server.js');
  env.CLAUDE_HUB_NATIVE_FIXTURE_STORE=path.join(root,'threads.json');
  await start();
  await until(`document.querySelector('[data-session-id="${id}"]')`);
  await click(`.session-item[data-session-id="${id}"]`);
  await until(`sessions.get(${JSON.stringify(id)})?.nativeRuntime?.connection === 'connected'`);
  assert.equal(await cdp.eval(`sessions.get(${JSON.stringify(id)}).ccSessionId`),nativeId);
  await until('document.body.innerText.includes("community onboarding message") && document.body.innerText.includes("完成 🧪")');
  await shot('04-restored');
  report.checks.push('Window close/restart restores same native session identity and persisted conversation');
  // Open the launch center through its visible toolbar entry after restore.
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'n',code:'KeyN',windowsVirtualKeyCode:78,modifiers:2});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'n',code:'KeyN',windowsVirtualKeyCode:78,modifiers:2});
  await until('document.querySelector("#new-session-menu").getBoundingClientRect().width > 0');
  await click('#launch-intent-group');await click('.mcm-create');
  await until('Object.keys(meetings).length === 1');
  const room=await cdp.eval('Object.values(meetings)[0]');
  assert.equal(room.subSessions.length,2);
  await until(`(${JSON.stringify(room.subSessions)}).every(id=>sessions.get(id)?.nativeRuntime?.state==='idle')`);
  await click('#mr-input-box');await cdp.send('Input.insertText',{text:'fixture:dev-progress community group review'});await click('#mr-send-btn');
  await until(`(${JSON.stringify(room.subSessions)}).every(id=>sessions.get(id)?.nativeRuntime?.state==='completed')`,'both group members complete');
  await until('document.getElementById("meeting-room-panel").innerText.includes("受控验证已完成") && document.getElementById("meeting-room-panel").innerText.includes("完成 🧪")');
  await shot('05-group-replies');
  report.checks.push('Default general group creates both providers and displays both native fixture replies after a real UI send');
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'n',code:'KeyN',windowsVirtualKeyCode:78,modifiers:2});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'n',code:'KeyN',windowsVirtualKeyCode:78,modifiers:2});
  await until('document.querySelector("#new-session-menu").getBoundingClientRect().width > 0');
  await click('#launch-intent-session');await click('.new-session-option[data-kind="codex"]');await click('#new-session-submit');
  await until('[...sessions.values()].some(s=>s.kind==="codex"&&!s.meetingId&&s.nativeRuntime?.state==="idle")');
  const codexId=await cdp.eval('[...sessions.values()].find(s=>s.kind==="codex"&&!s.meetingId).id');
  const composer='.floating-input-bar[data-session-id="'+codexId+'"]';
  async function sendText(text){await click(composer+' .floating-input-box');await cdp.send('Input.insertText',{text});await click(composer+' .floating-input-send');}
  await sendText('fixture:hold');
  await until(`sessions.get(${JSON.stringify(codexId)})?.nativeRuntime?.state === 'running'`);
  await click(composer+' .floating-input-stop');
  await until(`sessions.get(${JSON.stringify(codexId)})?.nativeRuntime?.state === 'interrupted'`);
  report.checks.push('UI stop waits for native interrupted confirmation');
  await sendText('fixture:failed');
  await until(`sessions.get(${JSON.stringify(codexId)})?.nativeRuntime?.state === 'failed'`);
  await until('document.body.innerText.includes("fixture turn failed")');
  await shot('06-provider-failure');
  await sendText('fixture:dev-progress retry chosen by user');
  await until(`sessions.get(${JSON.stringify(codexId)})?.nativeRuntime?.state === 'completed'`);
  await until('document.body.innerText.includes("受控验证已完成")');
  report.checks.push('Provider failure is visible; explicit next user message succeeds in the same session');
  report.passed=true;
 }catch(error){report.error=error.stack;if(cdp){await shot('failure').catch(()=>{});fs.writeFileSync(path.join(out,'failure-dom.txt'),String(await cdp.eval('document.body.innerText').catch(()=>'')));}throw error;}
 finally{await stop();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
