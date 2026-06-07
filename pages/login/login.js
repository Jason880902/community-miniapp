const app = getApp();
const DB = require('../../utils/data');
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
    wechatId: '',
    phoneNumber: '',
    locating: false
  },

  onLoad() {
    if (app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/index/index' });
    }
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  showAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '邻里是一个社区旧物爱心分享平台。用户在使用本平台时，应遵守国家法律法规，不得发布违法信息。分享物品为免费赠送，平台不承担交易责任。如有争议，请友好协商解决。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  onGetUserInfo() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }
    this.setData({ authing: true });

    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: '用于展示您的昵称和头像',
        success: (res) => {
          const rawName = (res.userInfo.nickName || '').trim();
          const name = (!rawName || rawName === '微信用户') ? '邻居' : rawName;
          this.setData({ nickName: name, avatarUrl: res.userInfo.avatarUrl || '', authing: false });
          setTimeout(() => this.setData({ showCommunity: true }), 300);
        },
        fail: () => {
          this.setData({ nickName: '邻居', avatarUrl: '', authing: false });
          setTimeout(() => this.setData({ showCommunity: true }), 300);
        }
      });
    } else {
      this.setData({ nickName: '邻居', avatarUrl: '', authing: false });
      setTimeout(() => this.setData({ showCommunity: true }), 300);
    }
  },

  closeCommunity() {
    this.setData({ showCommunity: false, suggestions: [] });
  },

  autoLocate() {
    this.setData({ locating: true });
    wx.chooseLocation({
      success: (loc) => {
        this.setData({ community: loc.name || '', suggestions: [], locating: false });
      },
      fail: () => {
        this.setData({ locating: false, suggestions: DEFAULT_COMMUNITIES });
        wx.showToast({ title: '未选中位置，可搜索小区名', icon: 'none' });
      }
    });
    setTimeout(() => { if (this.data.locating) this.setData({ locating: false }); }, 8000);
  },

  onCommunityInput(e) {
    const val = e.detail.value;
    this.setData({ community: val });
    if (val.trim().length > 0) {
      this.setData({ suggestions: DEFAULT_COMMUNITIES.filter(c => c.includes(val.trim())) });
    } else {
      this.setData({ suggestions: [] });
    }
  },

  selectSuggest(e) {
    this.setData({ community: e.currentTarget.dataset.name, suggestions: [] });
  },

  onWechatInput(e) { this.setData({ wechatId: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phoneNumber: e.detail.value }); },

  async confirmCommunity() {
    const community = this.data.community.trim();
    if (!community) {
      wx.showToast({ title: '请选择或输入小区名称', icon: 'none' });
      return;
    }
    try {
      await app.wechatLogin('', this.data.nickName, community, this.data.avatarUrl, this.data.wechatId, this.data.phoneNumber);
      wx.redirectTo({ url: '/pages/index/index' });
    } catch (e) {
      wx.showToast({ title: '登录失败: ' + (e.message || e), icon: 'none' });
    }
  }
});
