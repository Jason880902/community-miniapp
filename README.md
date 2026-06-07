# 邻里 — 社区旧物爱心分享小程序

邻里是一个基于微信小程序的社区旧物分享平台，让邻居之间可以免费分享闲置物品，促进社区互助与环保。

## 功能特性

### 用户端
- **物品浏览** — 左侧分类栏 + 右侧双列瀑布流，支持 10 大分类筛选
- **物品发布** — 支持多图上传、AI 智能识别分类与描述生成
- **内容审核** — 图片上传自动调用腾讯云 IMS 审核，过滤违规内容
- **申请领取** — 一键申请，物主可批准/拒绝
- **即时消息** — 文字、语音、图片消息，实时沟通
- **个人信息** — 微信号、联系电话管理，我的发布与申请记录
- **小区社区** — 同小区成员聚合，社区统计

### 管理后台
- **数据仪表盘** — 用户数、物品数、申请数、消息数统计
- **用户管理** — 查看所有用户信息、发布与申请统计
- **物品管理** — 查看/删除物品，含发布人联系方式
- **申请管理** — 查看所有申请状态

## 技术架构

```
社区小程序
├── 前端（微信小程序原生）
│   ├── pages/          — 页面（login、index、detail、post、messages、chat、profile、community、admin）
│   ├── utils/          — 工具层（data.js 云函数调用、util.js 通用工具、icons.js 图标）
│   ├── images/         — 图标资源
│   └── app.js/json/wxss — 全局配置
├── 云函数（微信云开发）
│   ├── db/             — 通用 CRUD（用户、物品、消息、申请）
│   ├── classifyImage/  — AI 图片分类（腾讯云 Hunyuan Vision / TIIA）
│   └── contentAudit/   — 图片内容审核（腾讯云 IMS）
└── 管理后台（Node.js + Express）
    ├── server.js       — API 服务（直连云数据库）
    └── public/         — 管理后台前端
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 微信小程序原生（WXML / WXSS / JS） |
| 云服务 | 微信云开发（云函数 + 云数据库 + 云存储） |
| AI 能力 | 腾讯云 Hunyuan Vision（图片识别）、TIIA（标签分类）、IMS（内容审核） |
| 管理后台 | Node.js + Express + @cloudbase/node-sdk |
| 部署 | PM2 守护进程（CVM 服务器） |

## 项目结构

```
community-miniapp/
├── app.js                    — 小程序入口
├── app.json                  — 全局配置
├── app.wxss                  — 全局样式（设计令牌、通用组件）
├── project.config.json       — 项目配置
├── cloudbaserc.json          — 云函数部署配置
├── pages/
│   ├── login/                — 登录页（昵称授权 + 小区选择 + 联系方式）
│   ├── index/                — 首页（左分类右物品布局）
│   ├── detail/               — 物品详情（申请、联系、相似物品）
│   ├── post/                 — 发布/编辑物品（AI 识别 + 内容审核）
│   ├── messages/             — 消息列表
│   ├── chat/                 — 聊天详情
│   ├── profile/              — 个人中心
│   ├── community/            — 小区社区
│   └── admin/                — 小程序内嵌管理入口
├── utils/
│   ├── data.js               — 数据库操作层
│   ├── util.js               — 通用工具（时间格式化、安全区）
│   └── icons.js              — 图标常量
├── cloudfunctions/
│   ├── db/                   — 核心云函数（用户、物品、消息、申请、管理）
│   ├── classifyImage/        — AI 图片分类
│   └── contentAudit/         — 内容审核
└── admin-server/
    ├── server.js             — 管理后台服务端
    ├── public/index.html     — 管理后台前端
    └── package.json
```

## 部署指南

### 1. 小程序端

1. 使用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)导入项目
2. 在 `app.js` 中配置云环境 ID
3. 右键 `cloudfunctions/` 下各云函数 → 上传并部署：云端安装依赖

### 2. 云函数密钥配置

在 `cloudfunctions/classifyImage/config.js` 和 `cloudfunctions/contentAudit/config.js` 中填入腾讯云密钥：

```js
module.exports = {
  TENCENT_SECRET_ID: '你的SecretId',
  TENCENT_SECRET_KEY: '你的SecretKey'
};
```

密钥从 [腾讯云 API 密钥管理](https://console.cloud.tencent.com/cam/capi) 获取。

### 3. 管理后台部署

```bash
cd admin-server
npm install

# 配置环境变量
export TCB_SECRET_ID=你的SecretId
export TCB_SECRET_KEY=你的SecretKey
export ADMIN_PASSWORD=管理密码
export PORT=3000

# 使用 PM2 启动
npm install -g pm2
pm2 start server.js --name neighbor-admin
pm2 save
```

访问 `http://服务器IP:3000` 即可使用管理后台。

## 数据库集合

| 集合 | 说明 |
|------|------|
| users | 用户信息（昵称、小区、头像、微信号、联系电话） |
| items | 物品信息（标题、分类、状态、图片、描述） |
| messages | 消息记录（文字、语音、图片） |
| requests | 领取申请（待处理、已通过、已拒绝） |

## 设计规范

- 品牌色：`#1A6EFF`（瑞幸风格蓝）
- 字体：PingFang SC / Microsoft YaHei
- 圆角系统：tag 6px / btn 10px / card 16px / modal 20px
- 阴影系统：sm / md / lg / xl 四级
- 安全区适配：所有页面动态获取状态栏高度

## License

MIT
