'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const failures=[];
const forbidden=/(^|\/)(?:auth\.json|config\.json|state\.json|\.env(?:\..*)?|Cookies|Login Data|\.claude|\.codex|\.qwen|\.gemini|\.kimi-code|transcripts|electron-userdata|node_modules|artifacts|output)(?:\/|$)/i;
const checks=[
  ['private local profile',/C:[\\/]+Users[\\/]+(?:lin[t]ian)(?:[\\/]|\b)/i],
  ['private gateway',/3\.142\.133\.116|www\.packyapi\.com/],
  ['provider key',/\bsk-(?:proj-|ant-)?[a-zA-Z0-9_-]{24,}\b/],
  ['GitHub token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
for(const file of files){
  if(forbidden.test(file))failures.push({file,rule:'runtime/private file'});
  if(/(?:^|\/)(?:chuxin|study|agent-league)[^/]*\.(?:js|css)$/.test(file))failures.push({file,rule:'personal module'});
  const absolute=path.join(root,file);
  if(fs.lstatSync(absolute).isSymbolicLink()){failures.push({file,rule:'symlink'});continue;}
  if(!/\.(?:js|json|md|html|css|ps1|bat|py|yml|yaml|txt)$/.test(file))continue;
  const text=fs.readFileSync(absolute,'utf8');
  if(text.includes('\uFFFD'))failures.push({file,rule:'invalid UTF-8 replacement character'});
  if(file==='scripts/audit-public.js')continue;
  for(const [rule,pattern] of checks)if(pattern.test(text))failures.push({file,rule});
}
console.log(JSON.stringify({ok:failures.length===0,files:files.length,failures},null,2));
process.exitCode=failures.length?1:0;
