const app = getApp();
const icons = require('../../utils/icons');

const DEFAULT_COMMUNITIES = ['阳光花园小区', '翠湖名苑', '紫金家园', '碧水湾花园', '翰林苑', '龙湖花千树', '万科城市花园'];

Page({
  data: {
    icons,
    nickName: '',
    avatarUrl: '',
    authing: false,
    agreed: false,
    showCommunity: false,
    community: '',
    suggestions: [],
    locating: false
  },

  onLoad() {
    if (app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/index/index' });
    }
  },

  // 勾选/取消用户协议
  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  // 查看用户协议
  showAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '邻里是一个社区旧物爱心分享平台。用户在使用本平台时，应遵守国家法律法规，不得发布违法信息。分享物品为免费赠送，平台不承担交易责任。如有争议，请友好协商解决。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // ===== Step 1: 获取用户信息 =====
  onGetUserInfo() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }
    this.setData({ authing: true });

    // 优先用 wx.getUserProfile（新版 WeChat API）
    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: '用于展示您的昵称和头像',
        success: (res) => {
          const rawName = (res.userInfo.nickName || '').trim();
          const name = (!rawName || rawName === '微信用户') ? '邻居' : rawName;
          this.setData({
            nickName: name,
            avatarUrl: res.userInfo.avatarUrl || '',
            authing: false
          });
          setTimeout(() => this.setData({ showCommunity: true }), 300);
        },
        fail: () => {
          this.setData({ authing: false });
          this.showManualInput();
        }
      });
    } else {
      this.showManualInput();
    }
  },

  // 手动输入昵称（备用）
  showManualInput() {
    this.setData({
      nickName: '邻居',
      avatarUrl: '',
      authing: false
    });
    setTimeout(() => this.setData({ showCommunity: true }), 300);
  },

  // ===== Step 2: 小区选择弹窗 =====
  closeCommunity() {
    this.setData({ showCommunity: false, suggestions: [] });
  },

  // 定位当前小区
  autoLocate() {
    this.setData({ locating: true });

    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        wx.chooseLocation({
          success: (loc) => {
            const name = loc.name || '';
            this.setData({
              community: name,
              suggestions: [],
              locating: false
            });
          },
          fail: () => {
            this.setData({ locating: false, suggestions: DEFAULT_COMMUNITIES });
            wx.showToast({ title: '未选中小区，可搜索', icon: 'none' });
          }
        });
      },
      fail: () => {
        this.setData({ locating: false, suggestions: DEFAULT_COMMUNITIES });
        wx.showToast({ title: '定位失败，请搜索小区名', icon: 'none' });
      }
    });

    // 超时保护
    setTimeout(() => {
      if (this.data.locating) this.setData({ locating: false });
    }, 8000);
  },

  // 从地图选择
  chooseFromMap() {
    wx.chooseLocation({
      success: (loc) => {
        this.setData({ community: loc.name || '', suggestions: [] });
      },
      fail: () => {
        wx.showToast({ title: '未选择位置', icon: 'none' });
      }
    });
  },

  // 搜索小区
  onCommunityInput(e) {
    const val = e.detail.value;
    this.setData({ community: val });

    if (val.trim().length > 0) {
      const matched = DEFAULT_COMMUNITIES.filter(c => c.includes(val.trim()));
      this.setData({ suggestions: matched });
    } else {
      this.setData({ suggestions: [] });
    }
  },

  selectSuggest(e) {
    this.setData({
      community: e.currentTarget.dataset.name,
      suggestions: []
    });
  },

  // 确认小区，完成登录
  async confirmCommunity() {
    const community = this.data.community.trim();
    if (!community) {
      wx.showToast({ title: '请选择或输入小区名称', icon: 'none' });
      return;
    }
    if (!this.data.nickName) {
      wx.showToast({ title: '请先微信授权', icon: 'none' });
      return;
    }

    try {
      await app.wechatLogin('', this.data.nickName, community, this.data.avatarUrl);
      wx.redirectTo({ url: '/pages/index/index' });
    } catch (e) {
      wx.showToast({ title: '登录失败: ' + (e.message || e), icon: 'none' });
    }
  }
});
