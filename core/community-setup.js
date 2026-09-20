'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const PROVIDERS = Object.freeze([
  { id: 'claude', name: 'Claude Code', command: 'claude', login: 'claude auth login', docs: 'https://code.claude.com/docs/en/setup' },
  { id: 'codex', name: 'Codex', command: 'codex', login: 'codex login', docs: 'https://developers.openai.com/codex/cli/' },
  { id: 'gemini', name: 'Gemini CLI', command: 'gemini', login: 'gemini', docs: 'https://github.com/google-gemini/gemini-cli' },
  { id: 'kimi', name: 'Kimi Code', command: 'kimi', login: 'kimi login', docs: 'https://github.com/MoonshotAI/kimi-cli' },
]);
function findCommand(command, env = process.env, platform = process.platform) {
  const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path');
  const dirs = String(env[pathKey] || '').split(path.delimiter).filter(Boolean);
  if (platform === 'win32') {
    if (env.APPDATA) dirs.push(path.join(env.APPDATA, 'npm'));
    dirs.push(path.join(env.USERPROFILE || os.homedir(), '.local', 'bin'));
    if (command === 'codex') {
      if (env.CODEX_INSTALL_DIR) dirs.push(env.CODEX_INSTALL_DIR);
      if (env.LOCALAPPDATA) dirs.push(path.join(env.LOCALAPPDATA, 'Programs', 'OpenAI', 'Codex', 'bin'));
    }
  }
  const extensions = platform === 'win32' ? ['.exe', '.cmd', '.bat'] : [''];
  for (const dir of dirs) for (const extension of extensions) {
    const candidate = path.join(dir.replace(/^"|"$/g, ''), command + extension);
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch (e) { if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw e; }
  }
  return null;
}
function inspectSetup({ root = path.resolve(__dirname, '..'), env = process.env, platform = process.platform, version = process.versions.node, packaged = false } = {}) {
  const electron = path.join(root, 'node_modules', 'electron', 'dist', platform === 'win32' ? 'electron.exe' : 'electron');
  const providers = PROVIDERS.map(p => ({ ...p, installed: !!findCommand(p.command, env, platform), auth: 'not_checked' }));
  const requirements = { windows: platform === 'win32', node22: Number(version.split('.')[0]) >= 22, electron: packaged || fs.existsSync(electron) };
  return { schemaVersion: 1, edition: 'community', runtime: packaged ? 'bundled' : 'source', requirements, ready: Object.values(requirements).every(Boolean), providers,
    next: providers.some(p => p.installed) ? 'Open Accounts, check login, then create a session.' : 'Install one provider with scripts/install-provider.ps1, then sign in.',
    note: 'Command discovery is not proof of login or model access. No credentials are read by this diagnostic.' };
}
module.exports = { PROVIDERS, findCommand, inspectSetup };
