module.exports = {
    dataDir: './data',
    dataSaveInterval: 10000,
    logsDir: './data/logs/bot',
    botToken: '',
    botProxy: null,
    botAdmins: [],
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
        }
    ]
};
