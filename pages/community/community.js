const DB = require('../../utils/data');
const icons = require('../../utils/icons');
const app = getApp();

Page({
  data: {
    communityName: '',
    members: [],
    icons,
    memberCount: 0,
    itemCount: 0
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
    const name = user.community;
    const allUsers = await DB.getAllUsers();
    const members = allUsers.filter(u => u.community === name);
    const items = await DB.getAllItems();
    const availableItems = items.filter(i => i.status === 'available');
    const communityItems = availableItems.filter(i => members.some(m => m.id === i.userId));

    this.setData({
      communityName: name,
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
