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
    showCallUI: false,
    callType: '',
    callStatus: '',
  },

  onLoad(options) {
    const user = app.globalData.userInfo;
    if (!user) return;

    const partnerId = options.userId;
    const itemId = options.itemId || '';
    if (!partnerId) { wx.navigateBack(); return; }

    const partner = DB.getUserById(partnerId);
    this.setData({
      partnerId,
      partnerName: partner ? partner.name : '邻居',
      itemId
    });

    DB.markRead(user.id, partnerId);
    this.loadMessages();
    this.initRecorder();
    this.initAudio();
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

    this._recorder.onStop((res) => {
      clearInterval(this._recTimer);
      self.setData({ recording: false });

      if (res.duration < 1000) {
        wx.showToast({ title: '录音太短', icon: 'none' });
        return;
      }

      const user = DB.getCurrentUser();
      if (!user) return;

      DB.sendMessage(user.id, self.data.partnerId, self.data.itemId || 'general',
        '[语音]', 'voice', {
          voiceDuration: Math.round(res.duration / 1000),
          voiceUrl: res.tempFilePath
        });
      self.loadMessages();
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
  loadMessages() {
    const user = DB.getCurrentUser();
    if (!user || !this.data.partnerId) return;
    const msgs = DB.getMessages(user.id, this.data.partnerId);
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
  sendImage() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        const user = DB.getCurrentUser();
        if (!user) return;

        DB.sendMessage(user.id, self.data.partnerId, self.data.itemId || 'general',
          '[图片]', 'image', { imageUrl: tempFilePath });
        self.setData({ showActions: false });
        self.loadMessages();
      }
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url] });
  },

  // ===== 通话 =====
  startVoiceCall() {
    this._doCall('voice');
  },

  startVideoCall() {
    this._doCall('video');
  },

  _doCall(type) {
    const self = this;
    wx.showModal({
      title: type === 'voice' ? '语音通话' : '视频通话',
      content: '呼叫 ' + this.data.partnerName + '...',
      confirmText: '呼叫',
      cancelText: '取消',
      success(res) {
        if (!res.confirm) return;
        const user = DB.getCurrentUser();
        if (!user) return;

        const label = type === 'voice' ? '语音通话' : '视频通话';
        DB.sendMessage(user.id, self.data.partnerId, self.data.itemId || 'general',
          label, 'call', { callType: type });

        self.setData({
          showCallUI: true,
          callType: type,
          callStatus: 'calling',
          showActions: false
        });
        self.loadMessages();

        // 模拟：3 秒后自动接通（演示效果）
        self._callTimer = setTimeout(() => {
          if (self.data.callStatus === 'calling') {
            self.setData({ callStatus: 'connected' });
            // 再 4 秒后挂断
            self._callEndTimer = setTimeout(() => {
              self._endCall();
            }, 4000);
          }
        }, 3000);
      }
    });
  },

  acceptCall() {
    clearTimeout(this._callTimer);
    this.setData({ callStatus: 'connected' });
    const self = this;
    self._callEndTimer = setTimeout(() => {
      self._endCall();
    }, 4000);
  },

  declineCall() {
    clearTimeout(this._callTimer);
    clearTimeout(this._callEndTimer);
    this._endCall();
  },

  _endCall() {
    this.setData({ callStatus: 'ended' });
    const self = this;
    setTimeout(() => {
      self.setData({ showCallUI: false, callStatus: '' });
    }, 1500);
  },

  // ===== 文本消息 =====
  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  sendMessage() {
    const content = this.data.inputValue.trim();
    if (!content) return;
    const user = DB.getCurrentUser();
    if (!user) return;

    DB.sendMessage(user.id, this.data.partnerId, this.data.itemId || 'general', content, 'text');
    this.setData({ inputValue: '' });
    this.loadMessages();
  },

  goBack() {
    wx.navigateBack();
  }
});
