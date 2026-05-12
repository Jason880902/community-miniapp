const STORAGE_KEY = 'neighbor_data';

const CATEGORIES = ['家具家居', '电子产品', '书籍文具', '服饰鞋包', '母婴儿童', '运动户外', '厨房用具', '日用百货', '植物花卉', '其他'];
const CONDITIONS = ['全新', '几乎全新', '九成新', '八成新', '七成新', '有瑕疵'];

const DEFAULT_ITEMS = [
  { id: 'i1', userId: 'u2', title: '实木书桌', desc: '孩子长大了换新书桌，实木材质非常结实。尺寸120cm×60cm×75cm，带一个抽屉。', category: '家具家居', condition: '八成新', location: '5号楼1单元', status: 'available', createTime: Date.now() - 600000000 },
  { id: 'i2', userId: 'u3', title: '儿童自行车', desc: '孩子长高了换新车，这辆20寸自行车保养得很好，适合6-10岁小朋友。', category: '母婴儿童', condition: '七成新', location: '2号楼3单元', status: 'available', createTime: Date.now() - 500000000 },
  { id: 'i3', userId: 'u4', title: '智能电饭煲', desc: '搬家买多了，全新未拆封。3L容量，支持煮饭、煲汤、蒸煮。', category: '厨房用具', condition: '全新', location: '8号楼2单元', status: 'available', createTime: Date.now() - 400000000 },
  { id: 'i4', userId: 'u5', title: '《人类简史》', desc: '看过一遍跟新的一样。非常好看的一本书，值得每个人阅读。', category: '书籍文具', condition: '几乎全新', location: '3号楼1单元', status: 'available', createTime: Date.now() - 350000000 },
  { id: 'i5', userId: 'u2', title: '瑜伽垫', desc: '买来用了没几次，厚度6mm防滑效果好，附带收纳绑带。', category: '运动户外', condition: '九成新', location: '6号楼2单元', status: 'available', createTime: Date.now() - 300000000 },
  { id: 'i6', userId: 'u3', title: '冬季加厚外套', desc: '买大了穿过一次。尺码180/XL，黑色，很暖和。', category: '服饰鞋包', condition: '九成新', location: '5号楼1单元', status: 'available', createTime: Date.now() - 250000000 },
  { id: 'i7', userId: 'u4', title: 'LED护眼台灯', desc: '三档调光，光线柔和不刺眼，适合看书学习。', category: '日用百货', condition: '七成新', location: '2号楼3单元', status: 'available', createTime: Date.now() - 200000000 },
  { id: 'i8', userId: 'u5', title: '绿萝盆栽', desc: '家里养太多了分一盆出来，好养活定期浇水就行。', category: '植物花卉', condition: '全新', location: '8号楼2单元', status: 'claimed', createTime: Date.now() - 150000000 },
  { id: 'i9', userId: 'u2', title: '婴儿推车', desc: '可坐可躺，遮阳篷完好，四轮减震折叠方便。', category: '母婴儿童', condition: '八成新', location: '3号楼1单元', status: 'available', createTime: Date.now() - 100000000 },
  { id: 'i10', userId: 'u3', title: '蓝牙小音箱', desc: '音质不错音量够大，充满电能听6小时。', category: '电子产品', condition: '九成新', location: '6号楼2单元', status: 'available', createTime: Date.now() - 50000000 },
  { id: 'i11', userId: 'u4', title: '不锈钢锅具三件套', desc: '全新未使用，含炒锅、汤锅、煎锅。', category: '厨房用具', condition: '全新', location: '5号楼1单元', status: 'available', createTime: Date.now() - 30000000 },
  { id: 'i12', userId: 'u5', title: '电子体重秤', desc: '电池已换新，精准度高。', category: '电子产品', condition: '八成新', location: '2号楼3单元', status: 'available', createTime: Date.now() - 10000000 },
];

const DEFAULT_DATA = {
  users: [
    { id: 'u2', name: '李大叔', community: '阳光花园小区' },
    { id: 'u3', name: '王老师', community: '阳光花园小区' },
    { id: 'u4', name: '刘姐', community: '阳光花园小区' },
    { id: 'u5', name: '小陈', community: '阳光花园小区' },
  ],
  items: DEFAULT_ITEMS,
  messages: [],
  requests: [],
  currentUserId: ''
};

function load() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function save(data) {
  wx.setStorageSync(STORAGE_KEY, JSON.stringify(data));
}

// ===== 导出 API =====

function getCurrentUser() {
  const data = load();
  if (!data.currentUserId) return null;
  return data.users.find(u => u.id === data.currentUserId) || null;
}

function setCurrentUser(userId) {
  const data = load();
  data.currentUserId = userId;
  save(data);
}

