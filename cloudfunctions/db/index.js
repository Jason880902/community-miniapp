// 通用 CRUD 云函数
// 所有数据操作统一走此函数,在云端执行（绕过客户端权限限制）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 管理员 OpenID 列表（韩大哥登录后替换）
const ADMIN_OPENIDS = ['o6zAJsxCA3gg2smy-0OOO5GyTsGU'];

function requireAdmin() {
  const wxContext = cloud.getWXContext();
  if (!ADMIN_OPENIDS.includes(wxContext.OPENID)) {
    throw new Error('无管理员权限');
  }
}

// 标准化: 给对象补充 id 字段（兼容旧代码 item.id / user.id 写法）
function normalize(val) {
  if (Array.isArray(val)) return val.map(normalize);
  if (val && typeof val === 'object') {
    // id 优先级: msgId > requestId > itemId > userId
    if (val.msgId) val.id = val.msgId;
    else if (val.requestId) val.id = val.requestId;
    else if (val.itemId) val.id = val.itemId;
    else if (val.userId) val.id = val.userId;
    // 递归处理嵌套
    for (const key of Object.keys(val)) {
      if (key !== 'id') val[key] = normalize(val[key]);
    }
  }
  return val;
}

// ===== 操作分发 =====
exports.main = async (event) => {
  const { action, params } = event;
  const handler = HANDLERS[action];
  if (!handler) return { code: -1, msg: `未知操作: ${action}` };
  try {
    let result = await handler(params);
    // 标准化: 对返回的顶层数组/对象补充 id 字段
    result = normalize(result);
    return { code: 0, data: result };
  } catch (err) {
    return { code: -1, msg: err.message };
  }
};

