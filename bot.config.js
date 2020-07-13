module.exports = {
    dataDir: './data',
    dataSaveInterval: 10000,
    logsDir: './data/logs/bot',
    botToken: '',
    botProxy: null,
    botAdmins: [],
    statistics: {
        enabled: false,
        redisServer: '127.0.0.1:6379',
        selectDB: 1
    },
    danmakuSources: [
        {
            id: 'bilibili',
            description: '哔哩哔哩直播弹幕',
            type: 'common-danmaku-ws',
            value: {
                url: 'localhost:8001',
                basicAuth: 'testPassword'
            }
        },
        {
            id: 'douyu',
            description: '斗鱼直播弹幕',
            type: 'common-danmaku-ws',
            value: 'localhost:8002'
        },
        {
            id: 'local',
            description: '本地测试弹幕服务器',
            type: 'common-danmaku-ws',
            value: 'localhost:8003',
            enabled: false
        }
    ]
};
