'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
test('community cannot be switched to personal by inherited environment', () => {
  process.env.AI_HUB_EDITION = 'personal';
  assert.equal(require('../core/distribution').personalModules, false);
  delete process.env.AI_HUB_EDITION;
});
test('community data is separated from original Hub and explicit test isolation is honored', () => {
  const previous = process.env.CLAUDE_HUB_DATA_DIR;
  try {
    delete process.env.CLAUDE_HUB_DATA_DIR;
    assert.equal(path.basename(require('../core/data-dir').getHubDataDir()), '.ai-hub-community');
    process.env.CLAUDE_HUB_DATA_DIR = path.join(os.tmpdir(), 'community-explicit');
    assert.equal(require('../core/data-dir').getHubDataDir(), process.env.CLAUDE_HUB_DATA_DIR);
  } finally { if (previous === undefined) delete process.env.CLAUDE_HUB_DATA_DIR; else process.env.CLAUDE_HUB_DATA_DIR = previous; }
});
test('default configuration has no private proxy or gateway', () => {
  const defaults = require('../core/hub-config').DEFAULTS;
  assert.equal(defaults.proxy, '');
  assert.equal(defaults.claude_api_base_url, 'https://api.anthropic.com');
  assert.equal(defaults.codex_api_base_url, 'https://api.openai.com/v1');
});
test('account snapshot never probes personal external tools', async () => {
  const { AccountCenter } = require('../core/account-center');
  const service = new AccountCenter({ dataDir: os.tmpdir(), homeDir: os.tmpdir(), env: {}, getConfig: () => ({}), adapter: { imageAccounts() { throw Error('must not be called'); } } });
  const rows = await service.connections();
  assert.ok(rows.some(r => r.id === 'claude'));
  assert.ok(rows.some(r => r.id === 'codex-default'));
  assert.ok(!rows.some(r => ['bridge','images','chatgpt-web','server','token-plan','feishu'].includes(r.provider)));
});
test('missing CLI is reported without reading credentials or claiming login', () => {
  const { inspectSetup } = require('../core/community-setup');
  const result = inspectSetup({ root: os.tmpdir(), env: { PATH: '', APPDATA: os.tmpdir(), USERPROFILE: os.tmpdir() }, platform: 'win32', version: '18.0.0' });
  assert.equal(result.ready, false);
  assert.equal(result.requirements.node22, false);
  assert.ok(result.providers.every(p => !p.installed && p.auth === 'not_checked'));
});
test('command discovery supports paths containing spaces', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'community cli '));
  try {
    fs.writeFileSync(path.join(dir, 'codex.cmd'), '@echo off');
    const { findCommand } = require('../core/community-setup');
    assert.equal(findCommand('codex', { Path: dir }, 'win32'), path.join(dir, 'codex.cmd'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('project memory remains untouched', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'community-memory-'));
  try {
    const result = require('../core/claude-memory-link').ensureMemoryLink(dir);
    assert.equal(result.skipped, 'community-preserves-project-memory');
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('personal UI and scripts are absent in shipped shell', () => {
  const html = fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf8');
  assert.doesNotMatch(html, /id="(?:btn-research|btn-study|chuxin-panel|study-panel)"|src="(?:chuxin|study|agent-league)\.js"|data-action="sync-chatgpt"/);
  assert.match(html, /community-welcome.js/);
});
test('fresh project registry is empty but corrupt registry still fails visibly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'community-registry-'));
  try {
    const { PreparedProjectRegistry } = require('../core/prepared-project-registry');
    const registry = new PreparedProjectRegistry({ dataDir:dir });
    assert.deepEqual(registry.list(), {items:[],schemaVersion:1});
    fs.writeFileSync(path.join(dir,'prepared-projects.json'), '{broken');
    assert.throws(()=>registry.list(), /读取失败/);
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});
