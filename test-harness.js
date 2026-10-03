// ===== 自动测试脚手架：mock electron 模块，启动 web-server，测试全部 HTTP API =====
// 用法：node test-harness.js

const Module = require('module');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ============ 1. Mock electron 模块 ============
const projectRoot = __dirname;
const fakeAppData = path.join(projectRoot, '.test-appdata');

const fakeApp = {
  isPackaged: false,
  getPath: (name) => {
    if (name === 'userData') return projectRoot;
    if (name === 'appData') return fakeAppData;
    return projectRoot;
  },
  setPath: () => {},
};

const fakeElectron = {
  app: fakeApp,
  ipcMain: {
    handle: () => {},
    on: () => {},
    removeHandler: () => {},
  },
  BrowserWindow: function() { return {}; },
  shell: {},
  dialog: {},
  Menu: {},
  session: { defaultSession: { webRequest: { onBeforeRequest: () => {} } } },
};

// 注入 mock electron 模块：覆盖 Module._load 拦截 require('electron')
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron' || request === 'electron/main' || request === 'electron/renderer') {
    return fakeElectron;
  }
  return originalLoad.apply(this, arguments);
};

// ============ 2. 配置 ============
const TEST_PORT = 18080;
const MACHINE_CODE = 'TEST-MACHINE-001';
const settingsFile = path.join(projectRoot, 'settings.json');
const tasksFile = path.join(projectRoot, 'tasks.json');
const inventoryFile = path.join(projectRoot, 'inventory.json');

// ============ 3. 备份/恢复数据文件 ============
const backups = {};
function backupFiles() {
  for (const f of [settingsFile, tasksFile, inventoryFile]) {
    try { backups[f] = fs.readFileSync(f, 'utf-8'); } catch (e) { backups[f] = null; }
  }
}
function restoreFiles() {
  for (const [f, content] of Object.entries(backups)) {
    try {
      if (content !== null) fs.writeFileSync(f, content, 'utf-8');
      else { try { fs.unlinkSync(f); } catch (e) {} }
    } catch (e) {}
  }
}

// ============ 4. HTTP 请求工具 ============
function httpRequest(method, pathname, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: pathname,
      method: method,
      headers: Object.assign({ 'X-Machine-Code': MACHINE_CODE }, headers || {}),
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let json;
        try { json = JSON.parse(raw); } catch (e) { json = null; }
        resolve({ status: res.statusCode, raw, json });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) {
      if (typeof body === 'object' && !(body instanceof Buffer)) {
        req.setHeader('Content-Type', 'application/json');
        body = JSON.stringify(body);
      }
      req.write(body);
    }
    req.end();
  });
}

// ============ 5. 测试结果收集 ============
const results = [];
let passCount = 0;
let failCount = 0;

