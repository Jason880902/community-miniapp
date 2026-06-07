const DB = require('./utils/data');

App({
  globalData: {
    userInfo: null,
    currentCommunity: '',
    isLogin: false,
    unreadCount: 0
  },

  async onLaunch() {
    wx.cloud.init({
      env: 'cloud1-d6ghwnr2odbc94c82',
      traceUser: true
    });
    const loggedIn = wx.getStorageSync('neighbor_logged_in');
    const cached = wx.getStorageSync('neighbor_user_cache');
    if (loggedIn && cached) {
      this.globalData.userInfo = cached;
      this.globalData.currentCommunity = cached.community;
      this.globalData.isLogin = true;
      // 轮询由首屏页面的 onShow 启动，不在 onLaunch 中调用避免云函数未就绪
    }
  },

  async wechatLogin(userId, nickName, community, avatarUrl, wechatId, phone) {
    const user = await DB.getOrCreateUser(userId, nickName, community, avatarUrl, wechatId, phone);
    wx.setStorageSync('neighbor_logged_in', true);
    wx.setStorageSync('neighbor_user_cache', user);

    this.globalData.userInfo = user;
    this.globalData.currentCommunity = community;
    this.globalData.isLogin = true;

    this.startUnreadPolling();
    return user;
  },

  logout() {
    wx.removeStorageSync('neighbor_logged_in');
    wx.removeStorageSync('neighbor_user_cache');
    this.globalData.userInfo = null;
    this.globalData.currentCommunity = '';
    this.globalData.isLogin = false;
    this.globalData.unreadCount = 0;
    this.stopUnreadPolling();
  },

  // ===== 全局未读消息轮询 =====
  startUnreadPolling() {
    this.stopUnreadPolling();
    this._pollUnread();
    this._unreadTimer = setInterval(() => this._pollUnread(), 30000);
  },

  stopUnreadPolling() {
    if (this._unreadTimer) {
      clearInterval(this._unreadTimer);
      this._unreadTimer = null;
    }
  },

  async _pollUnread() {
    if (!this.globalData.userInfo) return;
    try {
      const count = await DB.countUnread(this.globalData.userInfo.id);
      this.globalData.unreadCount = count;
    } catch (e) { /* 静默失败，下次轮询重试 */ }
  }
});
