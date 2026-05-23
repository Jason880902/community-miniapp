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
    showMarkClaimed: false,
    pendingRequests: [],
    showRequestList: false,
    swiperIndex: 0
  },

  async onLoad(options) {
    const itemId = options.id;
    if (!itemId) { wx.navigateBack(); return; }
    await this.loadItem(itemId);
  },

  async onShow() {
    const itemId = this.data.item?.id;
    if (itemId) await this.loadItem(itemId);
  },

  async loadItem(itemId) {
    const item = await DB.getItemById(itemId);
    if (!item) { wx.showToast({ title: '物品不存在', icon: 'none' }); wx.navigateBack(); return; }

    const user = app.globalData.userInfo;
    const owner = await DB.getUserById(item.userId);
    const isOwner = item.userId === user?.id;

    const requests = await DB.getRequestsForItem(item.id) || [];
    const pendingRequest = requests.some(r => r.userId === user?.id && r.status === 'pending');
    const pendingRequests = isOwner ? await DB.getPendingRequestsForItem(item.id) : [];

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
      isOwner,
      showMarkClaimed: isOwner && item.status === 'available' && pendingRequests.length === 0,
      pendingRequests: pendingRequests.map(r => ({
        ...r,
        time: util.formatTime(r.createTime)
      })),
      showRequestList: isOwner && pendingRequests.length > 0,
      swiperIndex: item.coverIndex || 0
    });
  },

  onSwiperChange(e) {
    this.setData({ swiperIndex: e.detail.current });
  },

  goBack() { wx.navigateBack(); },

  async requestItem() {
    const item = this.data.item;
    const user = app.globalData.userInfo;
    await DB.addRequest(item.id, user.id);
    await DB.sendMessage(user.id, item.userId, item.id, `你好，我想领取「${item.title}」，请问还在吗？`);
    wx.showToast({ title: '已发送申请' });
    await this.loadItem(item.id);
  },

  contactOwner() {
    const item = this.data.item;
    wx.navigateTo({
      url: `/pages/chat/chat?userId=${item.userId}&itemId=${item.id}&itemTitle=${item.title}`
    });
  },

  async markClaimed() {
    await DB.updateItemStatus(this.data.item.id, 'claimed');
    wx.showToast({ title: '已标记为已被领取' });
    await this.loadItem(this.data.item.id);
  },

  approveRequest(e) {
    const reqId = e.currentTarget.dataset.reqid;
    const item = this.data.item;
    const req = this.data.pendingRequests.find(r => r.id === reqId);
    if (!req) return;

    wx.showModal({
      title: '确认批准',
      content: `确定将「${item.title}」分享给 ${req.userName} 吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        await DB.updateRequestStatus(reqId, 'approved');
        await DB.updateItemStatus(item.id, 'claimed');
        await DB.sendMessage('system', req.userId, item.id, `你的申请已通过，请联系分享人领取「${item.title}」`);
        wx.showToast({ title: '已批准' });
        await this.loadItem(item.id);
      }
    });
  },

  rejectRequest(e) {
    const reqId = e.currentTarget.dataset.reqid;
    const item = this.data.item;
    const req = this.data.pendingRequests.find(r => r.id === reqId);
    if (!req) return;

    wx.showModal({
      title: '确认拒绝',
      content: `确定拒绝 ${req.userName} 的申请吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        await DB.updateRequestStatus(reqId, 'rejected');
        await DB.sendMessage('system', req.userId, item.id, `抱歉，「${item.title}」已分享给其他邻居`);
        wx.showToast({ title: '已拒绝' });
        await this.loadItem(item.id);
      }
    });
  }
});
