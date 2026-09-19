# AI Hub Community — Agent 安装与开发手册

这里是给用户安装公开版、或给团队借鉴代码的入口。先读 README.md、INSTALL.md；需要复用架构再读 docs/ARCHITECTURE.md。

## 安装任务

1. 确认 Windows x64、独立目标目录、Node.js 22+；保留已有 Hub 与用户数据。Git 不可用可解压 ZIP。
2. `powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -NoShortcut`；检查退出码。用户希望快捷方式时省略 `-NoShortcut`。
3. `node scripts/doctor.js`；解析 JSON，根据缺失项处理。不要把 `ready` 解释成模型可用。
4. 复用本机已经安装的 CLI；缺失时运行 `scripts/install-provider.ps1 -Provider codex|claude|gemini`。这是官方工具安装，会联网。
5. 启动 Hub，打开账号中心的官方登录入口；用户自己完成身份确认。密码、验证码、token 不进 prompt、日志、仓库或截图。
6. 核实窗口和 hook listener，然后在用户允许的项目中发一条测试消息。最后报告已验证、未验证、失败原因；不要自动改模型、换账号、反复重发未知提交。

无 Node 时可使用组织认可方式安装 Node.js LTS（例如已可用的 winget），保留操作结果。下载受网络策略限制时如实报告，不用作者账号或私人网关兜底。

## 开发任务

- 正常修改在独立 branch/worktree；不要改用户正在运行的目录。主干合并按当前用户授权执行。
- 文件/运行数据/账号目录互相分离；不提交 `.env`、config.json、auth.json、Cookie、session、日志或截图中的私人内容。
- 代码运行边界：Main 管理会话/归属/IPC；renderer 管界面；Claude/Codex 走原生协议，不能用模拟 TUI 回车代替。
- GUI 验证：`node tests/e2e-community-cdp.js`。它创建临时 home/data、独立 CDP 和明确的 CLI 夹具；只关闭自己启动的进程。
- 基础验证：`npm test`、`node scripts/audit-public.js`、改动文件 `node --check`。实际运行命令和失败也要记入报告。
- 安装/构建只能用本副本独立的 node_modules；遇到 junction 不得 npm ci/install/dist。不得批量杀 electron.exe。
- 发布使用干净文件集与新历史；由 `.github/workflows/ci.yml` 验证和打包。不得假称未完成的云构建已通过。

## 给公司平台的接入顺序

先移植 provider 驱动和生命周期契约，再移植 IPC 与 UI，最后接入你们自己的认证/网关。禁止把本机单用户桌面 Hub 直接当成多租户服务。看 docs/ARCHITECTURE.md 的路径表和 docs/DISTRIBUTION.md 的差异说明。
