const DB = require('./utils/data');
const util = require('./utils/util');

App({
  globalData: {
    userInfo: null,
    currentCommunity: '',
    isLogin: false
  },

  onLaunch() {
    const userInfo = DB.getCurrentUser();
    const loggedIn = wx.getStorageSync('neighbor_logged_in');
    if (userInfo && loggedIn) {
      this.globalData.userInfo = userInfo;
      this.globalData.currentCommunity = userInfo.community;
      this.globalData.isLogin = true;
    }
  },

  // 微信登录：nickName 来自微信授权，community 来自用户选择
  wechatLogin(nickName, community, avatarUrl) {
    const user = DB.getOrCreateUser(nickName, community, avatarUrl);
    DB.setCurrentUser(user.id);
    wx.setStorageSync('neighbor_logged_in', true);

    this.globalData.userInfo = user;
    this.globalData.currentCommunity = community;
    this.globalData.isLogin = true;

    return user;
  },

  logout() {
    wx.removeStorageSync('neighbor_logged_in');
    this.globalData.userInfo = null;
    this.globalData.currentCommunity = '';
    this.globalData.isLogin = false;
  }
});
