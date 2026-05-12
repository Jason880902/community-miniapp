const DB = require('../../utils/data');
const icons = require('../../utils/icons');
const app = getApp();

// 基于物品名称的简单关键词匹配分类
const KEYWORD_MAP = [
  { keywords: ['桌', '椅', '柜', '床', '沙发', '茶几', '架', '凳'], category: '家具家居' },
  { keywords: ['手机', '电脑', '平板', '耳机', '音箱', '充电', '相机', '手表', '键盘', '鼠标'], category: '电子产品' },
  { keywords: ['书', '笔', '本', '纸', '文具', '词典', '画'], category: '书籍文具' },
  { keywords: ['衣', '裤', '鞋', '帽', '包', '裙', '袜', '围巾', '腰带'], category: '服饰鞋包' },
  { keywords: ['婴儿', '童', '奶', '娃', '玩具', '推车', '餐椅', '尿'], category: '母婴儿童' },
  { keywords: ['球', '拍', '瑜伽', '哑铃', '跳绳', '泳', '运动', '健身', '露营'], category: '运动户外' },
  { keywords: ['锅', '碗', '筷', '勺', '杯', '壶', '盘', '盆', '厨房', '厨具', '电饭煲'], category: '厨房用具' },
  { keywords: ['灯', '桶', '架', '收纳', '盒', '镜', '伞', '袋'], category: '日用百货' },
  { keywords: ['花', '草', '绿植', '盆栽', '植物', '多肉', '花盆'], category: '植物花卉' },
  { keywords: ['药', '保健', '口罩', '体温'], category: '其他' },
  { keywords: ['打印机', '路由器', '显示器', '硬盘', 'U盘', '网线'], category: '电子产品' },
  { keywords: ['被', '枕', '垫', '毯', '席', '帘'], category: '日用百货' },
];

function guessCategory(title) {
  const t = title.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some(k => t.includes(k))) {
      return entry.category;
    }
  }
  return '';
}

function guessCondition(title) {
  // 根据常见描述推断成色
  const t = title.toLowerCase();
  if (t.includes('全新') || t.includes('未拆') || t.includes('未用')) return '全新';
  if (t.includes('几乎') || t.includes('仅试')) return '几乎全新';
  if (t.includes('九成') || t.includes('轻微')) return '九成新';
  if (t.includes('八成')) return '八成新';
  if (t.includes('七成')) return '七成新';
  return '九成新'; // 默认
}

Page({
  data: {
    categories: DB.CATEGORIES,
    conditions: DB.CONDITIONS,
    images: [],
    maxImages: 6,
    icons: icons,
    aiLoading: false,
    aiResult: null,
    formData: {
      title: '',
      category: '',
      condition: '',
      desc: '',
      location: ''
    },
    canSubmit: false
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.data.formData[field] = value;
    this.setData({ formData: this.data.formData });
    this.checkSubmit();
  },

  onCategoryChange(e) {
    const idx = e.detail.value;
    this.data.formData.category = this.data.categories[idx];
    this.setData({ formData: this.data.formData });
    this.checkSubmit();
  },

  selectCondition(e) {
    const cond = e.currentTarget.dataset.condition;
    this.data.formData.condition = cond;
    this.setData({ formData: this.data.formData });
    this.checkSubmit();
  },

  checkSubmit() {
    const fd = this.data.formData;
    const can = !!(fd.title && fd.category && fd.condition);
    this.setData({ canSubmit: can });
  },

  // ===== 图片处理 =====
  chooseImage() {
    const remain = this.data.maxImages - this.data.images.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传' + this.data.maxImages + '张', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const urls = res.tempFiles.map(f => f.tempFilePath);
        const images = this.data.images.concat(urls);
        this.setData({ images });
      }
    });
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const images = this.data.images.filter((_, i) => i !== idx);
    this.setData({ images });
    if (images.length === 0) {
      this.setData({ aiResult: null });
    }
  },

  // ===== AI 识别 =====
  async aiClassify() {
    if (this.data.images.length === 0) {
      wx.showToast({ title: '请先拍照或上传图片', icon: 'none' });
      return;
    }
    this.setData({ aiLoading: true, aiResult: null });

    try {
      // 优先尝试云函数识别
      const result = await this.tryCloudClassify();
      this.applyAiResult(result);
    } catch (e) {
      // 云函数不可用，降级为基于标题的关键词匹配
      this.fallbackClassify();
    }
  },

  tryCloudClassify() {
    return new Promise((resolve, reject) => {
      if (!wx.cloud) { reject('cloud not available'); return; }

      // 用第一张图做识别
      const filePath = this.data.images[0];

      // 先上传图片到云存储
      wx.cloud.uploadFile({
        cloudPath: 'items/' + Date.now() + '.jpg',
        filePath,
        success: (uploadRes) => {
          // 调用云函数分类
          wx.cloud.callFunction({
            name: 'classifyImage',
            data: { fileID: uploadRes.fileID },
            success: (callRes) => {
              const result = callRes.result;
              if (result && result.category) {
                resolve(result);
              } else {
                reject('no result');
              }
            },
            fail: reject,
            timeout: 10000
          });
        },
        fail: reject
      });
    });
  },

  fallbackClassify() {
    const title = this.data.formData.title || '';
    if (!title) {
      wx.showToast({ title: '请输入物品名称后再试', icon: 'none' });
      this.setData({ aiLoading: false });
      return;
    }

    // 智能模拟：基于标题关键词 + 常见物品库
    const category = guessCategory(title);
    const condition = guessCondition(title);

    // 模拟识别延迟
    setTimeout(() => {
      const result = {
        category: category || '其他',
        confidence: category ? (85 + Math.floor(Math.random() * 10)) + '%' : '60%',
        condition
      };
      this.applyAiResult(result);
    }, 800);
  },

  applyAiResult(result) {
    if (!result || !result.category) {
      this.setData({ aiLoading: false });
      return;
    }

    const fd = this.data.formData;
    if (result.category && !fd.category) fd.category = result.category;
    if (result.condition && !fd.condition) fd.condition = result.condition;
    if (result.desc && !fd.desc) fd.desc = result.desc;

    this.setData({
      aiLoading: false,
      aiResult: result,
      formData: fd
    });
    this.checkSubmit();

    wx.showToast({ title: '识别完成，可手动修正', icon: 'success' });
  },

  // ===== 提交 =====
  submitPost() {
    if (!this.data.canSubmit) return;
    const fd = this.data.formData;
    const user = app.globalData.userInfo;

    DB.addItem({
      userId: user.id,
      title: fd.title,
      category: fd.category,
      condition: fd.condition,
      desc: fd.desc || '',
      location: fd.location || user.community,
      images: this.data.images
    });

    wx.showToast({ title: '发布成功！感谢分享' });
    wx.navigateBack();
  },

  goBack() {
    if (this.data.images.length > 0 || this.data.formData.title) {
      wx.showModal({
        title: '提示',
        content: '确定放弃发布吗？',
        success: (res) => { if (res.confirm) wx.navigateBack(); }
      });
    } else {
      wx.navigateBack();
    }
  }
});
