const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取目录树
  getTree: () => ipcRenderer.invoke('get-tree'),

  // 轻量产品列表（仅根目录文件夹名，桌面端渲染产品菜单用）
  getProducts: () => ipcRenderer.invoke('get-products'),

  // 单个产品的子树（桌面端左侧树按产品懒加载，避免全库扫描）
  getProductTree: (productName) => ipcRenderer.invoke('get-product-tree', productName),

  // 创建文件夹
  createFolder: (parentPath, name) =>
    ipcRenderer.invoke('create-folder', { parentPath, name }),

  // 读取 PDF 文件（返回 ArrayBuffer）
  readFile: (relPath) => ipcRenderer.invoke('read-file', relPath),

  // 保存文件
  saveFile: (name, buffer, parentPath) =>
    ipcRenderer.invoke('save-file', { name, buffer, parentPath }),

  // 删除文件或文件夹
  deleteItem: (relPath) => ipcRenderer.invoke('delete-item', relPath),

  // 读取 BOM 数据
  readBom: (folderPath) => ipcRenderer.invoke('read-bom', folderPath),

  // 保存 BOM 数据
  saveBom: (folderPath, data) => ipcRenderer.invoke('save-bom', { folderPath, data }),

  // 重命名文件或文件夹
  renameItem: (relPath, newName) => ipcRenderer.invoke('rename-item', { relPath, newName }),

  // 移动文件/文件夹到目标目录
  moveItem: (relPath, targetFolder) => ipcRenderer.invoke('move-item', { relPath, targetFolder }),

  // 复制文件/文件夹到目标目录（Ctrl+拖拽）
  copyItem: (relPath, targetFolder) => ipcRenderer.invoke('copy-item', { relPath, targetFolder }),

  // 拖拽文件到窗口外部：用 sendSync 确保在 dragstart 事件期间同步完成 startDrag
  startDrag: (relPath) => ipcRenderer.sendSync('start-drag', relPath),

  // 打印文件夹下所有 PDF（含标注 + 进度反馈）
  printFolder: (folderPath, options) => ipcRenderer.invoke('print-folder', { folderPath, options }),

  // 打印单个 PDF（含标注，静默横幅打印）
  printFile: (relPath, options) => ipcRenderer.invoke('print-file', { relPath, options }),

  // 批量打印多个 PDF（含标注 + 进度反馈）
  printFiles: (relPaths, options) => ipcRenderer.invoke('print-files', { relPaths, options }),

  // 获取桌面端可用打印机列表（供打印参数设置区选择打印机）
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // 监听打印进度事件（主进程发送 {current, total, fileName}）
  // 每次注册前先移除旧监听器，防止多次打印后事件重复触发
  onPrintProgress: (callback) => {
    ipcRenderer.removeAllListeners('print-progress');
    ipcRenderer.on('print-progress', (event, data) => callback(data));
  },

  // 按基础名组织的导入：PDF + 同名子目录放关联格式
  // simple=true 时直接保存不做归档（用于往已有 PDF 子目录上传）
  importOrganized: (name, buffer, parentPath, simple) =>
    ipcRenderer.invoke('import-organized', { name, buffer, parentPath, simple }),

  // 用系统默认程序打开文件
  openExternal: (relPath) => ipcRenderer.invoke('open-external', relPath),

  // 另存为（复制文件到用户选择位置）
  copyFile: (relPath) => ipcRenderer.invoke('copy-file', relPath),

  // 在资源管理器中显示
  showInFolder: (relPath) => ipcRenderer.invoke('show-in-folder', relPath),

  // 导出文件夹为 ZIP
  exportZip: (folderPath) => ipcRenderer.invoke('export-zip', folderPath),

  // 手动整理指定文件夹
  reorganizeFolder: (folderPath) => ipcRenderer.invoke('reorganize-folder', folderPath),

  // 手动整理历史版本：扫描文件夹，按版本号归档旧版本到历史文件
  archiveOldVersions: (folderPath) => ipcRenderer.invoke('archive-old-versions', folderPath),

  // 导入 ZIP 解压到目标文件夹
  importZip: (targetFolder) => ipcRenderer.invoke('import-zip', targetFolder),

  // 读取 PDF 标注
  readAnnotations: (relPath) => ipcRenderer.invoke('read-annotations', relPath),

  // 保存 PDF 标注
  saveAnnotations: (relPath, data) => ipcRenderer.invoke('save-annotations', { relPath, data }),

  // 开机自启动
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),

  // 应用设置（BOM 自动填充规则等）
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

  // ===== 生产订单 =====
  // 保存生产订单（产品模式「提交生产」按钮调用，在产品文件夹下生成 production-order.json）
  saveProductionOrder: (folderPath, data) =>
    ipcRenderer.invoke('save-production-order', { folderPath, data }),

  // 读取单个产品的生产订单
  readProductionOrder: (folderPath) =>
    ipcRenderer.invoke('read-production-order', folderPath),

  // 读取所有产品的生产订单（生产管理模式汇总展示用）
  readAllProductionOrders: () =>
    ipcRenderer.invoke('read-all-production-orders'),

  // 更新生产订单中某个零件的生产状态
  updateProductionStatus: (folderPath, fileName, status) =>
    ipcRenderer.invoke('update-production-status', { folderPath, fileName, status }),

  // 递增生产订单中某个零件的打印次数（生产管理模式打印图纸时调用）
  incrementPrintCount: (folderPath, fileName) =>
    ipcRenderer.invoke('increment-print-count', { folderPath, fileName }),

  // ===== 任务派发 =====
  // 读取全部任务数据（任务列表 + 工人名单 + 设备名单）
  getTaskData: () => ipcRenderer.invoke('task-get-all'),

  // 新增或更新任务（无 id 自动编号新增，有 id 覆盖更新）
  saveTask: (task) => ipcRenderer.invoke('task-save', task),

  // 删除任务（按编号）
  deleteTask: (id) => ipcRenderer.invoke('task-delete', id),

  // 更新任务加工状态（pending/in-progress/pending-qc/qc-passed/rework/scrap）
  updateTaskStatus: (id, status) =>
    ipcRenderer.invoke('task-update-status', { id, status }),

  // v3.6.0 保存生产完成数据（生产数量/良品数/不良品数/照片），状态→待质检
  saveTaskProduction: (id, productionData) =>
    ipcRenderer.invoke('task-save-production', { id, productionData }),

  // v3.6.0 保存质检数据（合格数/不合格数/缺陷原因/处理结果）
  saveTaskQc: (id, qcData) =>
    ipcRenderer.invoke('task-save-qc', { id, qcData }),

  // 保存工人/设备名单（整体覆盖）
  saveTaskLists: (workers, equipments) =>
    ipcRenderer.invoke('task-save-lists', { workers, equipments }),

  // ===== 库存管理 =====
  // 读取全部库存（含流水日志）
  getInventory: () => ipcRenderer.invoke('inventory-get-all'),
  // 入库：有 parts 时按零件明细逐件登记（合格量），无 parts 时回退旧 BOM×taskQuantity 逻辑（v3.8.0）
  addInventory: (productFolder, taskQuantity, parts) =>
    ipcRenderer.invoke('inventory-add', { productFolder, taskQuantity, parts }),
  // 领用减少库存（用 productFolder+productCode+version+productName 标识，避免并发 index 错位；v3.7.2 加 productFolder 防跨产品累加）
  reduceInventory: (productCode, version, productName, reduceQty, workerName, productFolder) =>
    ipcRenderer.invoke('inventory-reduce', { productCode, version, productName, reduceQty, workerName, productFolder }),
  // v3.6.0 获取库存流水日志
  getInventoryLogs: (limit) =>
    ipcRenderer.invoke('inventory-get-logs', limit),
  // v3.6.0 设置安全库存（v3.7.2 加 productFolder 防跨产品匹配）
  setInventorySafety: (productCode, version, productName, safetyStock, productFolder) =>
    ipcRenderer.invoke('inventory-set-safety', { productCode, version, productName, safetyStock, productFolder }),
  // v3.8.0 盘库调整：直接设置库存数量为实际盘点值
  adjustInventory: (productCode, version, productName, actualQty, productFolder, operator) =>
    ipcRenderer.invoke('inventory-adjust', { productCode, version, productName, actualQty, productFolder, operator }),

  // ===== Web 访问配置 =====
  // 读取 Web 配置（端口 + 局域网 IP + 机器码访问列表）
  getWebConfig: () => ipcRenderer.invoke('get-web-config'),
  // 保存 Web 配置（端口 + 机器码访问列表，端口变更自动重启 Web 服务）
  saveWebConfig: (config) => ipcRenderer.invoke('save-web-config', config),

  // 获取当前在线设备列表（5 分钟内有请求的 Web 端设备）
  getOnlineDevices: () => ipcRenderer.invoke('get-online-devices')
});
