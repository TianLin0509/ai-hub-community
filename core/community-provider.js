'use strict';
const fs = require('fs');
const path = require('path');
const { findCommand, PROVIDERS } = require('./community-setup');

function requireCommand(provider, env = process.env) {
  const command = findCommand(provider, env);
  if (!command) {
    const name = PROVIDERS.find(p => p.id === provider)?.name || provider;
    throw new Error(`未找到 ${name} CLI。请从首页「安装说明」安装 ${provider}，安装后点击「重新检测」；再到账号中心登录。`);
  }
  return command;
}

// Use the same discovery as the welcome screen, including ~/.local/bin.
// npm .cmd launchers cannot be spawned with shell:false; run their JS entry
// with the bundled Node runtime, preserving argument boundaries.
function resolveClaudeCommand(env = process.env) {
  const command = requireCommand('claude', env);
  if (!/\.(cmd|bat)$/i.test(command)) return { command, args: [], env: { ...env } };
  const script = path.join(path.dirname(command), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  if (!fs.existsSync(script)) throw new Error('Claude 启动器不完整，请修复官方 CLI 安装：' + command);
  return { command: process.execPath, args: [script], env: { ...env, ELECTRON_RUN_AS_NODE: '1' } };
}

function assertProviderAvailable(kind, env = process.env) {
  if (!require('./distribution').community) return;
  const provider = String(kind || '').replace(/-resume$/, '');
  if (!PROVIDERS.some(p => p.id === provider)) return;
  const fixture = provider === 'claude' ? env.CLAUDE_HUB_CLAUDE_STREAM_FIXTURE
    : provider === 'codex' ? env.CLAUDE_HUB_CODEX_APP_SERVER_FIXTURE : null;
  if (env.CLAUDE_HUB_HOME_DIR && fixture) return;
  requireCommand(provider, env);
  if (provider === 'claude') resolveClaudeCommand(env);
  if (provider === 'codex') require('../main/codex-windows-command').resolveWindowsCodex(env);
}

module.exports = { requireCommand, resolveClaudeCommand, assertProviderAvailable };
