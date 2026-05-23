const DB = require('../../utils/data');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const app = getApp();

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
    firstLoad: true,
    loading: true,
    indicatorLeft: 0,
    indicatorWidth: 0,
    columnMode: 'single'
  },

  async onShow() {
    if (!app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    const user = app.globalData.userInfo;
    this.setData({
      community: user.community,
      userInitial: user.name.charAt(0)
    });
    await this.loadItems();
    this.updateUnread();
    this.calcIndicator('all', 0);
  },

  async loadItems() {
    this.setData({ loading: true });
    const user = app.globalData.userInfo;
    const items = await DB.getAvailableItems(this.data.selectedCat, user?.community);
    const query = this.data.searchQuery.trim().toLowerCase();
    let filtered = items;
    if (query) {
      filtered = items.filter(i => i.title.toLowerCase().includes(query));
    }
    // 批量查用户
    const allUsers = await DB.getAllUsers();
    const userMap = {};
    allUsers.forEach(u => { userMap[u.userId] = u; });

    this.setData({
      items: filtered.map(i => ({
        ...i,
        catColor: util.getCategoryColor(i.category),
        ownerName: userMap[i.userId] ? userMap[i.userId].name : '邻居',
        time: util.formatTime(i.createTime)
      })),
      loading: false
    });
  },

  async filterCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({
      selectedCat: cat,
      firstLoad: false
    });
    await this.loadItems();
    this.calcIndicator(cat, 0);
  },

  calcIndicator(cat, fallbackIndex) {
    const query = wx.createSelectorQuery();
    query.selectAll('.category-item').boundingClientRect((rects) => {
      if (!rects || rects.length === 0) return;
      const catList = ['all'].concat(this.data.categories);
      const idx = catList.indexOf(cat);
      if (idx < 0) return;
      const target = rects[idx];
      const first = rects[0];
      this.setData({
        indicatorLeft: target.left - first.left,
        indicatorWidth: target.width
      });
    }).exec();
  },

  onPageScroll(e) {
    // 保留 scroll 事件占位，后续可用于加载更多
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

  toggleColumn(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ columnMode: mode });
  },

  onScrollMore() {
    // 已加载全部，无需分页
  },

  async updateUnread() {
    const user = app.globalData.userInfo;
    if (user) {
      const count = await DB.countUnread(user.id);
      this.setData({ unreadCount: count });
    }
  }
});
