// ===== 主进程入口：应用生命周期 + 模块加载 =====
// 全局异常兜底
process.on('uncaughtException', (err) => {
  console.error('[未捕获异常]', err && err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[未处理Promise拒绝]', reason);
});

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// 加载共享模块（初始化常量、目录、工具函数）
require('./main/shared');
const S = require('./main/shared');

// GPU 加速策略：正常启动启用 GPU（大幅提升渲染/滚动/动画速度）；
// 若上次启动发生过渲染崩溃（gpu-suspect.flag 存在且 1 小时内），
// 则降级为软件渲染避免崩溃循环。连续 30 秒无崩溃后清除标记，下次恢复 GPU 加速。
const _gpuFlagPath = path.join(S.DATA_DIR, 'gpu-suspect.flag');
let _gpuDisabled = false;
try {
  if (fs.existsSync(_gpuFlagPath)) {
    const stat = fs.statSync(_gpuFlagPath);
    // 1 小时内有过崩溃 → 禁用 GPU（安全模式）
    if (Date.now() - stat.mtimeMs < 3600000) {
      app.disableHardwareAcceleration();
      _gpuDisabled = true;
      console.log('[GPU] 检测到近期渲染崩溃，已降级为软件渲染（安全模式）');
    } else {
      // 超过 1 小时的旧标记 → 清除，恢复 GPU 加速
      fs.unlinkSync(_gpuFlagPath);
    }
  }
} catch (e) {}
if (!_gpuDisabled) {
  console.log('[GPU] 硬件加速已启用（正常模式）');
}

// 加载各功能模块（每个模块注册自己的 IPC handler）
require('./main/tree');           // 目录树：get-tree, create-folder
require('./main/archive');        // 归档：import-organized, reorganize-folder, archive-old-versions
require('./main/files');          // 文件操作：read, save, rename, move, copy, delete, show-in-folder
require('./main/bom-ipc');        // BOM + 标注：read-bom, save-bom, read-annotations, save-annotations
require('./main/production-ipc'); // 生产订单：save, read, read-all, update-status, increment-print-count
require('./main/task-ipc');       // 任务派发：task-get-all, task-save, task-delete, task-update-status, task-save-lists
require('./main/inventory-ipc');  // 库存管理：inventory-get-all, inventory-add, inventory-reduce
require('./main/print');          // 打印：print-folder, print-file, print-files
require('./main/settings-ipc');   // 设置：get/save-settings, get/save-window-bounds
require('./main/drag');           // 拖拽：start-drag
require('./main/zip');            // ZIP：export-zip, import-zip
require('./main/auto-launch');    // 自启动：get/set-auto-launch

const { createWindow } = require('./main/window');
const webServer = require('./main/web-server'); // 内嵌 Web 服务器（局域网访问）

// 应用生命周期
app.whenReady().then(() => {
  createWindow();
  // 启动内嵌 Web 服务（局域网浏览器访问，失败不阻断桌面版）
  try { webServer.start(); } catch (e) { console.error('[Web服务] 启动异常:', e.message); }

  // 自动整理已禁用：启动时不扫描，避免大目录卡顿；用户可通过右键菜单手动触发
  // setTimeout(() => {
  //   autoReorganize();
  // }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