function test(name, condition, detail) {
  if (condition) passCount++; else failCount++;
  results.push({ name, status: condition ? 'PASS' : 'FAIL', detail: detail || '' });
  console.log(`${condition ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function apiTest(name, method, pathname, body, expectedStatus, validator) {
  try {
    const res = await httpRequest(method, pathname, body);
    const statusOk = res.status === expectedStatus;
    let validOk = true;
    let detail = `HTTP ${res.status}`;
    if (validator) {
      const vResult = validator(res);
      validOk = vResult.pass;
      detail += ' | ' + vResult.detail;
    } else if (res.json) {
      detail += ' | ' + JSON.stringify(res.json).slice(0, 100);
    }
    test(name, statusOk && validOk, detail);
    return res;
  } catch (e) {
    test(name, false, e.message);
    return null;
  }
}

// ============ 6. 测试套件 ============
async function runTests() {
  console.log('========== 自动测试开始 ==========\n');

  // 备份数据文件
  backupFiles();

  // 设置测试端口：写入 settings.json 的 webPort
  let settings = {};
  try { settings = JSON.parse(backups[settingsFile] || '{}'); } catch (e) {}
  settings.webPort = TEST_PORT;
  // 清除 machineAccess 中的测试机器码（确保未绑定状态）
  if (Array.isArray(settings.machineAccess)) {
    settings.machineAccess = settings.machineAccess.filter(m => m.machineCode !== MACHINE_CODE);
  } else {
    settings.machineAccess = [];
  }
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');

  // ---- 阶段1：启动 Web 服务器 ----
  console.log('--- 阶段1：启动 Web 服务器 ---');
  let webServer;
  try {
    const webServerModule = require('./main/web-server');
    webServer = webServerModule.start();
    await new Promise(r => setTimeout(r, 1000));
    test('Web 服务器启动', true, `端口 ${TEST_PORT}`);
  } catch (e) {
    test('Web 服务器启动', false, e.message);
    restoreFiles();
    console.log('\n========== 测试终止 ==========');
    return;
  }

  // ---- 阶段2：未绑定员工拦截测试 ----
  console.log('\n--- 阶段2：未绑定员工拦截（应返回 403 UNBOUND_EMPLOYEE）---');

  const unboundAPIs = [
    ['GET', '/api/tasks', null],
    ['GET', '/api/inventory', null],
    ['GET', '/api/inventory/logs', null],
    ['GET', '/api/production-orders', null],
    ['POST', '/api/tasks/production-data', { id: 'TEST-001', productionData: { producedQty: 10, goodQty: 9, badQty: 1 } }],
    ['POST', '/api/tasks/qc-data', { id: 'TEST-001', qcData: { qualifiedQty: 9, unqualifiedQty: 1, result: 'pass' } }],
    ['POST', '/api/inventory/add', { productFolder: 'TEST', taskQuantity: 1 }],
    ['POST', '/api/inventory/reduce', { productCode: 'P001', version: 'V1', productName: 'Test', reduceQty: 1 }],
    ['POST', '/api/inventory/safety', { productCode: 'P001', version: 'V1', productName: 'Test', safetyStock: 5 }],
    ['POST', '/api/tasks/status', { id: 'TEST-001', status: 'in-progress' }],
    ['GET', '/api/production-order?folder=TEST', null],
    ['POST', '/api/production-status', { folderPath: 'TEST', fileName: 'test.pdf', status: 'done' }],
    ['POST', '/api/print-count', { folderPath: 'TEST', fileName: 'test.pdf' }],
  ];

  for (const [method, url, body] of unboundAPIs) {
    await apiTest(`${method} ${url} 未绑定应拒绝`, method, url, body, 403,
      (r) => r.json && r.json.code === 'UNBOUND_EMPLOYEE'
        ? { pass: true, detail: 'code=UNBOUND_EMPLOYEE' }
        : { pass: false, detail: r.json ? JSON.stringify(r.json).slice(0, 80) : 'no json' });
  }

  // ---- 阶段3：不需要绑定的 API 应正常 ----
  console.log('\n--- 阶段3：不需要员工绑定的 API 应正常访问 ---');

  await apiTest('GET /api/machine-access 应正常', 'GET', '/api/machine-access', null, 200,
    (r) => r.json && r.json.machineCode === MACHINE_CODE
      ? { pass: true, detail: 'machineCode匹配' }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  await apiTest('GET /api/tree 应正常', 'GET', '/api/tree', null, 200,
    (r) => r.json !== null
      ? { pass: true, detail: '返回目录树数据' }
      : { pass: false, detail: '返回null' });

  await apiTest('GET / (index.html) 静态资源', 'GET', '/', null, 200,
    (r) => r.raw && (r.raw.includes('<!DOCTYPE') || r.raw.includes('<html'))
      ? { pass: true, detail: '返回HTML' }
      : { pass: false, detail: '非HTML内容' });

  // ---- 阶段4：绑定员工流程 ----
  console.log('\n--- 阶段4：绑定员工流程 ---');

  await apiTest('POST /api/bind-employee 绑定员工', 'POST', '/api/bind-employee',
    { employeeId: 'E001', workerName: '张三' }, 200,
    (r) => r.json && r.json.success === true && r.json.workerName === '张三'
      ? { pass: true, detail: '绑定成功，workerName=张三' }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // 验证 machine-access 现在返回 workerName
  await apiTest('GET /api/machine-access 验证已绑定', 'GET', '/api/machine-access', null, 200,
    (r) => r.json && r.json.workerName === '张三'
      ? { pass: true, detail: 'workerName=张三' }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // ---- 阶段5：绑定后 API 应正常访问 ----
  console.log('\n--- 阶段5：绑定员工后各 API 应正常访问 ---');

  await apiTest('GET /api/tasks 绑定后应正常', 'GET', '/api/tasks', null, 200,
    (r) => r.json && Array.isArray(r.json.tasks)
      ? { pass: true, detail: `tasks=${r.json.tasks.length}` }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  await apiTest('GET /api/inventory 绑定后应正常', 'GET', '/api/inventory', null, 200,
    (r) => r.json && Array.isArray(r.json.items)
      ? { pass: true, detail: `items=${r.json.items.length}` }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  await apiTest('GET /api/inventory/logs 绑定后应正常', 'GET', '/api/inventory/logs', null, 200,
    (r) => r.json && Array.isArray(r.json.logs)
      ? { pass: true, detail: `logs=${r.json.logs.length}` }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  await apiTest('GET /api/production-orders 绑定后应正常', 'GET', '/api/production-orders', null, 200,
    (r) => r.json && Array.isArray(r.json.orders)
      ? { pass: true, detail: `orders=${r.json.orders.length}` }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // ---- 阶段6：生产模块功能测试 ----
  console.log('\n--- 阶段6：生产模块功能测试 ---');

  // 6.1 创建任务
  await apiTest('POST /api/tasks 创建任务', 'POST', '/api/tasks',
    { productFolder: '测试产品A', quantity: 10, assignedTo: '张三', status: 'pending' }, 200,
    (r) => r.json && r.json.success === true
      ? { pass: true, detail: '任务创建成功' }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // 6.2 获取任务列表
  const tasksRes = await apiTest('GET /api/tasks 获取任务列表', 'GET', '/api/tasks', null, 200,
    (r) => r.json && r.json.tasks.length > 0
      ? { pass: true, detail: `tasks=${r.json.tasks.length}` }
      : { pass: false, detail: '任务列表为空' });

  let taskId = null;
  if (tasksRes && tasksRes.json && tasksRes.json.tasks.length > 0) {
    taskId = tasksRes.json.tasks[0].id;
  }

  // 6.3 更新状态为进行中
  if (taskId) {
    await apiTest('POST /api/tasks/status → in-progress', 'POST', '/api/tasks/status',
      { id: taskId, status: 'in-progress' }, 200,
      (r) => r.json && r.json.success === true
        ? { pass: true, detail: `${taskId} → in-progress` }
        : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });
  }

  // 6.4 保存生产数据
  if (taskId) {
    await apiTest('POST /api/tasks/production-data 保存生产数据', 'POST', '/api/tasks/production-data',
      { id: taskId, productionData: { producedQty: 10, goodQty: 9, badQty: 1, completedBy: '张三' } }, 200,
      (r) => r.json && r.json.success === true
        ? { pass: true, detail: '生产数据已保存' }
        : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });
  }

  // 6.5 验证状态自动变为 pending-qc
  if (taskId) {
    await apiTest('GET /api/tasks 验证状态→pending-qc', 'GET', '/api/tasks', null, 200,
      (r) => {
        const task = r.json && r.json.tasks.find(t => t.id === taskId);
        if (task && task.status === 'pending-qc') return { pass: true, detail: 'status=pending-qc' };
        return { pass: false, detail: `status=${task ? task.status : 'not found'}` };
      });
  }

  // 6.6 验证生产数据已保存
  if (taskId) {
    await apiTest('GET /api/tasks 验证生产数据已保存', 'GET', '/api/tasks', null, 200,
      (r) => {
        const task = r.json && r.json.tasks.find(t => t.id === taskId);
        if (task && task.productionData && task.productionData.producedQty === 10)
          return { pass: true, detail: `producedQty=${task.productionData.producedQty}` };
        return { pass: false, detail: 'productionData missing' };
      });
  }

  // ---- 阶段7：质检模块功能测试 ----
  console.log('\n--- 阶段7：质检模块功能测试 ---');

  // 7.1 质检合格
  if (taskId) {
    await apiTest('POST /api/tasks/qc-data 质检合格', 'POST', '/api/tasks/qc-data',
      { id: taskId, qcData: { qualifiedQty: 9, unqualifiedQty: 1, defectReasons: '尺寸偏差', result: 'pass', qcBy: '李四' } }, 200,
      (r) => r.json && r.json.success === true && r.json.newStatus === 'qc-passed'
        ? { pass: true, detail: '→ qc-passed' }
        : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });
  }

  // 7.2 返工流程
  const reworkRes = await httpRequest('POST', '/api/tasks',
    { productFolder: '返工测试', quantity: 5, assignedTo: '张三', status: 'pending' });
  let reworkId = null;
  if (reworkRes.json && reworkRes.json.success) {
    reworkId = (await httpRequest('GET', '/api/tasks')).json.tasks[0].id;
  }
  if (reworkId) {
    await httpRequest('POST', '/api/tasks/status', { id: reworkId, status: 'in-progress' });
    await httpRequest('POST', '/api/tasks/production-data',
      { id: reworkId, productionData: { producedQty: 5, goodQty: 3, badQty: 2, completedBy: '张三' } });
    await apiTest('POST /api/tasks/qc-data 质检返工', 'POST', '/api/tasks/qc-data',
      { id: reworkId, qcData: { qualifiedQty: 3, unqualifiedQty: 2, defectReasons: '表面划伤', result: 'rework', qcBy: '李四' } }, 200,
      (r) => r.json && r.json.success === true && r.json.newStatus === 'rework'
        ? { pass: true, detail: '→ rework' }
        : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });
  }

  // 7.3 报废流程
  const scrapRes = await httpRequest('POST', '/api/tasks',
    { productFolder: '报废测试', quantity: 3, assignedTo: '张三', status: 'pending' });
  let scrapId = null;
  if (scrapRes.json && scrapRes.json.success) {
    scrapId = (await httpRequest('GET', '/api/tasks')).json.tasks[0].id;
  }
  if (scrapId) {
    await httpRequest('POST', '/api/tasks/status', { id: scrapId, status: 'in-progress' });
    await httpRequest('POST', '/api/tasks/production-data',
      { id: scrapId, productionData: { producedQty: 3, goodQty: 0, badQty: 3, completedBy: '张三' } });
    await apiTest('POST /api/tasks/qc-data 质检报废', 'POST', '/api/tasks/qc-data',
      { id: scrapId, qcData: { qualifiedQty: 0, unqualifiedQty: 3, defectReasons: '材料不合格', result: 'scrap', qcBy: '李四' } }, 200,
      (r) => r.json && r.json.success === true && r.json.newStatus === 'scrap'
        ? { pass: true, detail: '→ scrap' }
        : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });
  }

  // ---- 阶段8：库存模块功能测试 ----
  console.log('\n--- 阶段8：库存模块功能测试 ---');

  // 8.1 获取库存
  await apiTest('GET /api/inventory 获取库存', 'GET', '/api/inventory', null, 200,
    (r) => r.json && Array.isArray(r.json.items)
      ? { pass: true, detail: `items=${r.json.items.length}` }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // 8.2 获取流水日志
  await apiTest('GET /api/inventory/logs 获取流水日志', 'GET', '/api/inventory/logs?limit=50', null, 200,
    (r) => r.json && Array.isArray(r.json.logs)
      ? { pass: true, detail: `logs=${r.json.logs.length}, total=${r.json.total}` }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // 8.3 设置安全库存（如果库存有项的话）
  const invRes = await httpRequest('GET', '/api/inventory');
  if (invRes.json && invRes.json.items && invRes.json.items.length > 0) {
    const item = invRes.json.items[0];
    await apiTest('POST /api/inventory/safety 设置安全库存', 'POST', '/api/inventory/safety',
      { productCode: item.productCode, version: item.version, productName: item.productName, safetyStock: 5 }, 200,
      (r) => r.json && r.json.success === true
        ? { pass: true, detail: '安全库存已设置' }
        : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });
  } else {
    test('POST /api/inventory/safety 设置安全库存', true, '跳过（库存为空）');
  }

  // ---- 阶段9：产品模块功能测试 ----
  console.log('\n--- 阶段9：产品模块功能测试 ---');

  await apiTest('GET /api/tree 目录树', 'GET', '/api/tree', null, 200,
    (r) => r.json !== null
      ? { pass: true, detail: '返回目录树' }
      : { pass: false, detail: '返回null' });

  // ---- 阶段10：状态值合法性校验 ----
  console.log('\n--- 阶段10：状态值合法性校验 ---');

  if (taskId) {
    await apiTest('POST /api/tasks/status 非法状态应拒绝', 'POST', '/api/tasks/status',
      { id: taskId, status: 'INVALID_STATUS' }, 200,
      (r) => r.json && r.json.error && r.json.error.includes('不合法')
        ? { pass: true, detail: '拒绝非法状态值' }
        : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });
  }

  // ---- 阶段11：桌面端专用 API 拦截 ----
  console.log('\n--- 阶段11：桌面端专用 API 拦截 ---');

  await apiTest('GET /api/settings 桌面端专用应拒绝', 'GET', '/api/settings', null, 403,
    (r) => r.json && r.json.error
      ? { pass: true, detail: r.json.error }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  await apiTest('GET /api/web-config 桌面端专用应拒绝', 'GET', '/api/web-config', null, 403,
    (r) => r.json && r.json.error
      ? { pass: true, detail: r.json.error }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  await apiTest('GET /api/online-devices 桌面端专用应拒绝', 'GET', '/api/online-devices', null, 403,
    (r) => r.json && r.json.error
      ? { pass: true, detail: r.json.error }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // ---- 阶段12：解绑员工后恢复拦截 ----
  console.log('\n--- 阶段12：解绑员工后恢复拦截 ---');

  // 直接修改 settings.json 清除 workerName
  try {
    const s = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    if (s.machineAccess) {
      const entry = s.machineAccess.find(m => m.machineCode === MACHINE_CODE);
      if (entry) {
        entry.workerName = '';
        fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2), 'utf-8');
      }
    }
  } catch (e) {}

  await apiTest('GET /api/tasks 解绑后应拒绝', 'GET', '/api/tasks', null, 403,
    (r) => r.json && r.json.code === 'UNBOUND_EMPLOYEE'
      ? { pass: true, detail: 'code=UNBOUND_EMPLOYEE' }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  await apiTest('GET /api/inventory 解绑后应拒绝', 'GET', '/api/inventory', null, 403,
    (r) => r.json && r.json.code === 'UNBOUND_EMPLOYEE'
      ? { pass: true, detail: 'code=UNBOUND_EMPLOYEE' }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // ---- 阶段13：绑定弹窗参数校验 ----
  console.log('\n--- 阶段13：绑定弹窗参数校验 ---');

  await apiTest('POST /api/bind-employee 空姓名应拒绝', 'POST', '/api/bind-employee',
    { employeeId: 'E001', workerName: '' }, 200,
    (r) => r.json && r.json.error && r.json.error.includes('不能为空')
      ? { pass: true, detail: '拒绝空姓名' }
      : { pass: false, detail: JSON.stringify(r.json).slice(0, 80) });

  // ---- 关闭服务器 ----
  try { webServer.close(); } catch (e) {}

  // ---- 恢复数据文件 ----
  restoreFiles();

  // ---- 汇总报告 ----
  console.log('\n========== 测试结果汇总 ==========');
  console.log(`总计: ${results.length} 项`);
  console.log(`通过: ${passCount} 项`);
  console.log(`失败: ${failCount} 项`);
  console.log(`通过率: ${(passCount / results.length * 100).toFixed(1)}%`);

  if (failCount > 0) {
    console.log('\n--- 失败项明细 ---');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  [FAIL] ${r.name} — ${r.detail}`);
    });
  }

  console.log('\n========== 测试结束 ==========');
  process.exit(failCount > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(e => {
  console.error('测试执行异常:', e);
  restoreFiles();
  process.exit(1);
});
