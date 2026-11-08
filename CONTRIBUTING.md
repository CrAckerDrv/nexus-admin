# 贡献指南

感谢你有兴趣为 Nexus Admin 做出贡献！无论是缺陷修复、文档改进还是新组件，都非常欢迎。

## 行为准则

- 尊重所有参与者，讨论聚焦技术本身
- 不发布他人隐私信息
- 对新手友好：所有"这个怎么用"的问题都值得回答

## 参与方式

### 报告缺陷

使用 [Bug Report 模板](.github/ISSUE_TEMPLATE/bug_report.yml)，请包含：

- 复现步骤（越具体越好）
- 期望行为 vs 实际行为
- 浏览器与版本、Node 版本
- 控制台报错截图（如有）

### 提议新功能

使用 [Feature Request 模板](.github/ISSUE_TEMPLATE/feature_request.yml)，说明：

- 要解决的**真实场景**（不是"我想要一个 X 组件"）
- 是否有同类实现可以参考
- 是否愿意提交 PR

### 提交代码

```bash
# 1. Fork 并克隆
git clone https://github.com/<your-name>/nexus-admin.git   # 换成你自己 fork 后的地址
cd nexus-admin

# 2. 安装依赖
pnpm install

# 3. 创建分支（语义化命名）
git checkout -b feat/virtual-tree
# 前缀：feat / fix / docs / refactor / perf / test / chore

# 4. 开发并自测
pnpm dev            # 启动应用
pnpm verify         # 类型检查 + lint + 测试

# 5. 提交（约定式提交）
git commit -m "feat(ui): add virtual tree component"

# 6. 推送并开 PR
git push origin feat/virtual-tree
```

## 代码规范

### 通用

- **TypeScript 严格模式**，不使用 `any`（除非有充分理由并加注释）
- 组件使用**具名函数导出 + forwardRef**（需要转发 ref 时）
- 所有交互元素必须有 `aria-label` 或可见文本
- 新增组件必须支持深浅色（只用语义类名，不写死颜色）

### 组件库（packages/ui）

- 不允许引入**运行时依赖**（`peerDependencies` 只有 react/react-dom）
- 类名统一走 `cn()` 合并
- 尺寸使用 CSS 变量（`--n-control-h` 等），不要写死 px
- 受控组件必须同时支持 `defaultValue`

### 业务模块（apps/admin/src/modules）

- 一个模块一个目录，包含 `module.ts` + `pages/`
- 模块之间禁止互相 import
- 页面组件默认导出（供路由懒加载）

### 提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(ui): add Calendar component
fix(admin): correct pagination total when filtering
docs(guide): update theming section
perf(table): reduce re-render on sort
```

作用域建议：`ui` / `admin` / `docs` / `core` / `mock` / `ci`

## PR 检查清单

- [ ] `pnpm verify` 通过
- [ ] 新增组件包含示例页面或文档
- [ ] 深色模式下视觉正常
- [ ] 键盘可操作（Tab / Enter / ESC）
- [ ] 变更说明已写入 PR 描述

## 发布流程（维护者）

```bash
# 1. 更新版本号（遵循 semver）
# 2. 更新 CHANGELOG
# 3. 打 tag
git tag v0.2.0 && git push --tags

# 4. 构建并部署文档
pnpm build:docs
```

## 需要帮助？

在 [Discussions](https://github.com/CrAckerDrv/nexus-admin/discussions) 发帖，或加入 [Issue](https://github.com/CrAckerDrv/nexus-admin/issues) 讨论。
