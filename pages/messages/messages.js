const DB = require('../../utils/data');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const app = getApp();

Page({
  data: {
    conversations: [],
    icons: icons,
    unreadCount: 0,
    community: '',
    userInitial: '',
    statusBarHeight: util.getSafeArea().statusBarHeight
  },

  async onShow() {
    const user = app.globalData.userInfo;
    if (!user) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ community: user.community, userInitial: user.name.charAt(0) });
    await this.loadConversations();
    await this.updateUnread();
    this._startUnreadTimer();
  },

  onHide() {
    this._stopUnreadTimer();
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
      app.globalData.unreadCount = count;
      this.setData({ unreadCount: count });
    }
  },

  _startUnreadTimer() {
    this._stopUnreadTimer();
    this._unreadTimer = setInterval(() => this.updateUnread(), 30000);
  },

  _stopUnreadTimer() {
    if (this._unreadTimer) {
      clearInterval(this._unreadTimer);
      this._unreadTimer = null;
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
