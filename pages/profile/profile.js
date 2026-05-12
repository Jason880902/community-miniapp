const DB = require('../../utils/data');
const icons = require('../../utils/icons');
const app = getApp();

Page({
  data: {
    userName: '',
    icons: icons,
    userInitial: '',
    userAvatar: '',
    userCommunity: '',
    stats: { total: 0, shared: 0, active: 0 }
  },

  onShow() {
    const user = app.globalData.userInfo;
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({
      userName: user.name,
      userInitial: user.name.charAt(0),
      userAvatar: user.avatarUrl || '',
      userCommunity: user.community,
      stats: DB.getItemStats(user.id)
    });
  },

  goMyItems() {
    wx.showModal({
      title: '我的物品',
      content: `共发布了 ${this.data.stats.total} 件物品，其中已分享 ${this.data.stats.shared} 件`,
      showCancel: false
    });
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

  goMyMessages() {
    wx.redirectTo({ url: '/pages/messages/messages' });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要切换用户吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          wx.redirectTo({ url: '/pages/login/login' });
        }
      }
    });
  }
});
