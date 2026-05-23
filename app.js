const DB = require('./utils/data');

App({
  globalData: {
    userInfo: null,
    currentCommunity: '',
    isLogin: false
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
    }
  },

  async wechatLogin(userId, nickName, community, avatarUrl) {
    // 从云端创建/获取用户
    const user = await DB.getOrCreateUser(userId, nickName, community, avatarUrl);
    // 缓存到本地
    wx.setStorageSync('neighbor_logged_in', true);
    wx.setStorageSync('neighbor_user_cache', user);

    this.globalData.userInfo = user;
    this.globalData.currentCommunity = community;
    this.globalData.isLogin = true;

    return user;
  },

  logout() {
    wx.removeStorageSync('neighbor_logged_in');
    wx.removeStorageSync('neighbor_user_cache');
    this.globalData.userInfo = null;
    this.globalData.currentCommunity = '';
    this.globalData.isLogin = false;
  }
});
