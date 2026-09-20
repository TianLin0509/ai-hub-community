'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const { requireCommand, resolveClaudeCommand, assertProviderAvailable } = require('../core/community-provider');
function environment(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'community onboarding '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {root, env:{PATH:'',USERPROFILE:root,APPDATA:path.join(root,'roaming')}};
}
test('provider preflight rejects missing CLI and ignores untrusted fixture bypass', t => {
  const { env } = environment(t);
  for (const kind of ['claude','codex','claude-resume','codex-resume','kimi','gemini']) {
    assert.throws(() => assertProviderAvailable(kind,env), /未找到.*CLI/);
  }
  assert.doesNotThrow(() => assertProviderAvailable('powershell',env));
  assert.throws(() => assertProviderAvailable('claude',{...env,CLAUDE_HUB_CLAUDE_STREAM_FIXTURE:'fixture'}), /未找到/);
});
test('Claude detection, auth and native transport share the native install outside PATH', async t => {
  const {root,env} = environment(t);
  const executable = path.join(root,'.local','bin','claude.exe');
  fs.mkdirSync(path.dirname(executable),{recursive:true});fs.writeFileSync(executable,'fixture');
  assert.equal(requireCommand('claude',env),executable);
  assert.equal(resolveClaudeCommand(env).command,executable);
  const calls=[];
  const adapter=require('../core/account-adapters').createAccountAdapters({dataDir:root,homeDir:root,env,
    runImpl:async(command,args)=>{calls.push({command,args});return {code:0,stdout:'{"loggedIn":false}'};},
    terminal:async(command,args)=>{calls.push({command,args});return {};}});
  const row={provider:'claude',home:path.join(root,'.claude')};
  assert.equal((await adapter.check(row)).state,'login_required');
  await adapter.login(row);
  assert.deepEqual(calls,[{command:executable,args:['auth','status','--json']},{command:executable,args:['auth','login']}]);
});
test('npm Claude shim uses bundled runtime and literal script path; incomplete installs fail', t => {
  const {root,env} = environment(t);env.PATH=root;
  fs.writeFileSync(path.join(root,'claude.cmd'),'@echo off');
  assert.throws(()=>resolveClaudeCommand(env),/启动器不完整/);
  const script=path.join(root,'node_modules/@anthropic-ai/claude-code/cli.js');
  fs.mkdirSync(path.dirname(script),{recursive:true});fs.writeFileSync(script,'');
  const cmd=resolveClaudeCommand(env);
  assert.equal(cmd.command,process.execPath);assert.deepEqual(cmd.args,[script]);
  assert.equal(cmd.env.ELECTRON_RUN_AS_NODE,'1');
});
test('missing login never opens a terminal or claims to have started auth', async t => {
  const {root,env}=environment(t);
  const adapter=require('../core/account-adapters').createAccountAdapters({dataDir:root,homeDir:root,env,
    terminal:()=>{throw Error('unexpected terminal');}});
  for(const provider of ['claude','codex','gemini','kimi']) await assert.rejects(adapter.login({provider,home:root}),/未找到.*CLI/);
});
test('community startup does not replace an old Hub desktop shortcut with a missing target', t => {
  const {root}=environment(t);
  const desktop=path.join(root,'Desktop');fs.mkdirSync(desktop);
  const legacy=path.join(desktop,'AI Group Chat Hub.lnk');fs.writeFileSync(legacy,'old shortcut');
  const writes=[];
  const details=new Map([[legacy,{target:path.join(root,'old-missing','electron.exe'),args:'"old app"',cwd:path.join(root,'old-missing')}]]);
  const shell={readShortcutLink:p=>details.get(p),writeShortcutLink:(p,_op,d)=>{writes.push(p);details.set(p,d);return true;}};
  const result=require('../core/windows-shell-integration').ensureWindowsShellIntegration({
    app:{setUserTasks:()=>true},shell,appRoot:root,execPath:path.join(root,'new','electron.exe'),
    desktopPath:desktop,appDataPath:path.join(root,'roaming'),platform:'win32',logger:{warn(){}}});
  assert.deepEqual(result.errors,[]);
  assert.equal(fs.readFileSync(legacy,'utf8'),'old shortcut');
  assert.ok(!writes.includes(legacy));
  assert.equal(result.desktopShortcutUpdated,false);
});
