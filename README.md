# AI Hub Community

把你自己的 Claude Code、Codex、Gemini CLI、Kimi 等 AI 放进一个 Windows 桌面工作台：单独对话、群聊讨论、开发分工、恢复历史、预览文件、管理记忆与能力。

这是基于 AI Hub **1.6.194** 的独立公开发行版。没有作者账号、聊天记录、个人投研/学习模块或公司中转。MIT 开源；AI 服务的账号、订阅和用量由你自己提供。

## 让 agent 帮你安装

把这段话发给你的 AI 编码助手：

> 请安装 https://github.com/TianLin0509/ai-hub-community 。先读仓库 AGENTS.md 和 INSTALL.md，在独立目录安装，运行 doctor 并依据结果补齐依赖。复用我本机已有的 AI CLI；缺哪个再装哪个。打开官方登录入口让我授权，不读取或索取我的密钥。启动 Hub 并核实窗口与 hook server，再报告实际验证结果。

公司 agent 需要借鉴实现时，先读 [架构与复用地图](docs/ARCHITECTURE.md) 和 [发行边界](docs/DISTRIBUTION.md)。

## 自己安装

**Windows 10/11 x64 + Node.js 22 或更新的 LTS**。源码包不要求管理员权限。

```powershell
git clone https://github.com/TianLin0509/ai-hub-community.git
cd ai-hub-community
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Launch
```

没有 Git：在仓库选择 Code → Download ZIP，解压到自己的目录，双击 `install.bat`。安装器下载入口见 [Releases](https://github.com/TianLin0509/ai-hub-community/releases)；只有实际列出的资产才是已发布的安装包。

启动后首页检查 CLI 安装情况，点击「登录 / 检查账号」。已有登录可复用；首次授权在提供方的官方窗口完成。**安装了 CLI 不等于已登录，已登录也不等于有模型权限或可用额度。**

## 保留的功能

- 原生 Claude / Codex 会话、流式卡片、停止/审批/恢复与会话独占。
- 多 AI 群聊、通用讨论、开发分工、文件工作流和开发看板。
- 本地历史检索、文件预览、工作区、记忆文件库和按需造梦。
- 账号中心、模型配置、扩展能力与可选 API 接入。

Claude/Codex 原生路径是主要验收对象；Gemini/Kimi 及其他 provider 依赖相应 CLI/环境。网页 ChatGPT 账号与 Codex CLI 授权相互独立，不自动互换。麦克风、通知、外部 MCP 等功能需对应服务配置，未预置私人服务。

数据位于 `%USERPROFILE%\.ai-hub-community`，与旧 Hub 分开。模型和推理档位保留上游能力；不会为了安装成功自动换成低档模型。当前部分工作流会授予 agent 自动执行能力，使用自己愿意交给 agent 的项目目录；权限语义见 [安装与运行说明](INSTALL.md)。

当前为 **Preview**。本机验证覆盖真实 Electron UI、IPC 与原生协议夹具，不代表每个提供方的在线模型都已跑通。验证记录见 [VALIDATION.md](docs/VALIDATION.md)。

## 开发与检查

```powershell
node scripts/doctor.js
npm test
node scripts/audit-public.js
node tests/e2e-community-cdp.js
```

安装说明：[INSTALL.md](INSTALL.md) · agent 手册：[AGENTS.md](AGENTS.md) · 数据边界：[PRIVACY.md](PRIVACY.md)
