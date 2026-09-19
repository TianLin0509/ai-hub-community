# 验证记录

基线：AI Hub 1.6.194，公开版 0.1.0-preview.1。日期：2026-09-19。

## 已执行

- 在独立导出目录运行 `powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -NoShortcut`：真实 `npm ci` 安装 399 个包成功，使用独立 node_modules，没有借用生产依赖。
- `powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -CheckOnly`：退出码 0。
- `npm test`：公开发行边界、配置默认值、账号过滤、命令发现、记忆保留、空项目库/损坏项目库、辅助数据目录等 10 项通过。
- `node scripts/audit-public.js`：公开文件集检查通过。排除了 19 个个人模块源文件；不带旧 Git 历史、运行数据与个人规则文档。
- `node tests/e2e-community-cdp.js`：真实隔离 Electron 中验证空白首页、安装检测、账号入口、授权按钮 IPC、通用/开发群聊入口、research 请求拒绝、Codex 原生协议夹具消息完整往返、真实 PowerShell/ConPTY 命令输出，以及 hook server 监听。
- 导出源码中的 420 个非 vendor JavaScript 文件使用 `node --check` 检查；首次安装脚本的真实执行同时验证 PowerShell 语法与错误传播。

## 证据边界

账号登录与模型回复使用明确的合成协议夹具。没有用作者真实账号替陌生用户验证登录，也没有自动消费模型额度。每个用户仍需在自己的账号和公司网络下发一次真实测试消息。

本机安装发生在已有 Node/Git 的 Windows 工作站，不是重装的空白 Windows 虚拟机。CI 的 `windows-latest` 干净 runner 用于补充独立安装、GUI 测试和打包验证；以 GitHub Actions 实际完成状态为准。

打包资产只在成功构建后进入 Release。没有配置商业代码签名。没有声称 macOS/Linux 或全部可选 provider 已验收。
