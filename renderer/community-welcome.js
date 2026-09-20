'use strict';
(() => {
  if (!require('../core/distribution').community) return;
  const { ipcRenderer, shell } = require('electron');
  function init() {
    const host = document.querySelector('.home-welcome-foot');
    if (!host) return;
    const section = document.createElement('section');
    section.id = 'community-setup';
    section.setAttribute('aria-label', '快速开始');
    section.innerHTML = '<h2>连接你的 AI，马上开始</h2><p>使用这台电脑上你自己的账号。已有 CLI 登录可直接复用。</p><div id="community-providers" role="status">正在检查安装情况…</div><div class="community-setup-actions"><button id="community-accounts" type="button">登录 / 检查账号</button><button id="community-refresh" type="button">重新检测</button><button id="community-guide" type="button">安装说明</button></div><p class="community-setup-note">首次授权在官方窗口完成；Hub 不附带账号、密钥或订阅。</p>';
    host.before(section);
    section.querySelector('#community-accounts').onclick = () => document.getElementById('btn-rail-accounts')?.click();
    section.querySelector('#community-guide').onclick = () => shell.openExternal('https://github.com/TianLin0509/ai-hub-community/blob/main/INSTALL.md');
    async function refresh() {
      const target = section.querySelector('#community-providers');
      const button = section.querySelector('#community-refresh');
      button.disabled = true;
      try {
        const result = await ipcRenderer.invoke('community:setup');
        target.replaceChildren();
        for (const provider of result.providers) {
          const item = document.createElement('span');
          item.className = 'community-provider';
          item.textContent = provider.name + (provider.installed ? ' · 已安装' : ' · 待安装');
          if (!provider.installed) {
            const install = document.createElement('button');
            install.type = 'button';
            install.textContent = '安装';
            install.setAttribute('aria-label', '安装 ' + provider.name);
            install.onclick = () => shell.openExternal(provider.docs);
            item.append(' ', install);
          }
          target.append(item);
        }
      } catch (error) { target.textContent = '检测失败：' + error.message; }
      finally { button.disabled = false; }
    }
    section.querySelector('#community-refresh').onclick = refresh;
    void refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
