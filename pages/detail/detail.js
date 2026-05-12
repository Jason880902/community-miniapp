const DB = require('../../utils/data');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const app = getApp();

Page({
  data: {
    item: {},
    icons: icons,
    ownerName: '',
    ownerInitial: '',
    ownerCommunity: '',
    showRequest: false,
    showApplied: false,
    showContact: false,
    showMarkClaimed: false
  },

  onLoad(options) {
    const itemId = options.id;
    if (!itemId) { wx.navigateBack(); return; }
    this.loadItem(itemId);
  },

  onShow() {
    // 回来时刷新数据
    const itemId = this.data.item?.id;
    if (itemId) this.loadItem(itemId);
  },

  loadItem(itemId) {
    const item = DB.getItemById(itemId);
    if (!item) { wx.showToast({ title: '物品不存在', icon: 'none' }); wx.navigateBack(); return; }

    const user = app.globalData.userInfo;
    const owner = DB.getUserById(item.userId);
    const isOwner = item.userId === user?.id;

    const requests = DB.getRequestsForItem(item.id) || [];
    const pendingRequest = requests.some(r => r.userId === user?.id && r.status === 'pending');

    this.setData({
      item: {
        ...item,
        catColor: util.getCategoryColor(item.category),
        time: util.formatTime(item.createTime)
      },
      ownerName: owner ? owner.name : '邻居',
      ownerInitial: owner ? owner.name.charAt(0) : '?',
      ownerAvatar: owner ? (owner.avatarUrl || '') : '',
      ownerCommunity: owner ? owner.community : '',
      showRequest: item.status === 'available' && !isOwner && !pendingRequest,
      showApplied: item.status === 'available' && !isOwner && !!pendingRequest,
      showContact: !isOwner && item.status === 'available',
      showMarkClaimed: item.status === 'available' && isOwner
    });
  },

  goBack() { wx.navigateBack(); },

  requestItem() {
    const item = this.data.item;
    const user = app.globalData.userInfo;
    DB.addRequest(item.id, user.id);
    DB.sendMessage(user.id, item.userId, item.id, `你好，我想领取「${item.title}」，请问还在吗？`);
    wx.showToast({ title: '已发送申请' });
    this.loadItem(item.id);
  },

  contactOwner() {
    const item = this.data.item;
    wx.navigateTo({
      url: `/pages/chat/chat?userId=${item.userId}&itemId=${item.id}&itemTitle=${item.title}`
    });
  },

  markClaimed() {
    DB.updateItemStatus(this.data.item.id, 'claimed');
    wx.showToast({ title: '已标记为已被领取' });
    this.loadItem(this.data.item.id);
  }
});
