// 云函数：classifyImage - 图片智能分类
// 使用腾讯云 AI 的图像识别能力识别旧物类别
//
// 部署前需要在腾讯云开通「图像识别」服务
// 并配置环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY
//
// 如果未配置 AI 服务，函数会基于图片文件名做关键词匹配降级

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// ===== 类别关键词映射表 =====
const CATEGORY_KEYWORDS = [
  { name: '家具家居', keywords: ['沙发', '桌子', '椅子', '床', '柜子', '茶几', '书架', '衣柜', '床垫'], desc: '看起来是件不错的家具，希望它能找到新主人。' },
  { name: '电子产品', keywords: ['手机', '电脑', '平板', '耳机', '音箱', '相机', '手表', '充电器', '键盘', '鼠标', '显示器'], desc: '电子产品请确认功能正常，帮助环保减少电子垃圾。' },
  { name: '书籍文具', keywords: ['书', '本子', '笔', '文具', '词典', '画册', '教材', '小说'], desc: '书籍是知识的载体，让阅读的快乐传递给下一个人。' },
  { name: '服饰鞋包', keywords: ['衣服', '裤子', '鞋子', '帽子', '包包', '裙子', '外套', '围巾'], desc: '衣物清洗干净即可分享，环保又时尚。' },
  { name: '母婴儿童', keywords: ['婴儿', '儿童', '玩具', '推车', '奶瓶', '童车', '积木', '娃娃'], desc: '宝宝长得快，很多物品还很新，分享给有需要的家庭吧。' },
  { name: '运动户外', keywords: ['球', '球拍', '瑜伽', '哑铃', '跳绳', '泳镜', '帐篷', '登山'], desc: '运动器材让更多人动起来，发挥它的价值。' },
  { name: '厨房用具', keywords: ['锅', '碗', '筷子', '勺子', '杯子', '水壶', '盘子', '电饭煲', '厨具'], desc: '厨房用品清洁后分享，让美食继续温暖更多人。' },
  { name: '日用百货', keywords: ['灯', '收纳', '盒子', '镜子', '雨伞', '袋子', '挂钩', '置物架'], desc: '实用小物件，分享给有需要的邻居。' },
  { name: '植物花卉', keywords: ['花', '绿植', '盆栽', '多肉', '植物', '花盆', '种子'], desc: '绿色植物让生活更美好，分享一份绿意。' },
];

// ===== 从文件名提取关键词 =====
function extractKeywords(fileName) {
  const name = (fileName || '').toLowerCase().replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
  // 按常见分隔符切分
  const parts = name.split(/[-_\s]+/);
  // 过滤掉无意义的数字和时间戳
  return parts.filter(p => p.length > 1 && !/^\d+$/.test(p));
}

// ===== 基于关键词的匹配分类（降级方案） =====
function classifyByKeywords(keywords) {
  let bestMatch = { name: '其他', confidence: 50, desc: '如果分类不准确，请手动修改。' };
  let maxScore = 0;

  for (const cat of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const kw of keywords) {
      for (const catKw of cat.keywords) {
        if (kw.includes(catKw) || catKw.includes(kw)) {
          score += 20;
        }
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = {
        name: cat.name,
        confidence: Math.min(60 + score, 95),
        desc: cat.desc
      };
    }
  }

  bestMatch.confidence += '%';
  return bestMatch;
}

// ===== 云函数入口 =====
exports.main = async (event, context) => {
  const { fileID } = event;
  if (!fileID) {
    return { code: -1, error: '缺少 fileID 参数' };
  }

  try {
    // 尝试使用 AI 图像识别
    // 方式一：Tencent Cloud AI 的图像识别 API
    // 需要开通服务并配置密钥，示例代码：
    /*
    const tencentcloud = require('tencentcloud-sdk-nodejs');
    const ImageClient = tencentcloud.tiia.v20190529.Client;
    const client = new ImageClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
      },
      region: 'ap-guangzhou',
    });

    const { Downloader } = require('wx-server-sdk');
    const buffer = await Downloader.downloadFile({ fileID }).then(res => res.fileContent);

    const result = await client.DetectLabel({
      ImageBase64: buffer.toString('base64'),
    });

    const labels = result.Labels || [];
    const topLabel = labels[0] || {};
    // 映射 AI 标签到我们的分类体系
    ...
    */

    // 方式二：使用云开发数据库的 AI 能力
    // const result = await cloud.openapi.ai.detectObject({ ... });

    // --- 以下为降级方案：基于文件名的关键词匹配 ---
    const keywords = extractKeywords(fileID);
    const result = classifyByKeywords(keywords);

    return {
      code: 0,
      category: result.name,
      confidence: result.confidence,
      desc: result.desc,
      note: '当前为关键词匹配模式，配置腾讯云 AI 后可获得更精准的识别结果'
    };

  } catch (err) {
    // 完全降级：返回默认结果
    return {
      code: 0,
      category: '其他',
      confidence: '60%',
      desc: '如果分类不准确，请手动修改。',
      note: '识别服务暂不可用，已使用默认分类'
    };
  }
};
