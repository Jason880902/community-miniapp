// 云函数 classifyImage
// 图片智能分类 + 描述生成
// 使用 TC3-HMAC-SHA256 签名直接调用腾讯云 TIIA API（零外部依赖）
//
// 配置环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY 启用 AI
// 未配置时自动降级为关键词匹配

const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 优先用环境变量，无则读本地配置文件（更可靠）
let localConfig = {};
try { localConfig = require('./config.js'); } catch (e) {}

// ===== 类别知识库 =====
const CATEGORIES = [
  { name: '家具家居', en: 'furniture', keywords: ['沙发', '桌子', '椅子', '床', '柜子', '茶几', '书架', '衣柜', '床垫', '书桌', '鞋柜', '电视柜', '床头柜', '梳妆台', '餐桌', '凳子', '榻榻米', '屏风', '置物架', '花架', '电脑桌', '办公桌'], aliases: ['desk', 'table', 'chair', 'bed', 'cabinet', 'shelf', 'sofa', 'furniture', 'wardrobe'] },
  { name: '电子产品', en: 'electronics', keywords: ['手机', '电脑', '平板', '耳机', '音箱', '相机', '手表', '充电器', '键盘', '鼠标', '显示器', '打印机', '路由器', '硬盘', 'U盘', '充电宝', '数据线', '机箱', '笔记本', 'iPad', '蓝牙', '麦克风', '摄像头', '投影仪', '游戏机', 'switch', 'ps4', 'ps5'], aliases: ['phone', 'computer', 'laptop', 'tablet', 'earphone', 'speaker', 'camera', 'keyboard', 'mouse', 'monitor', 'printer', 'router', 'electronic'] },
  { name: '书籍文具', en: 'books', keywords: ['书', '本子', '笔', '文具', '词典', '画册', '教材', '小说', '绘本', '字帖', '文具盒', '书包', '笔记本', '手账', '贴纸', '明信片', '杂志', '漫画', '散文', '文学', '百科'], aliases: ['book', 'magazine', 'novel', 'stationery', 'pen', 'notebook'] },
  { name: '服饰鞋包', en: 'clothing', keywords: ['衣服', '裤子', '鞋子', '帽子', '包包', '裙子', '外套', '围巾', '衬衫', 'T恤', '卫衣', '羽绒服', '风衣', '运动鞋', '皮鞋', '凉鞋', '拖鞋', '皮带', '钱包', '双肩包', '单肩包', '行李箱', '首饰', '手表带'], aliases: ['clothing', 'shirt', 'shoes', 'hat', 'bag', 'dress', 'coat', 'jacket', 'accessory'] },
  { name: '母婴儿童', en: 'baby', keywords: ['婴儿', '儿童', '玩具', '推车', '奶瓶', '童车', '积木', '娃娃', '早教', '绘本', '摇铃', '磨牙', '餐椅', '婴儿床', '安全座椅', '学步车', '滑板车', '遥控车', '毛绒', '拼图', '乐高'], aliases: ['baby', 'toy', 'stroller', 'bottle', 'children', 'infant'] },
  { name: '运动户外', en: 'sports', keywords: ['球', '球拍', '瑜伽', '哑铃', '跳绳', '泳镜', '帐篷', '登山', '跑步', '健身', '露营', '羽毛球', '篮球', '足球', '乒乓球', '护具', '运动手环', '水杯', '单车', '滑板', '轮滑'], aliases: ['ball', 'racket', 'yoga', 'dumbbell', 'sports', 'fitness', 'camping', 'tent', 'bike'] },
  { name: '厨房用具', en: 'kitchen', keywords: ['锅', '碗', '筷子', '勺子', '杯子', '水壶', '盘子', '电饭煲', '厨具', '刀具', '砧板', '保鲜盒', '调味罐', '咖啡机', '豆浆机', '榨汁机', '烤箱', '微波炉', '餐具', '茶具', '酒具'], aliases: ['pot', 'pan', 'bowl', 'cup', 'kettle', 'kitchen', 'cookware', 'microwave', 'oven'] },
  { name: '日用百货', en: 'daily', keywords: ['灯', '桶', '架', '收纳', '盒', '镜', '伞', '袋', '挂钩', '置物架', '衣架', '晾衣架', '收纳箱', '垃圾桶', '地毯', '窗帘', '抱枕', '靠垫', '装饰', '摆件', '相框', '钟表'], aliases: ['lamp', 'mirror', 'umbrella', 'organizer', 'curtain', 'cushion', 'decoration'] },
  { name: '植物花卉', en: 'plants', keywords: ['花', '绿植', '盆栽', '多肉', '植物', '花盆', '种子', '花瓶', '鲜花', '富贵竹', '吊兰', '绿萝', '仙人掌', '兰花', '玫瑰', '百合', '郁金香'], aliases: ['plant', 'flower', 'pot', 'bonsai', 'succulent'] },
  { name: '其他', en: 'other', keywords: ['药', '保健', '口罩', '体温', '乐器', '吉他', '钢琴', '小提琴', '画画', '颜料', '画板', '宠物', '猫', '狗', '鱼缸', '鸟笼'], aliases: ['other', 'music', 'pet', 'medicine'] }
];

