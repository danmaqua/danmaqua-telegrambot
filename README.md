Danmaqua Telegram Bot
======

将哔哩哔哩直播间的同传弹幕转发至 Telegram 聊天、频道以便阅读/存档。

**版本 2.x 已经做了大量的改动，目前文档尚未完成编辑，API 设计也尚未稳定，如有疑问请直接联系作者咨询。**

## How to use

### 直接订阅已有的同传弹幕记录频道

订阅 Telegram 频道 [@danmaqua](https://t.me/danmaqua) 获取最新的同传弹幕记录频道。

如果你有自己搭建的弹幕记录频道，也欢迎提交到这里。

### 运行自己的机器人实例

使用前请保证你的运行环境有 Node.js 12+，并在 Telegram `@BotFather` 申请你自己的机器人。

1. 使用 Git Clone 项目到本地
2. 执行 `npm i` 安装必要的依赖
3. 打开 `dmsrc.config.js` 配置文件，按照文件内注释配置好弹幕源服务器
4. 执行 `npm run dmsrc:bilibili` 启动 Bilibili 弹幕源，如果你还需要使用 Douyu 弹幕源，还可以执行 `npm run dmsrc:douyu`
5. 打开 `bot.config.js` 配置文件，按照文件内注释配置好数据库路径、机器人 Token、管理员等
6. 执行 `npm run bot` 启动机器人

我们推荐使用 [PM2](https://pm2.keymetrics.io/) 来对你的服务进程进行管理，同时它也可以设置定期重启。

以开启弹幕源服务进程和机器人本体进程为例，不包括定期重启参数：

```bash
# 安装 PM2
npm i -g pm2
# 同时启动弹幕源服务进程和机器人本体进程
pm2 start ecosystem.config.js
# 查看机器人本体进程日志输出
pm2 logs danmaqua-bot
# 查看 Bilibili 弹幕源进程日志输出
pm2 logs dmsrc-bilibili
# 设置 PM2 开机自启（不支持 Windows）
pm2 startup
# 保存当前进程列表，下次系统自启时自动启动进程
pm2 save
```

## Contact author

Telegram: [@fython](https://t.me/fython)

## Licenses

GPLv3
