const DB = require('../../utils/data');
const util = require('../../utils/util');
const icons = require('../../utils/icons');

Page({
  data: {
    conversations: [],
    icons: icons,
    unreadCount: 0
  },

  onShow() {
    this.loadConversations();
    this.updateUnread();
  },

  loadConversations() {
    const user = DB.getCurrentUser();
    if (!user) return;
    const convs = DB.getConversations(user.id);
    this.setData({
      conversations: convs.map(c => ({
        ...c,
        lastTime: util.formatTime(c.lastTime)
      }))
    });
  },

  updateUnread() {
    const user = DB.getCurrentUser();
    if (user) {
      this.setData({ unreadCount: DB.countUnread(user.id) });
    }
  },

  openChat(e) {
    const userId = e.currentTarget.dataset.userid;
    wx.navigateTo({ url: '/pages/chat/chat?userId=' + userId });
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