function getOrCreateUser(name, community, avatarUrl) {
  const data = load();
  let user = data.users.find(u => u.name === name && u.community === community);
  if (user) {
    // 更新头像（可能之前没有）
    if (avatarUrl && user.avatarUrl !== avatarUrl) {
      user.avatarUrl = avatarUrl;
      save(data);
    }
    return user;
  }
  user = { id: 'u' + Date.now(), name, community };
  if (avatarUrl) user.avatarUrl = avatarUrl;
  data.users.push(user);
  save(data);
  return user;
}

function getAllItems() {
  const data = load();
  return (data.items || []).sort((a, b) => b.createTime - a.createTime);
}

function getAvailableItems(category) {
  const data = load();
  let items = (data.items || []).filter(i => i.status === 'available');
  if (category && category !== 'all') items = items.filter(i => i.category === category);
  return items.sort((a, b) => b.createTime - a.createTime);
}

function getItemById(id) {
  const data = load();
  return data.items.find(i => i.id === id) || null;
}

function getUserById(id) {
  const data = load();
  return data.users.find(u => u.id === id) || null;
}

function getAllUsers() {
  const data = load();
  return data.users || [];
}

function getItemsByUser(userId) {
  const data = load();
  return (data.items || []).filter(i => i.userId === userId).sort((a, b) => b.createTime - a.createTime);
}

function addItem(item) {
  const data = load();
  item.id = 'i' + Date.now();
  item.createTime = Date.now();
  item.status = 'available';
  data.items.push(item);
  save(data);
  return item;
}

function updateItemStatus(itemId, status) {
  const data = load();
  const item = data.items.find(i => i.id === itemId);
  if (item) { item.status = status; save(data); }
  return item;
}

function sendMessage(fromId, toId, itemId, content, type, extra) {
  const data = load();
  const msg = {
    id: 'm' + Date.now(),
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
  }
  if (!data.messages) data.messages = [];
  data.messages.push(msg);
  save(data);
  return msg;
}

function getMessagePreview(msg) {
  if (msg.type === 'voice') return '[语音]';
  if (msg.type === 'image') return '[图片]';
  if (msg.type === 'call') return msg.content;
  return msg.content;
}

function getConversations(userId) {
  const data = load();
  const msgs = data.messages || [];
  const otherIds = new Set();
  msgs.forEach(m => {
    if (m.fromUserId === userId) otherIds.add(m.toUserId);
    if (m.toUserId === userId) otherIds.add(m.fromUserId);
  });
  return Array.from(otherIds).map(ouId => {
    const userMsgs = msgs.filter(m =>
      (m.fromUserId === userId && m.toUserId === ouId) ||
      (m.fromUserId === ouId && m.toUserId === userId)
    ).sort((a, b) => b.createTime - a.createTime);
    const last = userMsgs[0];
    const unread = msgs.filter(m => m.toUserId === userId && m.fromUserId === ouId && !m.read).length;
    const other = getUserById(ouId);
    const item = last ? getItemById(last.itemId) : null;
    return {
      userId: ouId,
      userName: other ? other.name : '未知',
      lastMsg: last ? getMessagePreview(last) : '',
      lastTime: last ? last.createTime : 0,
      unread,
      itemTitle: item ? item.title : ''
    };
  }).sort((a, b) => b.lastTime - a.lastTime);
}

function getMessages(userId1, userId2) {
  const data = load();
  return (data.messages || [])
    .filter(m => (m.fromUserId === userId1 && m.toUserId === userId2) || (m.fromUserId === userId2 && m.toUserId === userId1))
    .sort((a, b) => a.createTime - b.createTime);
}

function markRead(currentUserId, otherUserId) {
  const data = load();
  (data.messages || []).forEach(m => {
    if (m.toUserId === currentUserId && m.fromUserId === otherUserId) m.read = true;
  });
  save(data);
}

function countUnread(userId) {
  const data = load();
  return (data.messages || []).filter(m => m.toUserId === userId && !m.read).length;
}

function addRequest(itemId, userId) {
  const data = load();
  if (!data.requests) data.requests = [];
  const req = { id: 'r' + Date.now(), itemId, userId, status: 'pending', createTime: Date.now() };
  data.requests.push(req);
  save(data);
  return req;
}

function getRequestsForItem(itemId) {
  const data = load();
  return (data.requests || []).filter(r => r.itemId === itemId);
}

function getUserRequests(userId) {
  const data = load();
  return (data.requests || []).filter(r => r.userId === userId);
}

function getItemStats(userId) {
  const items = getItemsByUser(userId);
  return {
    total: items.length,
    shared: items.filter(i => i.status === 'claimed' || i.status === 'completed').length,
    active: items.filter(i => i.status === 'available').length
  };
}

module.exports = {
  CATEGORIES, CONDITIONS,
  getCurrentUser, setCurrentUser, getOrCreateUser,
  getAllItems, getAvailableItems, getItemById,
  getUserById, getAllUsers, getItemsByUser, addItem, updateItemStatus,
  sendMessage, getConversations, getMessages, markRead, countUnread,
  addRequest, getRequestsForItem, getUserRequests, getItemStats
};
