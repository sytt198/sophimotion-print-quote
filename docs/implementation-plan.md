# SophiMotion 报价网页实施计划

**依据：** design.md。用户已确认设计并要求直接生成网页，由当前会话执行。

**架构：** Vite 构建静态 HTML、JavaScript、CSS；Three.js 预览，OCCT Worker 解析 STEP；纯函数计算报价；ExcelJS 输出 XLSX，html2canvas 与 jsPDF 输出中文 PDF。

1. 计算模块 `src/quote.js` 与几何模块 `src/geometry.js`：先写测试，覆盖立方体体积/面积、开口网格、缩放、FDM 壳体与填充、树脂、手动重量、整行机时、数量、最低收费、税额与输入校验；运行 `npm test`。
2. 预览模块 `src/viewer.js` 与 `src/step.worker.js`：加载 STL / STEP、适配视图、切换标准视角与线框、错误反馈和图形资源释放。上传文件按 50 MB 限制，解析后按三角形数量限制。
3. 界面 `index.html`、`src/main.js`、`src/style.css`：品牌资产、三栏工作区、可编辑材料和工艺、模型清单、客户信息、主题、移动端布局与整单汇总。示例模型只用于演示并明确标注。
4. 导出 `src/export.js`：复用计算数据构建四张工作表；生成可预览的客户报价与分页 PDF。未补齐参数保留待确认状态。文件名清理特殊字符。
5. 验证：`npm test`、`npm run build`；浏览器桌面/手机操作、STL/STEP 实际解析、XLSX 与 PDF 生成、主题与错误路径。保留 README 与运行说明。

**关键约束：** 不声称自动识别材料；网格体积均标为估算；闭合检查不冒充制造可行性检查；未输入的支撑和机时不自动视为零；不上传用户模型到服务器。

**执行记录：** 本地独立目录实现，仓库克隆受网络影响；通过 API 已确认远程只有 README。接入时保留远程 README，并用新分支提交。
