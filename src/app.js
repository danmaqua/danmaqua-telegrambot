const HttpsProxyAgent = require('https-proxy-agent');
const { LivePool } = require('./livepool');
const { Entities } = require('./entities');
const { DanmaquaBot } = require('./bot-core');

/**
 * 机器人应用类，控制 Telegram Bot 运行、弹幕连接、回调。
 */
class App {
    constructor(config) {
        // 加载应用配置
        this.config = config;

        if (!config.botToken) {
            throw new Error('Did you forget to set bot token in config.js?');
        }

        if (config.botProxy) {
            this.agent = new HttpsProxyAgent(config.botProxy);
            console.log('Bot is using proxy: ' + config.botProxy);
        }

        // 初始化弹幕连接池、数据库
        this.livePool = new LivePool();
        this.entities = config.dbPath ? Entities.fromFile(config.dbPath) : Entities.fromMemory();
        this.entities.setDefaultAdmins(config.defaultAdmins);

        // 初始化 Telegram Bot 实现
        this.bot = new DanmaquaBot({
            livePool: this.livePool,
            entities: this.entities,
            botToken: config.botToken,
            agent: this.agent,
        });

        // 初始化回调
        this.livePool.on('danmaku', this.onDanmaku);
        this.livePool.on('error', this.onError);
    }

    /**
     * 运行机器人应用
     */
    start = async () => {
        await this.bot.start();

        console.log('Bot is launched.');

        this.entities.records.forEach((record) => {
            console.log(`Registered ${record.roomId} for ${record.chatId}.`);
            this.livePool.registerRoom(record.roomId);
        });
    };

    /**
     * 接收到弹幕的回调
     *
     * @param room 房间号
     * @param data 弹幕数据
     */
    onDanmaku = async (room, data) => {
        this.entities.records.forEach((rec) => {
            if (rec.roomId !== room || rec.isUserBlocked(data.sender.uid)) {
                return;
            }
            if (this.config.defaultPattern.test(data.text)) {
                this.bot.notifyDanmaku(rec.chatId, data, rec.hideUsername).catch((e) => {
                    console.log(`Failed to notify ${rec.chatId}: ${e}`);
                });
            }
        });
    };

    /**
     * 弹幕连接错误的回调
     *
     * @param room 房间号
     * @param e 错误
     */
    onError = async (room, e) => {
        console.log('LivePool: onError ' + e);
    };
}

module.exports = App;