// ===== 描述模板（统一格式） =====
const DESC_TEMPLATE = (t, c) => `${t}，${c}，希望它能找到新主人，继续发挥价值。`;

const CONDITION_TEXT = {
  '全新': '全新未拆封，包装完好',
  '几乎全新': '几乎全新，仅使用过一两次',
  '九成新': '九成新，使用痕迹很少',
  '八成新': '八成新，正常使用痕迹',
  '七成新': '七成新，有一定使用痕迹但不影响功能',
  '有瑕疵': '有瑕疵，已标注出问题位置'
};

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

  // 1. Canonical Request
  const httpMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQuery = '';
  const canonicalHeaders = 'content-type:application/json\nhost:' + service + '.tencentcloudapi.com\n';
  const signedHeaders = 'content-type;host';
  const payloadStr = JSON.stringify(payload);
  const hashedPayload = sha256Hex(payloadStr);
  const canonicalRequest = [httpMethod, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, hashedPayload].join('\n');

  // 2. String to Sign
  const credentialScope = date + '/' + service + '/tc3_request';
  const hashedCanonicalRequest = sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

  // 3. Signing Key
  const secretDate = sha256(date, 'TC3' + secretKey);
  const secretService = sha256(service, secretDate);
  const secretSigning = sha256('tc3_request', secretService);
  const signature = hmacSha256Hex(secretSigning, stringToSign);

  // 4. Authorization
  const authorization = algorithm + ' Credential=' + secretId + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  return { authorization, date, signedHeaders, hashedPayload, payloadStr };
}

