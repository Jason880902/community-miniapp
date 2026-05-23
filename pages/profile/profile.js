const DB = require('../../utils/data');
const icons = require('../../utils/icons');
const app = getApp();

const util = require('../../utils/util');

Page({
  data: {
    userName: '',
    icons: icons,
    userInitial: '',
    userAvatar: '',
    userCommunity: '',
    stats: { total: 0, shared: 0, active: 0 },
    showItems: false,
    myItems: [],
    showRequests: false,
    myRequests: []
  },

  async onShow() {
    const user = app.globalData.userInfo;
    if (!user) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    const stats = await DB.getItemStats(user.id);
    this.setData({
      userName: user.name,
      userInitial: user.name.charAt(0),
      userAvatar: user.avatarUrl || '',
      userCommunity: user.community,
      stats
    });
    // 返回时自动刷新物品列表数据
    await this.fetchMyItems();
  },

  async fetchMyItems() {
    const user = app.globalData.userInfo;
    if (!user) return;
    const items = (await DB.getItemsByUser(user.id)).map(i => ({
      ...i,
      catColor: util.getCategoryColor(i.category),
      time: util.formatTime(i.createTime)
    }));
    this.setData({ myItems: items });
  },

  async goMyItems() {
    const user = app.globalData.userInfo;
    if (!user) return;
    if (this.data.showItems) {
      this.setData({ showItems: false });
      return;
    }
    await this.fetchMyItems();
    this.setData({ showItems: true });
  },

  async goMyRequests() {
    const user = app.globalData.userInfo;
    if (!user) return;
    if (this.data.showRequests) {
      this.setData({ showRequests: false });
      return;
    }
    const requests = await DB.getUserRequests(user.id);
    const enriched = await Promise.all(requests.map(async (req) => {
      const item = await DB.getItemById(req.itemId);
      return {
        ...req,
        time: util.formatTime(req.createTime),
        itemImage: item && item.images && item.images.length > 0 ? item.images[item.coverIndex || 0] : '',
        itemTitle: item ? item.title : '',
        itemCategory: item ? item.category : ''
      };
    }));
    this.setData({ myRequests: enriched, showRequests: true });
  },

  markItemClaimed(e) {
    const itemId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认',
      content: '标记为已被领取？',
      success: async (res) => {
        if (!res.confirm) return;
        await DB.updateItemStatus(itemId, 'claimed');
        wx.showToast({ title: '已标记' });
        await this.goMyItems();
      }
    });
  },

  unlistItem(e) {
    const itemId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '下架物品',
      content: '下架后物品将不再公开展示，可编辑后重新发布',
      success: async (res) => {
        if (!res.confirm) return;
        await DB.updateItemStatus(itemId, 'inactive');
        wx.showToast({ title: '已下架' });
        await this.goMyItems();
      }
    });
  },

  editItem(e) {
    const itemId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/post/post?edit=' + itemId });
  },

  republishItem(e) {
    const itemId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '重新发布',
      content: '确定重新发布这件物品吗？',
      success: async (res) => {
        if (!res.confirm) return;
        await DB.updateItemStatus(itemId, 'available');
        wx.showToast({ title: '已重新发布' });
        await this.goMyItems();
      }
    });
  },

  // 编辑昵称
  editName() {
    const user = app.globalData.userInfo;
    if (!user) return;
    wx.showModal({
      title: '修改昵称',
      content: '请输入新昵称',
      editable: true,
      success: async (res) => {
        if (res.confirm && res.content.trim() && res.content.trim() !== user.name) {
          const newName = res.content.trim();
          const result = await DB.updateUserName(user.id, newName);
          if (!result.success) {
            if (result.reason === 'duplicate') {
              wx.showToast({ title: '该昵称已被使用', icon: 'none' });
            } else {
              wx.showToast({ title: '修改失败', icon: 'none' });
            }
            return;
          }
          user.name = newName;
          wx.setStorageSync('neighbor_user_cache', user);
          app.globalData.userInfo = user;
          this.setData({
            userName: newName,
            userInitial: newName.charAt(0)
          });
          wx.showToast({ title: '已更新' });
        }
      }
    });
  },

  goHome() {
    wx.redirectTo({ url: '/pages/index/index' });
  },

  goItemDetail(e) {
    const itemId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + itemId });
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
