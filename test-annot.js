// 测试标注保存和读取逻辑
const fs = require('fs');
const path = require('path');

const FILES_DIR = path.join(__dirname, 'files');

function safeJoin(...segments) {
  const full = path.join(FILES_DIR, ...segments);
  const rel = path.relative(FILES_DIR, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return full;
}

function getAnnotationsFilePath(pdfRelPath) {
  const pdfFullPath = safeJoin(pdfRelPath);
  if (!pdfFullPath) return null;
  const dir = path.dirname(pdfFullPath);
  const base = path.basename(pdfFullPath, path.extname(pdfFullPath));
  return path.join(dir, base + '.annotations.json');
}

// 测试 001 PDF 的标注路径
const pdfPath = 'BXB10025/YSZC-ME02-05-001-V1.1针齿壳BXSB10025.PDF';
const annotPath = getAnnotationsFilePath(pdfPath);
console.log('PDF相对路径:', pdfPath);
console.log('标注文件路径:', annotPath);
console.log('标注文件存在:', fs.existsSync(annotPath));

if (fs.existsSync(annotPath)) {
  const content = fs.readFileSync(annotPath, 'utf-8');
  const annots = JSON.parse(content);
  console.log('标注内容:', JSON.stringify(annots, null, 2));
  const page1 = annots['1'] || [];
  console.log('第1页标注数:', page1.length);
  page1.forEach((a, i) => {
    console.log(`  标注${i+1}: type=${a.type}, text="${a.text}", color=${a.color}, source=${a.source || 'manual'}`);
  });
}

// 测试 010 PDF 的标注路径
console.log('\n--- 010 PDF ---');
const pdfPath2 = 'BXB10025/YSZC-ME02-05-010-V1.1动子传动件下BXSB10025.PDF';
const annotPath2 = getAnnotationsFilePath(pdfPath2);
console.log('PDF相对路径:', pdfPath2);
console.log('标注文件路径:', annotPath2);
console.log('标注文件存在:', fs.existsSync(annotPath2));
if (fs.existsSync(annotPath2)) {
  const content2 = fs.readFileSync(annotPath2, 'utf-8');
  const annots2 = JSON.parse(content2);
  console.log('标注内容:', JSON.stringify(annots2, null, 2));
}

// 测试 BOM 数据
console.log('\n--- BOM 数据 ---');
const bomPath = path.join(FILES_DIR, 'BXB10025', 'BOM.json');
if (fs.existsSync(bomPath)) {
  const bom = JSON.parse(fs.readFileSync(bomPath, 'utf-8'));
  console.log('BOM rows:', bom.rows.length);
  bom.rows.forEach((r, i) => {
    console.log(`  行${i+1}: fileName=${r.fileName}, material="${r.material}", texture="${r.texture}", remark="${r.remark}"`);
  });
}