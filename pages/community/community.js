const DB = require('../../utils/data');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const app = getApp();

Page({
  data: {
    communityName: '',
    userInitial: '',
    members: [],
    icons,
    memberCount: 0,
    itemCount: 0,
    statusBarHeight: util.getSafeArea().statusBarHeight
  },

  async onShow() {
    if (!app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    await this.loadCommunity();
  },

  async loadCommunity() {
    const user = app.globalData.userInfo;
    if (!user) return;
    // 从云端刷新用户数据，确保小区最新
    let currentUser = user;
    try {
      const freshUser = await DB.getCurrentUser(user.id);
      if (freshUser && freshUser.community) {
        currentUser = freshUser;
        app.globalData.userInfo = freshUser;
        wx.setStorageSync('neighbor_user_cache', freshUser);
      }
    } catch (e) { /* 用缓存继续 */ }

    const name = currentUser.community;
    const allUsers = await DB.getAllUsers();
    const members = allUsers.filter(u => u.community === name);
    const items = await DB.getAllItems();
    const availableItems = items.filter(i => i.status === 'available');
    const communityItems = availableItems.filter(i => members.some(m => m.id === i.userId));

    this.setData({
      communityName: name,
      userInitial: currentUser.name.charAt(0),
      members,
      memberCount: members.length,
      itemCount: communityItems.length
    });
  },

  goHome() {
    wx.redirectTo({ url: '/pages/index/index' });
  },

  goPost() {
    wx.navigateTo({ url: '/pages/post/post' });
  },

  goMessages() {
    wx.redirectTo({ url: '/pages/messages/messages' });
  },

  goProfile() {
    wx.redirectTo({ url: '/pages/profile/profile' });
  }
});
