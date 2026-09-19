'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net');
const assert = require('node:assert/strict');
const { launchIsolatedHub, gracefulQuit } = require('./helpers/hub-launcher');
const { connectFirstPage } = require('./helpers/cdp-client');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-community-gui-'));
  const data = path.join(root, 'data'), home = path.join(root, 'home'), project = path.join(root, 'project');
  const packaged = process.argv.includes('--packaged');
  const out = path.resolve(packaged ? 'artifacts/community-packaged-gui' : 'artifacts/community-gui');
  for (const dir of [data,home,project,out,path.join(home,'.codex'),path.join(home,'.claude')]) fs.mkdirSync(dir,{recursive:true});
  const port = await new Promise((resolve,reject) => { const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));}); });
  let hub, cdp;
  const report = { checks: [], packaged, providerNetworkTested: false };
  try {
    hub = await launchIsolatedHub({ dataDir:data, port, windowMode:'hidden', label:'community',
      ...(packaged ? {executablePath:path.resolve('dist/win-unpacked/AI Hub Community.exe')} : {}), extraEnv: {
      CLAUDE_HUB_HOME_DIR:home, USERPROFILE:home, HOME:home, CODEX_HOME:path.join(home,'.codex'), CLAUDE_CONFIG_DIR:path.join(home,'.claude'),
      AI_HUB_WORKSPACE_ROOT:path.join(root,'workspaces'), HUB_CODEX_API_KEY:'', HUB_CLAUDE_API_KEY:'', OPENAI_API_KEY:'', ANTHROPIC_API_KEY:'', ANTHROPIC_AUTH_TOKEN:'',
      CLAUDE_HUB_ACCOUNT_FIXTURE:path.resolve('tests/fixtures/account-center-cli.js'),
      CLAUDE_HUB_CODEX_APP_SERVER_FIXTURE:path.resolve('tests/fixtures/codex-app-server.js'),
      CLAUDE_HUB_CLAUDE_STREAM_FIXTURE:path.resolve('tests/fixtures/claude-stream.js'),
      CLAUDE_HUB_NATIVE_FIXTURE_STORE:path.join(root,'threads.json'), CLAUDE_HUB_NATIVE_FIXTURE_TRACE:path.join(root,'trace.jsonl'),
      HUB_SESSION_SEARCH_CODEX_ROOTS:path.join(root,'empty'),HUB_SESSION_SEARCH_CLAUDE_ROOTS:path.join(root,'empty'),HUB_SESSION_SEARCH_KIMI_ROOTS:path.join(root,'empty'),HUB_SESSION_SEARCH_GEMINI_ROOTS:path.join(root,'empty'),
    } });
    cdp = await connectFirstPage(hub);
    async function until(expression,label) { const deadline=Date.now()+25000;while(Date.now()<deadline){try{if(await cdp.eval(expression))return;}catch{}await sleep(150);}throw Error('Timeout: '+label); }
    const click = selector => cdp.eval(`document.querySelector(${JSON.stringify(selector)}).click()`);
    async function screenshot(name) { const result=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(result.data,'base64')); }
    await until('typeof sessions !== "undefined" && document.querySelectorAll(".community-provider").length === 4','community first launch');
    assert.equal(await cdp.eval('document.querySelectorAll("#btn-research,#btn-study,[data-action=sync-chatgpt]").length'),0);
    assert.equal(await cdp.eval('document.body.innerText.includes("初心")'),false);
    assert.equal(await cdp.eval('sessions.size'),0);
    report.checks.push('Fresh Hub starts without personal panels or imported sessions');
    await screenshot('01-home');
    await click('#community-accounts');
    await until('!document.getElementById("account-page").hidden && document.querySelectorAll(".ac-row").length > 0','account page');
    const accountText=await cdp.eval('document.getElementById("account-page").innerText');
    assert.doesNotMatch(accountText,/公司中转|网页生图|服务器监控授权|百炼/);
    await click('[data-ac="login"][data-id="gemini-cli"]');
    await until('document.getElementById("account-page").innerText.includes("夹具：官方登录入口已启动")','login routed');
    report.checks.push('First-run action opens account center; login routes through IPC to explicit fixture');
    await screenshot('02-accounts');
    await click('[data-ac="close"]');
    await click('#home-create-group');
    await until('document.body.innerText.includes("通用")','group launcher');
    assert.equal(await cdp.eval('[...document.querySelectorAll("button")].filter(b=>b.getBoundingClientRect().width&&/^(投研|学习)$/.test(b.textContent.trim())).length'),0);
    report.checks.push('Group launcher has development/general scenes and no personal research choice');
    await screenshot('03-group');
    // Check the backend boundary as well as visibility.
    const blocked=await cdp.eval('(async()=>{try{await ipcRenderer.invoke("create-meeting",{mode:"research"});return false;}catch{return true;}})()');
    assert.equal(blocked,true);
    const s=await cdp.eval('ipcRenderer.invoke("create-session",'+JSON.stringify({kind:'codex',opts:{cwd:project,mcpProfile:'none'}})+')');
    assert.ok(s.id,JSON.stringify(s));
    await until('sessions.get('+JSON.stringify(s.id)+')?.nativeRuntime?.state === "idle"','native fixture ready');
    report.checks.push('Native Codex App Server fixture creates a usable idle session');
    const receipt=await cdp.eval('ipcRenderer.invoke("session:send-prompt",'+JSON.stringify({sessionId:s.id,text:'fixture:dev-progress community integration smoke',clientSubmissionId:'community-smoke-'+Date.now()})+')');
    assert.ok(receipt && receipt.ok !== false,JSON.stringify(receipt));
    await until('sessions.get('+JSON.stringify(s.id)+')?.nativeRuntime?.state === "completed"','native fixture turn completed');
    const fixtureTrace=fs.readFileSync(path.join(root,'trace.jsonl'),'utf8');
    assert.ok(fixtureTrace.includes('community integration smoke'),'submitted prompt reaches native provider');
    report.checks.push('Structured prompt reaches native provider fixture and produces a confirmed completed turn');
    const terminal=await cdp.eval('ipcRenderer.invoke("create-session",'+JSON.stringify({kind:'powershell',opts:{cwd:project}})+')');
    assert.ok(terminal.id,JSON.stringify(terminal));
    await cdp.eval('ipcRenderer.send("terminal-input",'+JSON.stringify({sessionId:terminal.id,data:"Write-Output ('COMMUNITY_' + 'PTY_OK')\r"})+')');
    await until('(async()=>String(await ipcRenderer.invoke("get-ring-buffer",'+JSON.stringify(terminal.id)+')).includes("COMMUNITY_PTY_OK"))()','real ConPTY output');
    report.checks.push('Freshly installed node-pty executes a real PowerShell command under Electron');
    assert.ok(hub.log().some(line=>line.includes('hook server listening')),'hook listener must start');
    report.checks.push('Hook server listening confirmed');
    report.passed=true;
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {
    if (cdp) await cdp.close();
    if (hub) { try { fs.writeFileSync(path.join(out,'hub.log'),hub.log().join('\n')); } finally { await gracefulQuit(hub); } }
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
