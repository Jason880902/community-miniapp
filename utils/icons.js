// 分类配色
const CATEGORY_COLORS = {
  '家具家居': { bg: '#EFF6FF', text: '#1A6EFF' },
  '电子产品': { bg: '#EEF2FF', text: '#4F46E5' },
  '书籍文具': { bg: '#ECFDF5', text: '#059669' },
  '服饰鞋包': { bg: '#FAF5FF', text: '#7C3AED' },
  '母婴儿童': { bg: '#FDF2F8', text: '#DB2777' },
  '运动户外': { bg: '#ECFEFF', text: '#0891B2' },
  '厨房用具': { bg: '#FFF7ED', text: '#EA580C' },
  '日用百货': { bg: '#F5F3FF', text: '#6D28D9' },
  '植物花卉': { bg: '#F0FDF4', text: '#16A34A' },
  '其他': { bg: '#F8FAFC', text: '#64748B' },
};

// tab 图标
const TAB_ICONS = {
  home: '🏠',
  community: '🏘️',
  post: '＋',
  msg: '💬',
  me: '👤',
};

// 通用图标 — 全部用中文字符或通用符号，杜绝豆腐块
module.exports = {
  CATEGORY_COLORS,
  TAB_ICONS,

  // 操作
  heart: '♥',
  check: '✓',

  // 导航
  back: '←',
  close: '✕',
  arrow: '›',
};