// ===== 处理函数 =====
const HANDLERS = {

  // ----- 用户 -----
  async getOrCreateUser({ userId, name, community, avatarUrl, wechatId, phone }) {
    // 注入微信 OPENID 作为稳定 userId（不依赖昵称）
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (openid) userId = openid;

    // 1) 按 userId（即 openid）查找
    if (userId) {
      const { data } = await db.collection('users').where({ userId }).limit(1).get();
      if (data.length > 0) {
        const user = data[0];
        const updates = {};
        // 同步最新头像
        if (avatarUrl && user.avatarUrl !== avatarUrl) updates.avatarUrl = avatarUrl;
        // 昵称仅在当前为旧默认值时覆盖（用户自己改过的不覆盖）
        if (user.name === '微信用户') {
          updates.name = (name && name !== '微信用户') ? name : '邻居';
        }
        // 同步小区（允许用户切换小区）
        if (community && user.community !== community) updates.community = community;
        // 同步联系方式
        if (wechatId && user.wechatId !== wechatId) updates.wechatId = wechatId;
        if (phone && user.phone !== phone) updates.phone = phone;
        if (Object.keys(updates).length > 0) {
          await db.collection('users').doc(user._id).update({ data: updates });
        }
        return { ...user, ...updates, isAdmin: ADMIN_OPENIDS.includes(wxContext.OPENID) };
      }
    }

    // 2) 按 name+community 查重（兼容旧数据）
    if (name && community) {
      const { data } = await db.collection('users')
        .where({ name, community }).limit(1).get();
      if (data.length > 0) {
        const user = data[0];
        const updates = {};
        // 将旧记录的 userId 升级为 openid
        if (openid && user.userId !== openid) updates.userId = openid;
        if (avatarUrl && user.avatarUrl !== avatarUrl) updates.avatarUrl = avatarUrl;
        // 旧默认名 "微信用户" → 升级为新默认名
        if (user.name === '微信用户') {
          updates.name = (name && name !== '微信用户') ? name : '邻居';
        }
        // 同步小区
        if (community && user.community !== community) updates.community = community;
        // 同步联系方式
        if (wechatId && user.wechatId !== wechatId) updates.wechatId = wechatId;
        if (phone && user.phone !== phone) updates.phone = phone;
        if (Object.keys(updates).length > 0) {
          await db.collection('users').doc(user._id).update({ data: updates });
        }
        return { ...user, ...updates, isAdmin: ADMIN_OPENIDS.includes(wxContext.OPENID) };
      }
    }

    // 3) 完全不存在 → 新建
    const newId = userId || 'u' + Date.now();
    const finalName = (name && name !== '微信用户')
      ? name
      : '邻居' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const newUser = {
      userId: newId, name: finalName, community, avatarUrl: avatarUrl || '',
      wechatId: wechatId || '',
      phone: phone || '',
      createTime: Date.now()
    };
    const res = await db.collection('users').add({ data: newUser });
    return { ...newUser, _id: res._id, isAdmin: ADMIN_OPENIDS.includes(wxContext.OPENID) };
  },

  async getCurrentUser({ userId }) {
    if (!userId) return null;
    const { data } = await db.collection('users').where({ userId }).limit(1).get();
    const user = data[0] || null;
    if (user) {
      const wxContext = cloud.getWXContext();
      user.isAdmin = ADMIN_OPENIDS.includes(wxContext.OPENID);
    }
    return user;
  },

  async updateUserProfile({ userId, wechatId, phone }) {
    const { data } = await db.collection('users').where({ userId }).limit(1).get();
    if (data.length === 0) return { success: false, reason: 'not_found' };
    const updates = {};
    if (wechatId !== undefined) updates.wechatId = wechatId;
    if (phone !== undefined) updates.phone = phone;
    if (Object.keys(updates).length > 0) {
      await db.collection('users').doc(data[0]._id).update({ data: updates });
    }
    return { success: true, ...updates };
  },

  async getPhoneNumber({ code, encryptedData, iv }) {
    // 格式1: getPhoneNumber (旧 API) → encryptedData + iv，云 SDK 自动解密
    if (encryptedData && iv) {
      try {
        const result = await cloud.getOpenData({
          list: [{
            weRunData: encryptedData,
            userInfo: iv
          }]
        });
        console.log('[getPhoneNumber] getOpenData 格式1:', JSON.stringify(result));
        if (result.data && result.data[0] && result.data[0].phoneNumber) {
          return { phoneNumber: result.data[0].phoneNumber };
        }
      } catch (e) {
        console.warn('[getPhoneNumber] 格式1 失败:', e.message);
      }
    }

    // 格式2: choosePhoneNumber (新 API) → code
    if (code) {
      try {
        const result = await cloud.getOpenData({ list: [code] });
        console.log('[getPhoneNumber] getOpenData 格式2:', JSON.stringify(result));
        if (result.data && result.data[0] && result.data[0].phoneNumber) {
          return { phoneNumber: result.data[0].phoneNumber };
        }
      } catch (e) {
        console.warn('[getPhoneNumber] 格式2 失败:', e.message);
      }
    }

    console.warn('[getPhoneNumber] 无法解析手机号');
    return { phoneNumber: null };
  },

  async getUserById({ id }) {
    const { data } = await db.collection('users').where({ userId: id }).limit(1).get();
    return data[0] || null;
  },

  async getAllUsers() {
    const { data } = await db.collection('users').get();
    return data;
  },

  async updateUserName({ userId, newName }) {
    // 查重：其他用户是否已使用此昵称
    const { data: allUsers } = await db.collection('users').get();
    const conflict = allUsers.some(u => u.name === newName && u.userId !== userId);
    if (conflict) return { success: false, reason: 'duplicate' };

    // 更新
    const { data } = await db.collection('users').where({ userId }).limit(1).get();
    if (data.length === 0) return { success: false, reason: 'not_found' };
    await db.collection('users').doc(data[0]._id).update({ data: { name: newName } });
    return { success: true, name: newName };
  },

  // ----- 物品 -----
  async getAllItems() {
    const { data } = await db.collection('items').orderBy('createTime', 'desc').get();
    return data;
  },

  async getAvailableItems({ category, community }) {
    const { data } = await db.collection('items')
      .where({ status: 'available' }).orderBy('createTime', 'desc').get();
    let filtered = data;
    // 严格按小区筛选：只显示同小区的物品
    if (community) {
      filtered = data.filter(i => i.community === community);
    }
    if (category && category !== 'all') {
      filtered = filtered.filter(i => i.category === category);
    }
    return filtered;
  },

  async getItemById({ id }) {
    const { data } = await db.collection('items').where({ itemId: id }).limit(1).get();
    return data[0] || null;
  },

  async getItemsByUser({ userId }) {
    const { data: items } = await db.collection('items')
      .where({ userId }).orderBy('createTime', 'desc').get();
    // 附带待处理申请数
    const { data: allReqs } = await db.collection('requests').get();
    const itemIds = items.map(i => i.itemId);
    const pendingCounts = {};
    for (const req of allReqs) {
      if (req.status === 'pending' && itemIds.includes(req.itemId)) {
        pendingCounts[req.itemId] = (pendingCounts[req.itemId] || 0) + 1;
      }
    }
    return items.map(i => ({
      ...i,
      _pendingCount: pendingCounts[i.itemId] || 0
    }));
  },

  async updateItem({ itemId, updates }) {
    const { data } = await db.collection('items').where({ itemId }).limit(1).get();
    if (data.length === 0) return null;
    const docId = data[0]._id;
    // 只更新传入的字段
    const allowed = ['title', 'category', 'condition', 'desc', 'location', 'images', 'status', 'community', 'coverIndex'];
    const updateData = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) updateData[key] = updates[key];
    }
    if (Object.keys(updateData).length > 0) {
      await db.collection('items').doc(docId).update({ data: updateData });
    }
    return { ...data[0], ...updateData };
  },

  async addItem({ item }) {
    const newItem = {
      itemId: 'i' + Date.now(),
      userId: item.userId,
      community: item.community || '',
      coverIndex: item.coverIndex || 0,
      title: item.title,
      category: item.category,
      condition: item.condition,
      desc: item.desc || '',
      location: item.location || '',
      images: item.images || [],
      status: 'available',
      createTime: Date.now()
    };
    const res = await db.collection('items').add({ data: newItem });
    return { ...newItem, _id: res._id };
  },

  async updateItemStatus({ itemId, status }) {
    const { data } = await db.collection('items').where({ itemId }).limit(1).get();
    if (data.length === 0) return null;
    await db.collection('items').doc(data[0]._id).update({ data: { status } });
    return { ...data[0], status };
  },

  async deleteItem({ itemId }) {
    const { data } = await db.collection('items').where({ itemId }).limit(1).get();
    if (data.length === 0) return false;
    await db.collection('items').doc(data[0]._id).remove();
    return true;
  },

  async getItemStats({ userId }) {
    const { data } = await db.collection('items').where({ userId }).get();
    return {
      total: data.length,
      shared: data.filter(i => i.status === 'claimed' || i.status === 'completed').length,
      active: data.filter(i => i.status === 'available').length
    };
  },

  // ----- 消息 -----
  async sendMessage({ fromId, toId, itemId, content, type, extra }) {
    const msg = {
      msgId: 'm' + Date.now(),
      itemId,
      fromUserId: fromId,
      toUserId: toId,
      content,
      type: type || 'text',
      createTime: Date.now(),
      read: false
    };
    if (extra) {
      if (extra.voiceDuration !== undefined) msg.voiceDuration = extra.voiceDuration;
      if (extra.voiceUrl) msg.voiceUrl = extra.voiceUrl;
      if (extra.imageUrl) msg.imageUrl = extra.imageUrl;
      if (extra.callType) msg.callType = extra.callType;
      if (extra.reqId) msg.reqId = extra.reqId;
      if (extra.userName) msg.userName = extra.userName;
    }
    const res = await db.collection('messages').add({ data: msg });
    return { ...msg, _id: res._id };
  },

  async getConversations({ userId }) {
    const { data: allMsgs } = await db.collection('messages').get();
    const userMsgs = allMsgs.filter(m => m.fromUserId === userId || m.toUserId === userId);

    const otherIds = [...new Set(userMsgs.map(m =>
      m.fromUserId === userId ? m.toUserId : m.fromUserId
    ))];

    // 批量查用户
    const { data: allUsers } = await db.collection('users').get();
    const userMap = {};
    allUsers.forEach(u => { userMap[u.userId] = u; });

    // 查物品标题
    const { data: allItems } = await db.collection('items').get();
    const itemMap = {};
    allItems.forEach(i => { itemMap[i.itemId] = i; });

    return otherIds.map(ouId => {
      const convMsgs = userMsgs.filter(m =>
        (m.fromUserId === userId && m.toUserId === ouId) ||
        (m.fromUserId === ouId && m.toUserId === userId)
      ).sort((a, b) => b.createTime - a.createTime);

      const last = convMsgs[0];
      const unread = convMsgs.filter(m => m.toUserId === userId && !m.read).length;
      const other = userMap[ouId];
      const isSystem = ouId === 'system';
      const item = last ? itemMap[last.itemId] : null;

      const preview = last
        ? (last.type === 'voice' ? '[语音]' : last.type === 'image' ? '[图片]' : last.type === 'call' ? last.content : last.content)
        : '';

      return {
        userId: ouId,
        userName: other ? other.name : (isSystem ? '系统通知' : '未知'),
        userAvatar: other ? (other.avatarUrl || '') : '',
        lastMsg: preview,
        lastTime: last ? last.createTime : 0,
        unread,
        itemId: last ? last.itemId || '' : '',
        itemTitle: item ? item.title : ''
      };
    }).sort((a, b) => b.lastTime - a.lastTime);
  },

  async getMessages({ userId1, userId2 }) {
    const { data } = await db.collection('messages')
      .where(_.or([
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 }
      ]))
      .orderBy('createTime', 'asc')
      .get();
    return data;
  },

  async markRead({ currentUserId, otherUserId }) {
    const { data } = await db.collection('messages')
      .where({ toUserId: currentUserId, fromUserId: otherUserId, read: false })
      .get();
    const updates = data.map(m => db.collection('messages').doc(m._id).update({ data: { read: true } }));
    await Promise.all(updates);
    return true;
  },

  async countUnread({ userId }) {
    const { data } = await db.collection('messages')
      .where({ toUserId: userId, read: false })
      .get();
    return data.length;
  },

  // ----- 申请 -----
  async addRequest({ itemId, userId }) {
    const req = {
      requestId: 'r' + Date.now(),
      itemId, userId,
      status: 'pending',
      createTime: Date.now()
    };
    const res = await db.collection('requests').add({ data: req });
    return { ...req, _id: res._id };
  },

  async getRequestsForItem({ itemId }) {
    const { data } = await db.collection('requests').where({ itemId }).get();
    return data;
  },

  async getPendingRequestsForItem({ itemId }) {
    const { data: requests } = await db.collection('requests')
      .where({ itemId, status: 'pending' }).get();
    // 查用户信息
    const { data: users } = await db.collection('users').get();
    const userMap = {};
    users.forEach(u => { userMap[u.userId] = u; });
    return requests.map(r => ({
      ...r,
      userName: userMap[r.userId] ? userMap[r.userId].name : '未知',
      userAvatar: userMap[r.userId] ? (userMap[r.userId].avatarUrl || '') : ''
    }));
  },

  async updateRequestStatus({ requestId, newStatus }) {
    const { data } = await db.collection('requests').where({ requestId }).limit(1).get();
    if (data.length === 0) return null;
    await db.collection('requests').doc(data[0]._id).update({ data: { status: newStatus } });
    return { ...data[0], status: newStatus };
  },

  async getUserRequests({ userId }) {
    const { data } = await db.collection('requests').where({ userId }).get();
    return data;
  },

  // ===== 管理员 =====
  async getAdminStats() {
    requireAdmin();
    const { data: users } = await db.collection('users').get();
    const { data: items } = await db.collection('items').get();
    const { data: requests } = await db.collection('requests').get();
    const { total: msgCount } = await db.collection('messages').count();
    const itemStatusCount = {};
    const catCount = {};
    items.forEach(i => {
      itemStatusCount[i.status] = (itemStatusCount[i.status] || 0) + 1;
      catCount[i.category] = (catCount[i.category] || 0) + 1;
    });
    const requestStatusCount = {};
    requests.forEach(r => { requestStatusCount[r.status] = (requestStatusCount[r.status] || 0) + 1; });
    return {
      userCount: users.length,
      itemCount: items.length,
      requestCount: requests.length,
      msgCount,
      itemStatusCount,
      catCount,
      requestStatusCount
    };
  },

  async adminGetAllUsers() {
    requireAdmin();
    const { data: users } = await db.collection('users').get();
    const { data: items } = await db.collection('items').get();
    const { data: requests } = await db.collection('requests').get();
    const itemCount = {};
    const requestCount = {};
    items.forEach(i => { itemCount[i.userId] = (itemCount[i.userId] || 0) + 1; });
    requests.forEach(r => { requestCount[r.userId] = (requestCount[r.userId] || 0) + 1; });
    return users.map(u => ({
      ...u,
      itemCount: itemCount[u.userId] || 0,
      requestCount: requestCount[u.userId] || 0
    }));
  },

  async adminGetAllItems() {
    requireAdmin();
    const { data: items } = await db.collection('items').orderBy('createTime', 'desc').get();
    const { data: users } = await db.collection('users').get();
    const { data: requests } = await db.collection('requests').get();
    const userMap = {};
    users.forEach(u => { userMap[u.userId] = u; });
    const reqCount = {};
    requests.forEach(r => { reqCount[r.itemId] = (reqCount[r.itemId] || 0) + 1; });
    return items.map(i => ({
      ...i,
      ownerName: userMap[i.userId] ? userMap[i.userId].name : '未知',
      requestCount: reqCount[i.itemId] || 0
    }));
  },

  async adminGetAllRequests() {
    requireAdmin();
    const { data: requests } = await db.collection('requests').orderBy('createTime', 'desc').get();
    const { data: items } = await db.collection('items').get();
    const { data: users } = await db.collection('users').get();
    const itemMap = {};
    items.forEach(i => { itemMap[i.itemId] = i; });
    const userMap = {};
    users.forEach(u => { userMap[u.userId] = u; });
    return requests.map(r => ({
      ...r,
      itemTitle: itemMap[r.itemId] ? itemMap[r.itemId].title : '物品已删除',
      userName: userMap[r.userId] ? userMap[r.userId].name : '未知'
    }));
  },

  async adminDeleteItem({ itemId }) {
    requireAdmin();
    const { data } = await db.collection('items').where({ itemId }).limit(1).get();
    if (data.length === 0) return { success: false };
    await db.collection('items').doc(data[0]._id).remove();
    return { success: true };
  },

  // ----- 初始化种子数据 -----
  async seed() {
    // 检查是否已有数据
    const { total: userCount } = await db.collection('users').count();
    if (userCount > 0) return { msg: '已有数据, 跳过种子', userCount };

    const users = [
      { userId: 'u2', name: '李大叔', community: '阳光花园小区', avatarUrl: '', createTime: Date.now() - 700000000 },
      { userId: 'u3', name: '王老师', community: '阳光花园小区', avatarUrl: '', createTime: Date.now() - 700000000 },
      { userId: 'u4', name: '刘姐', community: '阳光花园小区', avatarUrl: '', createTime: Date.now() - 700000000 },
      { userId: 'u5', name: '小陈', community: '阳光花园小区', avatarUrl: '', createTime: Date.now() - 700000000 },
    ];
    for (const u of users) await db.collection('users').add({ data: u });

    const items = [
      { itemId: 'i1', userId: 'u2', title: '实木书桌', desc: '孩子长大了换新书桌，实木材质非常结实。尺寸120cm×60cm×75cm，带一个抽屉。', category: '家具家居', condition: '八成新', location: '5号楼1单元', status: 'available', images: [], createTime: Date.now() - 600000000 },
      { itemId: 'i2', userId: 'u3', title: '儿童自行车', desc: '孩子长高了换新车，这辆20寸自行车保养得很好，适合6-10岁小朋友。', category: '母婴儿童', condition: '七成新', location: '2号楼3单元', status: 'available', images: [], createTime: Date.now() - 500000000 },
      { itemId: 'i3', userId: 'u4', title: '智能电饭煲', desc: '搬家买多了，全新未拆封。3L容量，支持煮饭、煲汤、蒸煮。', category: '厨房用具', condition: '全新', location: '8号楼2单元', status: 'available', images: [], createTime: Date.now() - 400000000 },
      { itemId: 'i4', userId: 'u5', title: '《人类简史》', desc: '看过一遍跟新的一样。非常好看的一本书，值得每个人阅读。', category: '书籍文具', condition: '几乎全新', location: '3号楼1单元', status: 'available', images: [], createTime: Date.now() - 350000000 },
      { itemId: 'i5', userId: 'u2', title: '瑜伽垫', desc: '买来用了没几次，厚度6mm防滑效果好，附带收纳绑带。', category: '运动户外', condition: '九成新', location: '6号楼2单元', status: 'available', images: [], createTime: Date.now() - 300000000 },
      { itemId: 'i6', userId: 'u3', title: '冬季加厚外套', desc: '买大了穿过一次。尺码180/XL，黑色，很暖和。', category: '服饰鞋包', condition: '九成新', location: '5号楼1单元', status: 'available', images: [], createTime: Date.now() - 250000000 },
      { itemId: 'i7', userId: 'u4', title: 'LED护眼台灯', desc: '三档调光，光线柔和不刺眼，适合看书学习。', category: '日用百货', condition: '七成新', location: '2号楼3单元', status: 'available', images: [], createTime: Date.now() - 200000000 },
      { itemId: 'i8', userId: 'u5', title: '绿萝盆栽', desc: '家里养太多了分一盆出来，好养活定期浇水就行。', category: '植物花卉', condition: '全新', location: '8号楼2单元', status: 'claimed', images: [], createTime: Date.now() - 150000000 },
      { itemId: 'i9', userId: 'u2', title: '婴儿推车', desc: '可坐可躺，遮阳篷完好，四轮减震折叠方便。', category: '母婴儿童', condition: '八成新', location: '3号楼1单元', status: 'available', images: [], createTime: Date.now() - 100000000 },
      { itemId: 'i10', userId: 'u3', title: '蓝牙小音箱', desc: '音质不错音量够大，充满电能听6小时。', category: '电子产品', condition: '九成新', location: '6号楼2单元', status: 'available', images: [], createTime: Date.now() - 50000000 },
      { itemId: 'i11', userId: 'u4', title: '不锈钢锅具三件套', desc: '全新未使用，含炒锅、汤锅、煎锅。', category: '厨房用具', condition: '全新', location: '5号楼1单元', status: 'available', images: [], createTime: Date.now() - 30000000 },
      { itemId: 'i12', userId: 'u5', title: '电子体重秤', desc: '电池已换新，精准度高。', category: '电子产品', condition: '八成新', location: '2号楼3单元', status: 'available', images: [], createTime: Date.now() - 10000000 },
    ];
    for (const item of items) await db.collection('items').add({ data: item });

    return { msg: '种子数据写入完成', users: users.length, items: items.length };
  }
};
