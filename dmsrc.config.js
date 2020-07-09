module.exports = {
    bilibili: {
        /**
         * Bilibili 弹幕源 WebSocket 端口
         */
        port: 8001,
        /**
         * 弹幕源 WebSocket 的 HTTP Basic Auth 认证，留空（null 或 undefined）可以关闭认证
         */
        basicAuth: 'testPassword',
        /**
         * Bilibili 弹幕连接协议，ws 代表使用 WebSocket 协议，tcp 代表使用 TCP 协议。
         * 协议实现在 https://github.com/simon300000/bilibili-live-ws/blob/master/src/index.ts
         */
        bilibiliProtocol: 'ws',
        /**
         * Bilibili 弹幕房间自动重连计划，使用 CRON 格式
         * 避免长时间弹幕连接没有正确返回数据
         * 留空（null）可以关闭自动重连
         */
        reconnectCron: '0 0 3 * * *'
    },
    douyu: {
        /**
         * Douyu 弹幕源 WebSocket 端口
         */
        port: 8002,
        /**
         * 弹幕源 WebSocket 的 HTTP Basic Auth 认证，留空（null 或 undefined）可以关闭认证
         */
        basicAuth: null,
        /**
         * Douyu 弹幕房间自动重连计划，使用 CRON 格式
         * 避免长时间弹幕连接没有正确返回数据
         * 留空（null）可以关闭自动重连
         */
        reconnectCron: '0 0 3 * * *'
    }
};
