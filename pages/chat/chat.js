const DB = require('../../utils/data');
const util = require('../../utils/util');
const icons = require('../../utils/icons');
const app = getApp();

Page({
  data: {
    partnerName: '',
    icons,
    partnerId: '',
    itemId: '',
    messages: [],
    inputValue: '',
    scrollTo: '',
    inputMode: 'text',
    showActions: false,
    recording: false,
    recordDuration: 0,
    playingId: '',
    isOwner: false,
    statusBarHeight: util.getSafeArea().statusBarHeight,
  },

  async onLoad(options) {
    const user = app.globalData.userInfo;
    if (!user) return;

    const partnerId = options.userId;
    const itemId = options.itemId || '';
    if (!partnerId) { wx.navigateBack(); return; }

    let partnerName = '';
    let isSystem = false;
    if (partnerId === 'system') {
      partnerName = '系统通知';
      isSystem = true;
    } else {
      const partner = await DB.getUserById(partnerId);
      partnerName = partner ? partner.name : '邻居';
    }
    const partnerInitial = partnerName.charAt(0);
    this.setData({
      partnerId,
      partnerName,
      partnerInitial,
      itemId,
      isSystem
    });

    // 判断当前用户是否是物品主人（用于显示申请卡片）
    if (itemId) {
      const item = await DB.getItemById(itemId);
      if (item) this.setData({ isOwner: item.userId === user.id });
    }

    await DB.markRead(user.id, partnerId);
    await this.loadMessages();
    if (!isSystem) {
      this.initRecorder();
      this.initAudio();
    }
  },

  onUnload() {
    if (this._audioCtx) this._audioCtx.destroy();
  },

  // ===== 录音 =====
  initRecorder() {
    const self = this;
    this._recTimer = null;
    this._recDuration = 0;
    this._recorder = wx.getRecorderManager();

    this._recorder.onStart(() => {
      this._recDuration = 0;
      this._recTimer = setInterval(() => {
        this._recDuration++;
        self.setData({ recordDuration: this._recDuration });
      }, 1000);
    });

    this._recorder.onStop(async (res) => {
      clearInterval(this._recTimer);
      self.setData({ recording: false });

      if (res.duration < 1000) {
        wx.showToast({ title: '录音太短', icon: 'none' });
        return;
      }

      const user = app.globalData.userInfo;
      if (!user) return;

      await DB.sendMessage(user.id, self.data.partnerId, self.data.itemId || 'general',
        '[语音]', 'voice', {
          voiceDuration: Math.round(res.duration / 1000),
          voiceUrl: res.tempFilePath
        });
      await self.loadMessages();
    });

    this._recorder.onError(() => {
      clearInterval(this._recTimer);
      self.setData({ recording: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  // ===== 播放 =====
  initAudio() {
    const self = this;
    this._audioCtx = wx.createInnerAudioContext();

    this._audioCtx.onEnded(() => {
      self.setData({ playingId: '' });
    });

    this._audioCtx.onError(() => {
      self.setData({ playingId: '' });
    });
  },

  // ===== 消息加载 =====
  async loadMessages() {
    const user = app.globalData.userInfo;
    if (!user || !this.data.partnerId) return;
    const msgs = await DB.getMessages(user.id, this.data.partnerId);
    this.setData({
      messages: msgs.map((m, i) => ({
        ...m,
        time: util.formatTime(m.createTime),
        isSent: m.fromUserId === user.id
      })),
      scrollTo: 'msg-' + (msgs.length - 1)
    });
  },

  // ===== 输入模式切换 =====
  toggleInputMode() {
    this.setData({
      inputMode: this.data.inputMode === 'text' ? 'voice' : 'text',
      showActions: false
    });
  },

  // ===== 操作面板 =====
  toggleActions() {
    this.setData({ showActions: !this.data.showActions });
  },

  // ===== 录音控制 =====
  startRecord() {
    const self = this;
    wx.authorize({
      scope: 'scope.record',
      success() {
        self._recorder.start({ format: 'mp3' });
      },
      fail() {
        wx.showToast({ title: '需要麦克风权限', icon: 'none' });
      }
    });
  },

  stopRecord() {
    this._recorder.stop();
  },

  // ===== 播放语音 =====
  playVoice(e) {
    const msgId = e.currentTarget.dataset.id;
    const msg = this.data.messages.find(m => m.id === msgId);
    if (!msg || !msg.voiceUrl) return;

    if (this.data.playingId === msgId) {
      this._audioCtx.stop();
      this.setData({ playingId: '' });
      return;
    }

    this._audioCtx.src = msg.voiceUrl;
    this._audioCtx.play();
    this.setData({ playingId: msgId });
  },

  // ===== 拍照/选图 =====
  sendImage(sourceType) {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: sourceType,
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        const user = app.globalData.userInfo;
        if (!user) return;

        await DB.sendMessage(user.id, self.data.partnerId, self.data.itemId || 'general',
          '[图片]', 'image', { imageUrl: tempFilePath });
        self.setData({ showActions: false });
        await self.loadMessages();
      }
    });
  },

  takePhoto() {
    this.sendImage(['camera']);
  },

  pickFromAlbum() {
    this.sendImage(['album']);
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url] });
  },

  // ===== 审批申请（聊天内请求卡片） =====
  async approveRequest(e) {
    const reqId = e.currentTarget.dataset.reqid;
    if (!reqId) return;
    wx.showModal({
      title: '确认批准',
      content: '确定将物品分享给这个邻居吗？',
      success: async (res) => {
        if (!res.confirm) return;
        await DB.updateRequestStatus(reqId, 'approved');
        await DB.updateItemStatus(this.data.itemId, 'claimed');
        await DB.sendMessage('system', this.data.partnerId, this.data.itemId,
          '你的申请已通过，请联系分享人领取物品');
        wx.showToast({ title: '已批准' });
        await this.loadMessages();
      }
    });
  },

  async rejectRequest(e) {
    const reqId = e.currentTarget.dataset.reqid;
    if (!reqId) return;
    wx.showModal({
      title: '确认拒绝',
      content: '确定拒绝这个申请吗？',
      success: async (res) => {
        if (!res.confirm) return;
        await DB.updateRequestStatus(reqId, 'rejected');
        await DB.sendMessage('system', this.data.partnerId, this.data.itemId,
          '抱歉，物品已分享给其他邻居');
        wx.showToast({ title: '已拒绝' });
        await this.loadMessages();
      }
    });
  },

  // ===== 通话（发送通话邀请消息） =====
  async startVoiceCall() {
    const user = app.globalData.userInfo;
    if (!user) return;
    await DB.sendMessage(user.id, this.data.partnerId, this.data.itemId || 'general',
      '语音通话', 'call', { callType: 'voice' });
    this.setData({ showActions: false });
    await this.loadMessages();
    wx.showToast({ title: '已发送语音通话邀请', icon: 'none' });
  },

  async startVideoCall() {
    const user = app.globalData.userInfo;
    if (!user) return;
    await DB.sendMessage(user.id, this.data.partnerId, this.data.itemId || 'general',
      '视频通话', 'call', { callType: 'video' });
    this.setData({ showActions: false });
    await this.loadMessages();
    wx.showToast({ title: '已发送视频通话邀请', icon: 'none' });
  },

  // ===== 文本消息 =====
  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  async sendMessage() {
    const content = this.data.inputValue.trim();
    if (!content) return;
    const user = app.globalData.userInfo;
    if (!user) return;

    await DB.sendMessage(user.id, this.data.partnerId, this.data.itemId || 'general', content, 'text');
    this.setData({ inputValue: '' });
    await this.loadMessages();
  },

  goBack() {
    wx.navigateBack();
  }
});
