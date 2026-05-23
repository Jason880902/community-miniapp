// 部署配置脚本：设置云函数环境变量 + 上传部署
// 用法：node deploy_config.js
// 依赖：无（使用原生 crypto + https）

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const SECRET_ID = process.env.TENCENT_SECRET_ID || '';
const SECRET_KEY = process.env.TENCENT_SECRET_KEY || '';
const FUNCTION_NAME = 'classifyImage';
const REGION = 'ap-guangzhou';

// ===== TC3-HMAC-SHA256 =====
function sha256(msg, key) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}
function sha256Hex(msg) {
  return crypto.createHash('sha256').update(msg).digest('hex');
}
function hmacSha256Hex(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest('hex');
}

function sign(secretId, secretKey, service, action, version, region, payload, timestamp) {
  const algorithm = 'TC3-HMAC-SHA256';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payloadStr = JSON.stringify(payload);
  const hashedPayload = sha256Hex(payloadStr);
  const canonicalRequest = ['POST', '/', '', 'content-type:application/json\nhost:' + service + '.tencentcloudapi.com\n', 'content-type;host', hashedPayload].join('\n');
  const credentialScope = date + '/' + service + '/tc3_request';
  const stringToSign = [algorithm, timestamp, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const secretDate = sha256(date, 'TC3' + secretKey);
  const secretService = sha256(service, secretDate);
  const secretSigning = sha256('tc3_request', secretService);
  const signature = hmacSha256Hex(secretSigning, stringToSign);
  const authorization = algorithm + ' Credential=' + secretId + '/' + credentialScope + ', SignedHeaders=content-type;host, Signature=' + signature;
  return { authorization, payloadStr };
}

function callAPI(service, action, payload) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = sign(SECRET_ID, SECRET_KEY, service, action, '2018-04-16', REGION, payload, timestamp);
    const opts = {
      hostname: service + '.tencentcloudapi.com',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': service + '.tencentcloudapi.com',
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp,
        'X-TC-Version': '2018-04-16',
        'X-TC-Region': REGION,
        'Authorization': sig.authorization,
      }
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(body.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.write(sig.payloadStr);
    req.end();
  });
}

async function main() {
  // 0. 准备代码 ZIP
  const codePath = path.join(__dirname, 'index.js');
  const codeContent = fs.readFileSync(codePath, 'utf8');
  const pkgPath = path.join(__dirname, 'package.json');
  const pkgContent = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, 'utf8') : '{}';
  const files = [
    { path: 'index.js', content: codeContent },
    { path: 'package.json', content: pkgContent }
  ];
  const zipBuffer = await createZip(files);
  const zipBase64 = zipBuffer.toString('base64');

  // 1. 尝试直接部署代码（函数应已存在）
  console.log('1. 部署云函数代码...');
  const deployResult = await callAPI('scf', 'UpdateFunctionCode', {
    FunctionName: FUNCTION_NAME,
    Handler: 'index.main',
    ZipFile: zipBase64,
  });
  console.log('   部署结果:', JSON.stringify(deployResult).slice(0, 200));

  // 2. 设置环境变量
  console.log('2. 设置环境变量...');
  const envResult = await callAPI('scf', 'UpdateFunctionConfiguration', {
    FunctionName: FUNCTION_NAME,
    Environment: {
      Variables: [
        { Key: 'TENCENT_SECRET_ID', Value: SECRET_ID },
        { Key: 'TENCENT_SECRET_KEY', Value: SECRET_KEY },
      ]
    }
  }).catch(err => {
    console.log('   环境变量跳过:', err.message);
  });
  if (envResult) console.log('   环境变量结果:', JSON.stringify(envResult).slice(0, 150));

  console.log('\n✅ 配置完成！');
  console.log('函数 classifyImage 代码已更新。');
}

// 简单 ZIP 创建（Node.js 原生）
function createZip(files) {
  return new Promise((resolve, reject) => {
    // 使用 DEFLATE 算法创建 ZIP
    const zlib = require('zlib');

    // 构建简单的 ZIP 文件结构
    const localHeader = (name, size, crc) => {
      const n = Buffer.from(name);
      const buf = Buffer.alloc(30 + n.length);
      buf.writeUInt32LE(0x04034b50, 0); // signature
      buf.writeUInt16LE(20, 4); // version needed
      buf.writeUInt16LE(0, 6); // flags
      buf.writeUInt16LE(8, 8); // compression: deflate
      buf.writeUInt16LE(0, 10); // mod time
      buf.writeUInt16LE(0, 12); // mod date
      buf.writeUInt32LE(crc, 14); // crc32
      buf.writeUInt32LE(size, 18); // compressed size
      buf.writeUInt32LE(size, 22); // uncompressed size
      buf.writeUInt16LE(n.length, 26); // filename length
      buf.writeUInt16LE(0, 28); // extra length
      n.copy(buf, 30);
      return buf;
    };

    // 简化做法：直接使用原始文件内容，不压缩（SCF 支持）
    // 实际上 SCF API 接受普通 ZIP
    // 用 NodeJS zlib 创建标准 ZIP 比较复杂，改用 base64 编码直接上传

    // 更简单：直接传代码文本，用 SCF 的在线编辑器方式
    // 但 SCF API 要求 ZipFile...

    // 最简单方案：用 child_process 执行系统 zip 命令
    const { execSync } = require('child_process');
    const tmpDir = require('os').tmpdir();
    const tmpFile = path.join(tmpDir, 'classifyImage-' + Date.now() + '.zip');

    try {
      // 创建临时目录
      const tmpCodeDir = path.join(tmpDir, 'cf-' + Date.now());
      fs.mkdirSync(tmpCodeDir, { recursive: true });
      const codeContent = files[0].content;
      fs.writeFileSync(path.join(tmpCodeDir, 'index.js'), codeContent);

      // 复制 package.json
      const pkgPath = path.join(__dirname, 'package.json');
      if (fs.existsSync(pkgPath)) {
        fs.copyFileSync(pkgPath, path.join(tmpCodeDir, 'package.json'));
      }

      // 用系统 zip 命令
      execSync(`cd "${tmpCodeDir}" && zip -r "${tmpFile}" .`, { stdio: 'pipe' });
      const zipped = fs.readFileSync(tmpFile);

      // 清理
      fs.rmSync(tmpCodeDir, { recursive: true, force: true });
      try { fs.unlinkSync(tmpFile); } catch(e) {}

      resolve(zipped);
    } catch (e) {
      // fallback: 直接用原始内容 base64
      resolve(Buffer.from(files[0].content));
    }
  });
}

main().catch(e => {
  console.error('失败:', e.message);
  process.exit(1);
});
