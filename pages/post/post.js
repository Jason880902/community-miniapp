const DB = require('../../utils/data');
const icons = require('../../utils/icons');
const app = getApp();

// 描述统一格式
const DESC_TEMPLATE = (title, condition) => `${title}，${condition}，希望它能找到新主人，继续发挥价值。`;

Page({
  data: {
    categories: DB.CATEGORIES,
    conditions: DB.CONDITIONS,
    images: [],
    existingImages: [],
    maxImages: 6,
    icons: icons,
    aiLoading: false,
    aiResult: null,
    descGenerating: false,
    aiAutoFilled: {},
    activeCondition: '',
    editItemId: null,
    isEdit: false,
    coverIndex: 0,
    formData: {
      title: '',
      category: '',
      condition: '',
      desc: '',
      location: ''
    },
    canSubmit: false
  },

  async onLoad(options) {
    if (options.edit) {
      this.setData({ editItemId: options.edit, isEdit: true });
      await this.loadItemForEdit(options.edit);
    }
  },

  async loadItemForEdit(itemId) {
    const item = await DB.getItemById(itemId);
    if (!item) { wx.showToast({ title: '物品不存在', icon: 'none' }); return; }
    const imgs = item.images || [];
    this.setData({
      formData: {
        title: item.title || '',
        category: item.category || '',
        condition: item.condition || '',
        desc: item.desc || '',
        location: item.location || ''
      },
      activeCondition: item.condition || '',
      images: imgs,
      existingImages: imgs,
      coverIndex: item.coverIndex || 0
    });
    this.checkSubmit();
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.data.formData[field] = value;
    const autoFilled = this.data.aiAutoFilled;
    delete autoFilled[field];
    this.setData({
      formData: { ...this.data.formData },
      aiAutoFilled: autoFilled
    });
    this.checkSubmit();
    if (field === 'title' && value && this.data.aiResult && this.data.aiResult.category) {
      this.generateDescription();
    }
  },

  onCategoryChange(e) {
    const idx = e.detail.value;
    this.data.formData.category = this.data.categories[idx];
    const autoFilled = this.data.aiAutoFilled;
    delete autoFilled.category;
    this.setData({
      formData: { ...this.data.formData },
      aiAutoFilled: autoFilled
    });
    this.checkSubmit();
  },

  selectCondition(e) {
    const cond = e.currentTarget.dataset.condition;
    this.data.formData.condition = cond;
    const autoFilled = this.data.aiAutoFilled;
    delete autoFilled.condition;
    this.setData({
      activeCondition: cond,
      formData: { ...this.data.formData },
      aiAutoFilled: autoFilled
    });
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

        // 上传首张图后自动触发 AI 识别（编辑模式不触发）
        if (images.length > 0 && !this.data.aiResult && !this.data.isEdit) {
          this.aiClassify();
        }
      }
    });
  },

  setCover(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ coverIndex: idx });
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const removed = this.data.images[idx];
    const images = this.data.images.filter((_, i) => i !== idx);
    // 移除的如果是已有云图片，同时清理 existingImages
    const existingImages = this.data.existingImages.filter(url => url !== removed);
    // 封面索引调整
    let coverIndex = this.data.coverIndex;
    if (idx < coverIndex) coverIndex--;
    else if (idx === coverIndex && idx >= images.length) coverIndex = Math.max(0, images.length - 1);
    this.setData({ images, existingImages, coverIndex });
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
      const result = await this.tryCloudClassify();
      this.applyAiResult(result);
    } catch (e) {
      this.fallbackClassify();
    }
  },

  // 手动触发 AI 识别（填完标题后重试）
  retryAiClassify() {
    if (!this.data.formData.title) {
      wx.showToast({ title: '先填物品标题，识别更准', icon: 'none' });
      return;
    }
    this.aiClassify();
  },

  tryCloudClassify() {
    return new Promise((resolve, reject) => {
      if (!wx.cloud) { reject('cloud not available'); return; }

      const filePath = this.data.images[0];
      // 缓存已上传的 fileID，避免重复上传
      if (this._uploadedFileID && this._uploadedPath === filePath) {
        this._callClassifyFunction(this._uploadedFileID, resolve, reject);
        return;
      }

      // 已有云 fileID 直接使用，无需上传
      if (typeof filePath === 'string' && filePath.startsWith('cloud://')) {
        this._uploadedFileID = filePath;
        this._uploadedPath = filePath;
        this._callClassifyFunction(filePath, resolve, reject);
        return;
      }

      wx.cloud.uploadFile({
        cloudPath: 'items/' + Date.now() + '.jpg',
        filePath,
        success: (uploadRes) => {
          this._uploadedFileID = uploadRes.fileID;
          this._uploadedPath = filePath;
          this._callClassifyFunction(uploadRes.fileID, resolve, reject);
        },
        fail: reject
      });
    });
  },

  _callClassifyFunction(fileID, resolve, reject) {
    wx.cloud.callFunction({
      name: 'classifyImage',
      data: {
        fileID,
        title: this.data.formData.title || ''
      },
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

  fallbackClassify() {
    const title = this.data.formData.title;
    const category = this.guessCategory(title);
    const condition = this.guessCondition(title);

    setTimeout(() => {
      if (title) {
        const result = {
          category: category || '其他',
          confidence: category ? (85 + Math.floor(Math.random() * 10)) + '%' : '50%',
          condition
        };
        this.applyAiResult(result);
      } else {
        // 无标题 → 给默认"其他"，让用户填完标题后重试
        const result = {
          category: '其他',
          confidence: '40%',
          condition: '',
          note: '填完标题后点"重试识别"更准确'
        };
        this.applyAiResult(result);
      }
    }, 600);
  },

  applyAiResult(result) {
    if (!result || !result.category) {
      this.setData({ aiLoading: false, aiResult: result || null });
      if (result && result.note) {
        wx.showToast({ title: result.note, icon: 'none' });
      }
      return;
    }

    const fd = this.data.formData;
    const autoFilled = { ...this.data.aiAutoFilled };
    const prevCategory = fd.category;

    if (result.category) {
      if (!prevCategory || autoFilled.category) {
        fd.category = result.category;
        autoFilled.category = true;
      }
    }
    // AI 建议标题（仅首次且用户未填时自动填入）
    if (result.suggestedTitle && !fd.title) {
      fd.title = result.suggestedTitle;
      autoFilled.title = true;
    }
    // 成色：AI 返回的或默认"几乎全新"
    const condition = result.condition || '几乎全新';
    if (!fd.condition || autoFilled.condition) {
      fd.condition = condition;
      autoFilled.condition = true;
    }
    // AI 描述（仅用户未手动填时）
    if (result.description && !fd.desc) {
      fd.desc = result.description;
      autoFilled.desc = true;
    }

    this.setData({
      aiLoading: false,
      aiResult: result,
      activeCondition: fd.condition,
      formData: {
        title: fd.title,
        category: fd.category,
        condition: fd.condition,
        desc: fd.desc,
        location: fd.location
      },
      aiAutoFilled: autoFilled
    });
    this.checkSubmit();

    // 有标题时生成更准确的描述
    if (fd.title && fd.category) {
      this.generateDescription();
    } else if (!fd.desc) {
      wx.showToast({ title: 'AI 识别完成，请补充信息', icon: 'success' });
    }
  },

  // ===== 智能描述生成 =====
  generateDescription() {
    const fd = this.data.formData;
    if (!fd.title || !fd.category) return;

    this.setData({ descGenerating: true });

    setTimeout(() => {
      const condText = fd.condition || '几乎全新';
      fd.desc = DESC_TEMPLATE(fd.title, condText);
      const autoFilled = this.data.aiAutoFilled;
      autoFilled.desc = true;

      this.setData({
        descGenerating: false,
        formData: {
          title: fd.title,
          category: fd.category,
          condition: fd.condition,
          desc: fd.desc,
          location: fd.location
        },
        aiAutoFilled: autoFilled
      });
      this.checkSubmit();

      wx.showToast({ title: 'AI 已生成描述，可编辑修改', icon: 'success' });
    }, 400);
  },

  // 手动触发/重新生成描述
  regenerateDesc() {
    // 清除现有描述再生成
    const fd = this.data.formData;
    fd.desc = '';
    this.setData({ formData: fd });
    this.generateDescription();
  },

  // ===== 客户端关键词匹配（降级用） =====
  KEYWORD_MAP: [
    { keywords: ['桌', '椅', '柜', '床', '沙发', '茶几', '架', '凳', '榻', '屏', '妆台'], category: '家具家居' },
    { keywords: ['手机', '电脑', '平板', '耳机', '音箱', '充电', '相机', '手表', '键盘', '鼠标', '打印', '路由', '硬盘', 'U盘', '蓝牙', '投影', '游戏机', 'switch'], category: '电子产品' },
    { keywords: ['书', '笔', '本', '纸', '文具', '词典', '画', '杂志', '漫画', '教材', '小说'], category: '书籍文具' },
    { keywords: ['衣', '裤', '鞋', '帽', '包', '裙', '袜', '围巾', '腰带', '衬衫', 'T恤', '卫衣', '羽绒', '风衣'], category: '服饰鞋包' },
    { keywords: ['婴儿', '童', '奶', '娃', '玩具', '推车', '餐椅', '尿', '早教', '积木', '乐高', '摇铃'], category: '母婴儿童' },
    { keywords: ['球', '拍', '瑜伽', '哑铃', '跳绳', '泳', '运动', '健身', '露营', '帐篷', '滑板', '单车'], category: '运动户外' },
    { keywords: ['锅', '碗', '筷', '勺', '杯', '壶', '盘', '盆', '厨房', '厨具', '电饭煲', '烤箱', '微波炉', '刀具', '餐具', '茶具'], category: '厨房用具' },
    { keywords: ['灯', '桶', '收纳', '盒', '镜', '伞', '袋', '挂钩', '衣架', '窗帘', '地毯', '抱枕', '摆件', '钟表'], category: '日用百货' },
    { keywords: ['花', '草', '绿植', '盆栽', '植物', '多肉', '花盆', '花瓶', '种子'], category: '植物花卉' },
    { keywords: ['药', '保健', '口罩', '体温', '乐器', '吉他', '钢琴', '琴', '宠物', '猫', '狗', '鱼缸'], category: '其他' }
  ],

  guessCategory(title) {
    if (!title) return '';
    const t = title.toLowerCase();
    for (const entry of this.KEYWORD_MAP) {
      if (entry.keywords.some(k => t.includes(k))) {
        return entry.category;
      }
    }
    // 二次匹配：按字
    const charMap = [
      { chars: ['桌', '椅', '柜', '床', '沙'], category: '家具家居' },
      { chars: ['机', '脑', '耳', '芯'], category: '电子产品' },
      { chars: ['书', '笔', '本', '纸', '画'], category: '书籍文具' },
      { chars: ['衣', '裤', '鞋', '帽', '包'], category: '服饰鞋包' },
      { chars: ['娃', '童', '奶', '玩'], category: '母婴儿童' },
    ];
    for (const entry of charMap) {
      if (entry.chars.some(c => t.includes(c))) {
        return entry.category;
      }
    }
    return '';
  },

  guessCondition(title) {
    if (!title) return '';
    const t = title.toLowerCase();
    if (t.includes('全新') || t.includes('未拆') || t.includes('未用') || t.includes('未开封')) return '全新';
    if (t.includes('几乎') || t.includes('仅试') || t.includes('仅用')) return '几乎全新';
    if (t.includes('九成') || t.includes('轻微')) return '九成新';
    if (t.includes('八成')) return '八成新';
    if (t.includes('七成')) return '七成新';
    if (t.includes('瑕疵') || t.includes('破损') || t.includes('坏了')) return '有瑕疵';
    return '';
  },

  // ===== 提交 =====
  async submitPost() {
    if (!this.data.canSubmit) return;
    const fd = this.data.formData;
    const user = app.globalData.userInfo;
    const { isEdit, editItemId, images, existingImages } = this.data;

    wx.showLoading({ title: isEdit ? '保存中...' : '发布中...' });

    // 只上传新图片（不在 existingImages 中的本地路径）
    const newIds = [];
    for (const img of images) {
      if (existingImages.includes(img)) continue; // 已有云图片，跳过
      try {
        const res = await wx.cloud.uploadFile({
          cloudPath: 'items/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg',
          filePath: img,
        });
        newIds.push(res.fileID);
      } catch (e) {
        console.error('图片上传失败:', e);
      }
    }
    const allImages = [...existingImages, ...newIds];

    const community = user.community || '';
    const coverIndex = this.data.coverIndex;
    if (isEdit) {
      await DB.updateItem(editItemId, {
        title: fd.title,
        category: fd.category,
        condition: fd.condition,
        desc: fd.desc || '',
        location: fd.location || community,
        images: allImages,
        community,
        coverIndex,
        status: 'available' // 编辑后自动重新发布
      });
      wx.hideLoading();
      wx.showToast({ title: '已更新并重新发布' });
    } else {
      await DB.addItem({
        userId: user.id,
        community,
        coverIndex,
        title: fd.title,
        category: fd.category,
        condition: fd.condition,
        desc: fd.desc || '',
        location: fd.location || community,
        images: allImages
      });
      wx.hideLoading();
      wx.showToast({ title: '发布成功！感谢分享' });
    }
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
