// 云函数 contentAudit
// 调用腾讯云 IMS ImageModeration 审核图片内容（色情/暴恐/政治/广告）
// 使用 TC3-HMAC-SHA256 签名直接调用（零外部依赖）
//
// 配置环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY 启用
// 未配置时自动返回 approved（静默放行，仅打日志）

const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

let localConfig = {};
try { localConfig = require('./config.js'); } catch (e) {}

// 审核安全模式: 'enforce' | 'failOpen'
// enforce — API 不可用时拒绝所有图片
// failOpen — API 不可用时放行（开发阶段用）
const AUDIT_MODE = 'failOpen';

// 最大图片字节数（5MB，超过则直接放行并打日志）
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ===== TC3-HMAC-SHA256 签名 =====
function sha256(msg, key) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}
function sha256Hex(msg) {
  return crypto.createHash('sha256').update(msg).digest('hex');
}
function hmacSha256Hex(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest('hex');
}

function signRequest(secretId, secretKey, service, action, version, region, payload, timestamp) {
  const algorithm = 'TC3-HMAC-SHA256';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const httpMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQuery = '';
  const canonicalHeaders = 'content-type:application/json\nhost:' + service + '.tencentcloudapi.com\n';
  const signedHeaders = 'content-type;host';
  const payloadStr = JSON.stringify(payload);
  const hashedPayload = sha256Hex(payloadStr);
  const canonicalRequest = [httpMethod, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, hashedPayload].join('\n');

  const credentialScope = date + '/' + service + '/tc3_request';
  const hashedCanonicalRequest = sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

  const secretDate = sha256(date, 'TC3' + secretKey);
  const secretService = sha256(service, secretDate);
  const secretSigning = sha256('tc3_request', secretService);
  const signature = hmacSha256Hex(secretSigning, stringToSign);

  const authorization = algorithm + ' Credential=' + secretId + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  return { authorization, date, signedHeaders, hashedPayload, payloadStr };
}

// ===== 调用 IMS ImageModeration =====
function callIMS(imageBase64, secretId, secretKey) {
  return new Promise((resolve, reject) => {
    const service = 'ims';
    const action = 'ImageModeration';
    const version = '2021-02-04';
    const region = 'ap-guangzhou';
    const timestamp = Math.floor(Date.now() / 1000);

    const payload = {
      ImageBase64: imageBase64,
      Scenes: ['PORN', 'TERRORISM', 'POLITICS', 'ADS', 'ILLEGAL']
    };

    const sig = signRequest(secretId, secretKey, service, action, version, region, payload, timestamp);

    const options = {
      hostname: service + '.tencentcloudapi.com',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': service + '.tencentcloudapi.com',
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp,
        'X-TC-Version': version,
        'X-TC-Region': region,
        'Authorization': sig.authorization,
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.Response && parsed.Response.Error) {
            reject(new Error(parsed.Response.Error.Message));
          } else {
            resolve(parsed.Response || parsed);
          }
        } catch (e) {
          reject(new Error('parse failed: ' + body.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(sig.payloadStr);
    req.end();
  });
}

// ===== 判断审核结果 =====
function interpretResult(imsResponse) {
  // IMS ImageModeration 返回结构
  const suggestion = imsResponse.Suggestion || 'Pass';
  const label = imsResponse.Label || 'Normal';
  const score = imsResponse.Score || 0;

  switch (suggestion) {
    case 'Pass':
      return { approved: true, suggestion, label, score, msg: '' };
    case 'Review':
      // 需要人工复审 → 开发阶段先放行但打标记
      return { approved: true, suggestion, label, score, msg: '图片需人工复核: ' + label };
    case 'Block':
      return { approved: false, suggestion, label, score, msg: '图片包含违规内容: ' + label };
    default:
      return { approved: true, suggestion, label, score, msg: '未知审核结果: ' + suggestion };
  }
}

// ===== 云函数入口 =====
exports.main = async (event) => {
  const { fileID } = event;
  if (!fileID) {
    return { code: -1, msg: '缺少 fileID' };
  }

  const secretId = process.env.TENCENT_SECRET_ID || localConfig.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY || localConfig.TENCENT_SECRET_KEY;

  if (!secretId || !secretKey) {
    console.warn('[contentAudit] MISSING TENCENT_SECRET_ID/KEY — 无法审核，静默放行');
    return { code: 0, approved: true, suggestion: 'Pass', label: 'Normal', msg: '未配置审核密钥，已自动放行' };
  }

  try {
    // 下载图片
    const dlRes = await cloud.downloadFile({ fileID });
    const buffer = dlRes.fileContent;

    if (buffer.length > MAX_IMAGE_BYTES) {
      console.warn('[contentAudit] 图片过大（%d bytes），跳过审核', buffer.length);
      return { code: 0, approved: true, suggestion: 'Pass', label: 'Normal', msg: '图片过大，跳过审核' };
    }

    const imageBase64 = buffer.toString('base64');
    const imsResponse = await callIMS(imageBase64, secretId, secretKey);
    const result = interpretResult(imsResponse);

    console.log('[contentAudit] result:', JSON.stringify(result));

    return { code: 0, ...result };

  } catch (err) {
    console.error('[contentAudit] 审核失败:', err.message);

    if (AUDIT_MODE === 'enforce') {
      return { code: 0, approved: false, suggestion: 'Error', label: 'Error', msg: '审核服务异常: ' + err.message };
    }

    // failOpen: 放行
    return { code: 0, approved: true, suggestion: 'Pass', label: 'Normal', msg: '审核服务暂不可用，已自动放行' };
  }
};
