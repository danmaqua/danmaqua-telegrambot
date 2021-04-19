Danmaqua Telegram Bot
======

将哔哩哔哩直播间的同传弹幕转发至 Telegram 聊天、频道以便阅读/存档。

**版本 2.x 已经做了大量的改动，请仔细阅读配置文档，如有疑问也可直接联系作者咨询。**

## 已实现的功能

- [x] 通过弹幕源 API 从多个直播平台中获取弹幕数据
  - [x] 支持 Bilibili 弹幕源（依赖 [simon300000/bilibili-live-ws](https://github.com/simon300000/bilibili-live-ws) ）
  - [x] 支持 Douyu 弹幕源（依赖 [flxxyz/douyudm](https://github.com/flxxyz/douyudm) ）
- [x] 将同传弹幕转发到 Telegram 对话/频道
- [x] 每个对话（含频道）配置独立分开，并允许每个对话单独设置管理员
- [x] 使用正则表达式过滤并区分说话人和内容
- [x] 提供黑名单功能屏蔽指定用户的弹幕
- [x] 提供计划任务功能定期切换弹幕房间、定期发送消息到对话
- [x] 访问日志记录
- [x] 通过 HTTP 代理连接 Telegram Bot API
- [x] 提供 Docker 封装镜像

## 如何使用

### 直接订阅已有的同传弹幕记录频道

订阅 Telegram 频道 [@danmaqua](https://t.me/danmaqua) 获取最新同传弹幕记录频道。

同传弹幕频道列表网页版（更新不如 Telegram 及时，但便于阅读）：<https://danmaqua.github.io/bot/userpage.html>

如果你有自己搭建的弹幕记录频道，也欢迎提交到这里。

### 如何运行自己的机器人实例

请认真阅读 [Bot 快速搭建教程](https://danmaqua.github.io/bot/dev.html) 文档，其中包括了全新配置，以及从 Bot v1 版本迁移到 v2 版本的具体教程。

## Contact author

Telegram: [@fython](https://t.me/fython)

## Licenses

GPLv3
