const DB = require('../../utils/data');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const app = getApp();

const CONDITION_COLORS = {
  '全新': { bg: '#ECFDF5', text: '#10B981' },
  '几乎全新': { bg: '#ECFDF5', text: '#10B981' },
  '九成新': { bg: '#FFF7ED', text: '#F97316' },
  '八成新': { bg: '#FFF7ED', text: '#F97316' },
  '七成新': { bg: '#FEF2F2', text: '#EF4444' },
  '有瑕疵': { bg: '#FEF2F2', text: '#EF4444' },
};

Page({
  data: {
    community: '',
    userInitial: '',
    icons: icons,
    categories: DB.CATEGORIES,
    selectedCat: 'all',
    items: [],
    searchQuery: '',
    unreadCount: 0,
    loading: true,
    statusBarHeight: util.getSafeArea().statusBarHeight
  },

  async onShow() {
    if (!app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    const cachedUser = app.globalData.userInfo;
    let user = cachedUser;
    try {
      const freshUser = await DB.getCurrentUser(cachedUser.id);
      if (freshUser && freshUser.community) {
        user = freshUser;
        app.globalData.userInfo = freshUser;
        app.globalData.currentCommunity = freshUser.community;
        wx.setStorageSync('neighbor_user_cache', freshUser);
      }
    } catch (e) { console.warn('[index] 刷新用户失败:', e.message); }

    this.setData({
      community: user.community,
      userInitial: user.name.charAt(0)
    });
    try { await this.loadItems(); } catch (e) { console.warn('[index] loadItems error:', e); this.setData({ loading: false }); }
    try { await this.updateUnread(); } catch (e) { console.warn('[index] updateUnread error:', e); }
    this._startUnreadTimer();
  },

  onHide() {
    this._stopUnreadTimer();
  },

  async loadItems() {
    this.setData({ loading: true });
    const items = await DB.getAvailableItems(this.data.selectedCat, this.data.community);
    const query = this.data.searchQuery.trim().toLowerCase();
    let filtered = items;
    if (query) {
      filtered = items.filter(i => i.title.toLowerCase().includes(query));
    }
    const allUsers = await DB.getAllUsers();
    const userMap = {};
    allUsers.forEach(u => { userMap[u.userId] = u; });

    this.setData({
      items: filtered.map(i => ({
        ...i,
        catColor: util.getCategoryColor(i.category),
        conditionColor: CONDITION_COLORS[i.condition] || { bg: '#F3F4F6', text: '#6B7280' },
        ownerName: userMap[i.userId] ? userMap[i.userId].name : '邻居',
        time: util.formatTime(i.createTime)
      })),
      loading: false
    });
  },

  async filterCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ selectedCat: cat });
    await this.loadItems();
  },

  async onSearch(e) {
    this.setData({ searchQuery: e.detail.value });
    await this.loadItems();
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  goPost() {
    wx.navigateTo({ url: '/pages/post/post' });
  },

  goCommunity() {
    wx.redirectTo({ url: '/pages/community/community' });
  },

  goMessages() {
    wx.redirectTo({ url: '/pages/messages/messages' });
  },

  goProfile() {
    wx.redirectTo({ url: '/pages/profile/profile' });
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
  }
});
