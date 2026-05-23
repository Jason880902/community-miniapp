const DB = require('../../utils/data');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    activeTab: 0,
    stats: {},
    catList: [],
    users: [],
    searchUser: '',
    items: [],
    searchItem: '',
    requests: []
  },

  onLoad() {
    this.loadStats();
  },

  // ===== Tab 切换 =====
  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    this.setData({ activeTab: tab });
    if (tab === 0) this.loadStats();
    else if (tab === 1) this.loadUsers();
    else if (tab === 2) this.loadItems();
    else if (tab === 3) this.loadRequests();
  },

  // ===== 仪表盘 =====
  async loadStats() {
    try {
      const stats = await DB.getAdminStats();
      const catList = Object.entries(stats.catCount || {})
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      this.setData({ stats, catList });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ===== 用户管理 =====
  async loadUsers() {
    try {
      const users = await DB.adminGetAllUsers();
      this.setData({ users });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onSearchUser(e) {
    const val = e.detail.value.trim().toLowerCase();
    this.setData({ searchUser: val });
    if (!val) {
      this.loadUsers();
      return;
    }
    // 前端过滤已有数据
    const filtered = this.data.users.filter(u => u.name && u.name.toLowerCase().includes(val));
    this.setData({ users: filtered });
  },

  // ===== 物品管理 =====
  async loadItems() {
    try {
      const items = await DB.adminGetAllItems();
      this.setData({ items });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onSearchItem(e) {
    const val = e.detail.value.trim().toLowerCase();
    this.setData({ searchItem: val });
    if (!val) {
      this.loadItems();
      return;
    }
    const filtered = this.data.items.filter(i => i.title && i.title.toLowerCase().includes(val));
    this.setData({ items: filtered });
  },

  async deleteItem(e) {
    const itemId = e.currentTarget.dataset.itemid;
    if (!itemId) return;
    wx.showModal({
      title: '确认删除',
      content: '确定强制删除此物品？操作不可恢复。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await DB.adminDeleteItem(itemId);
          wx.showToast({ title: '已删除' });
          await this.loadItems();
        } catch (e) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  // ===== 申请管理 =====
  async loadRequests() {
    try {
      const requests = await DB.adminGetAllRequests();
      this.setData({ requests });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
