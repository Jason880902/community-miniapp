const DB = require('../../utils/data');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const app = getApp();

Page({
  data: {
    conversations: [],
    icons: icons,
    unreadCount: 0
  },

  async onShow() {
    await this.loadConversations();
    await this.updateUnread();
  },

  async loadConversations() {
    const user = app.globalData.userInfo;
    if (!user) return;
    const convs = await DB.getConversations(user.id);
    this.setData({
      conversations: convs.map(c => ({
        ...c,
        lastTime: util.formatTime(c.lastTime)
      }))
    });
  },

  async updateUnread() {
    const user = app.globalData.userInfo;
    if (user) {
      const count = await DB.countUnread(user.id);
      this.setData({ unreadCount: count });
    }
  },

  openChat(e) {
    const userId = e.currentTarget.dataset.userid;
    const itemId = e.currentTarget.dataset.itemid || '';
    wx.navigateTo({ url: `/pages/chat/chat?userId=${userId}&itemId=${itemId}` });
  },

  goHome() {
    wx.redirectTo({ url: '/pages/index/index' });
  },

  goCommunity() {
    wx.redirectTo({ url: '/pages/community/community' });
  },

  goPost() {
    wx.navigateTo({ url: '/pages/post/post' });
  },

  goProfile() {
    wx.redirectTo({ url: '/pages/profile/profile' });
  }
});
