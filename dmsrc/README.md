弹幕源服务
======

danmaqua-telegrambot 2.x 已经开始将弹幕 API 的连接部分分离。

要为 Bot 提供直播弹幕数据，你需要建立一个 WebSocket 服务器，在你的服务器中实现对直播平台的弹幕连接，将直播平台返回的弹幕数据以统一的数据格式向客户端（Bot）提供。

要让 Bot 支持新的弹幕源，你需要修改项目目录的 `bot.config.js` 中的 `danmakuSources` 字段，提供新的弹幕源描述和连接地址。

目前我们已经实现了 Bilibili 和 Douyu 直播平台的弹幕源，并提供了默认配置，你可以开箱即用。

## Bilibili 弹幕源

协议实现依赖于 [simon300000/bilibili-live-ws](https://github.com/simon300000/bilibili-live-ws)

### 使用

你可以在项目目录中执行 `npm run dmsrc:bilibili` 启动。

Bilibili 弹幕源服务器的默认 WebSocket 端口为 8001，要修改 Bilibili 直播弹幕源服务的配置可以打开 `dmsrc.config.js` 进行修改。

如果修改了 WebSocket 端口，你还需要在 `bot.config.js` 中修改客户端配置，Bot 并不会从 `dmsrc.config.js` 中获取服务器配置。

### 其他设置

[simon300000/bilibili-live-ws](https://github.com/simon300000/bilibili-live-ws) 提供了 WebSocket 和 TCP 两种协议来连接到 Bilibili 官方服务器。

你可以根据自己的需求选择一个协议使用，要修改协议配置可以打开 `dmsrc.config.js` 修改 `bilibili.bilibiliProtocol` 字段。

## Douyu 弹幕源

协议实现依赖于 [flxxyz/douyudm](https://github.com/flxxyz/douyudm)

### 使用

你可以在项目目录中执行 `npm run dmsrc:douyu` 启动。

其余设置与 Bilibili 弹幕源服务器类似。