// ===== 调用腾讯云 TIIA DetectLabel =====
function callTIIA(imageBase64, secretId, secretKey) {
  return new Promise((resolve, reject) => {
    const service = 'tiia';
    const action = 'DetectLabel';
    const version = '2019-05-29';
    const region = 'ap-guangzhou';
    const timestamp = Math.floor(Date.now() / 1000);

    const payload = {
      ImageBase64: imageBase64,
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

// ===== 调用混元大模型 Vision =====
// 使用 hunyuan-vision 模型直接理解图片内容，返回结构化 JSON
function callHunyuanVision(imageBase64, title, secretId, secretKey) {
  return new Promise((resolve, reject) => {
    const service = 'hunyuan';
    const action = 'ChatCompletions';
    const version = '2024-06-01';
    const region = 'ap-guangzhou';
    const timestamp = Math.floor(Date.now() / 1000);

    const prompt = `你是一个社区旧物分享平台的AI助手。请分析这张图片中的旧物，提取信息并以JSON格式返回：
{
  "category": "物品类别（从以下选一）：家具家居、电子产品、书籍文具、服饰鞋包、母婴儿童、运动户外、厨房用具、日用百货、植物花卉、其他",
  "condition": "物品成色：全新、几乎全新、九成新、八成新、七成新、有瑕疵",
  "description": "简短自然的物品描述，30字以内",
  "title": "物品名称，10字以内"
}
只返回JSON，不要其他文字。${title ? '标题参考：' + title : ''}`;

    const payload = {
      Model: 'hunyuan-vision',
      Messages: [{
        Role: 'user',
        Content: [
          { Type: 'text', Text: prompt },
          { Type: 'image_url', ImageUrl: { Url: 'data:image/jpeg;base64,' + imageBase64 } }
        ]
      }],
      Stream: false
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

// ===== 解析混元响应 =====
function parseHunyuanResult(response, title) {
  let content = '';
  try {
    content = response.Choices?.[0]?.Message?.Content || '';
  } catch (e) {
    throw new Error('无法解析混元响应');
  }

  // 提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('混元未返回有效JSON');
  let data;
  try { data = JSON.parse(jsonMatch[0]); } catch (e) { throw new Error('混元JSON解析失败'); }

  // 校验类别
  const validCats = CATEGORIES.map(c => c.name);
  const category = validCats.includes(data.category) ? data.category : '';

  // 校验成色
  const validConds = ['全新', '几乎全新', '九成新', '八成新', '七成新', '有瑕疵'];
  const condition = validConds.includes(data.condition) ? data.condition : '';
  const desc = data.description || '';
  const suggestedTitle = data.title || '';

  return { category, condition, description: desc, suggestedTitle };
}

// ===== AI 标签 → 分类映射 =====
function mapLabelsToCategory(labels) {
  const labelNames = labels.map(l => (l.Name || '').toLowerCase());
  let bestCat = '其他';
  let bestScore = 0;

  for (const cat of CATEGORIES) {
    let score = 0;
    // 检查英文 AI 标签是否匹配类别别名
    for (const alias of cat.aliases) {
      for (const label of labelNames) {
        if (label.includes(alias) || alias.includes(label)) {
          if (label === alias) score += 30;
          else if (label.includes(alias)) score += 20;
          else score += 10;
        }
      }
    }
    // 检查中文关键词
    for (const kw of cat.keywords) {
      for (const label of labelNames) {
        if (label.includes(kw.toLowerCase())) {
          score += 25;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat.name;
    }
  }

  // 取最高置信度标签的分数
  const confidence = labels.length > 0 ? Math.round(Math.max(...labels.map(l => (l.Confidence || 0) * 100))) : 60;
  return { category: bestCat, confidence: Math.min(confidence, 99) };
}

// ===== 降级：关键词匹配 =====
function extractKeywords(fileName) {
  const name = (fileName || '').toLowerCase().replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
  return name.split(/[-_\s]+/).filter(p => p.length > 1 && !/^\d+$/.test(p));
}

function classifyByKeywords(keywords) {
  const scores = CATEGORIES.map(cat => {
    let score = 0;
    for (const kw of keywords) {
      for (const catKw of cat.keywords) {
        const k = kw.toLowerCase();
        const ck = catKw.toLowerCase();
        if (k === ck) score += 30;
        else if (k.includes(ck) || ck.includes(k)) score += 20;
      }
      for (const alias of cat.aliases) {
        if (kw === alias) score += 25;
        else if (kw.includes(alias)) score += 15;
      }
    }
    return { name: cat.name, score };
  });

  const best = scores.reduce((a, b) => a.score > b.score ? a : b);
  return {
    category: best.name,
    confidence: Math.min(60 + best.score, 96) + '%'
  };
}

function guessCondition(keywords) {
  const kw = keywords.join(' ');
  if (/全新|未拆|未用|包装|未开封/.test(kw)) return '全新';
  if (/几乎|仅试|仅用/.test(kw)) return '几乎全新';
  if (/九成|轻微|轻度/.test(kw)) return '九成新';
  if (/八成/.test(kw)) return '八成新';
  if (/七成/.test(kw)) return '七成新';
  if (/瑕疵|破损|坏了|维修/.test(kw)) return '有瑕疵';
  return '';
}

function generateDescription(category, condition, title) {
  const condText = condition || '几乎全新';
  if (title) {
    return DESC_TEMPLATE(title, condText);
  }
  return DESC_TEMPLATE('一件' + category, condText);
}

// ===== 从 fileID 提取文件名关键词 =====
function extractKeywordsFromFileID(fileID) {
  if (!fileID) return [];
  // fileID 格式: cloud://env-id.xxx/items/123456789.jpg
  // 提取文件名部分
  const fileName = fileID.split('/').pop() || '';
  const name = fileName.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
  // 纯数字文件名无意义
  if (/^\d+$/.test(name)) return [];
  return name.split(/[-_\s]+/).filter(p => p.length > 1 && !/^\d+$/.test(p));
}

// ===== 根据标题做关键词匹配（比 fileID 准确） =====
function classifyByTitle(title) {
  if (!title) return { category: '', condition: '' };
  const t = title.toLowerCase();
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (t.includes(kw.toLowerCase())) {
        return { category: cat.name, condition: guessCondition(t.split(/\s+/)) };
      }
    }
    for (const alias of cat.aliases) {
      if (t === alias || t.includes(alias)) {
        return { category: cat.name, condition: guessCondition(t.split(/\s+/)) };
      }
    }
  }
  return { category: '', condition: '' };
}

// ===== 云函数入口 =====
exports.main = async (event, context) => {
  const { fileID, title } = event;

  const secretId = process.env.TENCENT_SECRET_ID || localConfig.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY || localConfig.TENCENT_SECRET_KEY;

  // 诊断：环境变量是否加载
  if (!secretId || !secretKey) {
    console.error('[classifyImage] MISSING ENV VARS: TENCENT_SECRET_ID=' + !!secretId + ' TENCENT_SECRET_KEY=' + !!secretKey);
  }

  try {

    // 有密钥 → 使用真实 AI
    if (secretId && secretKey) {
      let imageBase64 = null;
      try {
        const dlRes = await cloud.downloadFile({ fileID });
        imageBase64 = dlRes.fileContent.toString('base64');
      } catch (dlErr) {
        console.warn('[classifyImage] download failed:', dlErr.message);
      }

      if (imageBase64) {
        // === 第一优先：混元大模型 Vision ===
        try {
          const hyRes = await callHunyuanVision(imageBase64, title, secretId, secretKey);
          const parsed = parseHunyuanResult(hyRes, title);
          if (parsed.category) {
            const condition = parsed.condition || '几乎全新';
            const desc = parsed.description || generateDescription(parsed.category, condition, title || parsed.suggestedTitle);
            return {
              code: 0,
              category: parsed.category,
              confidence: '95%',
              condition,
              description: desc,
              suggestedTitle: parsed.suggestedTitle || '',
              note: '已使用混元大模型识别'
            };
          }
        } catch (hyErr) {
          console.error('[classifyImage] 混元识别失败，降级至 TIIA:', hyErr.message);
        }

        // === 第二优先：TIIA DetectLabel ===
        try {
          const result = await callTIIA(imageBase64, secretId, secretKey);
          const labels = result.Labels || [];
          const { category, confidence } = mapLabelsToCategory(labels);
          const labelWords = labels.map(l => (l.Name || '').toLowerCase());
          const bestLabel = labels.length > 0 ? labels.reduce((a, b) => (a.Confidence || 0) > (b.Confidence || 0) ? a : b).Name || '' : '';
          const condition = guessCondition(labelWords) || '几乎全新';
          const desc = generateDescription(category, condition, title || bestLabel);

          return {
            code: 0,
            category,
            confidence: confidence + '%',
            condition,
            description: desc,
            suggestedTitle: bestLabel,
            note: '已使用腾讯云 AI 图像识别'
          };
        } catch (aiErr) {
          console.error('[classifyImage] TIIA call failed:', aiErr.message);
          // TIIA 失败时尝试用标题匹配 + 文件名补充
          const titleResult = classifyByTitle(title);
          if (titleResult.category) {
            const desc = generateDescription(titleResult.category, titleResult.condition, title);
            return {
              code: 0,
              category: titleResult.category,
              confidence: '70%',
              condition: titleResult.condition,
              description: desc,
              note: 'AI 识别暂不可用（' + aiErr.message + '），已根据标题关键词匹配'
            };
          }
          throw aiErr;
        }
      }
    }

    // 无密钥 / AI 失败且标题无信息 → 完整降级
    // 先试标题，再试 fileID 文件名，最后给默认值
    const titleResult = classifyByTitle(title);
    if (titleResult.category) {
      const desc = generateDescription(titleResult.category, titleResult.condition, title);
      return {
        code: 0,
        category: titleResult.category,
        confidence: '70%',
        condition: titleResult.condition,
        description: desc,
        note: '当前为关键词匹配模式，配置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY 启用真实 AI'
      };
    }

    const fileNameKeywords = extractKeywordsFromFileID(fileID);
    if (fileNameKeywords.length > 0) {
      const result = classifyByKeywords(fileNameKeywords);
      const condition = guessCondition(fileNameKeywords);
      const desc = generateDescription(result.category, condition, title);
      return {
        code: 0,
        category: result.category,
        confidence: result.confidence,
        condition,
        description: desc,
        note: '根据文件名关键词匹配'
      };
    }

    // 完全无信息 → 兜底给"其他"
    const envStatus = 'SECRET_ID=' + (secretId ? '✓' : '✗') + ' SECRET_KEY=' + (secretKey ? '✓' : '✗');
    return {
      code: 0,
      category: '其他',
      confidence: '40%',
      condition: '',
      description: '',
      note: '环境变量: ' + envStatus + '。未识别到具体类别，请填写标题后重试'
    };

  } catch (err) {
    console.error('[classifyImage] fatal error:', err.message);
    return {
      code: 0,
      category: '其他',
      confidence: '40%',
      condition: '',
      description: '',
      note: '识别失败: ' + err.message
    };
  }
};
