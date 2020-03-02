const HttpsProxyAgent = require('https-proxy-agent');
const { LivePool } = require('./livepool');
const { Entities } = require('./entities');
const { DanmaquaBot } = require('./bot-core');

class App {
    constructor(config) {
        this.config = config;

        if (!config.botToken) {
            throw new Error('Did you forget to set bot token in config.js?');
        }

        if (config.botProxy) {
            this.agent = new HttpsProxyAgent(config.botProxy);
            console.log('Bot is using proxy: ' + config.botProxy);
        }

        this.livePool = new LivePool();
        this.entities = config.dbPath ? Entities.fromFile(config.dbPath) : Entities.fromMemory();
        this.entities.setDefaultAdmins(config.defaultAdmins);

        this.bot = new DanmaquaBot({
            livePool: this.livePool,
            entities: this.entities,
            botToken: config.botToken,
            agent: this.agent,
        });

        this.livePool.on('danmaku', this.onDanmaku);
        this.livePool.on('error', this.onError);
    }

    start = async () => {
        await this.bot.start();

        console.log('Bot is launched.');

        this.entities.records.forEach((record) => {
            console.log(`Registered ${record.roomId} for ${record.chatId}.`);
            this.livePool.registerRoom(record.roomId);
        });
    };

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

    onError = async (room, e) => {
        console.log('LivePool: onError ' + e);
    };
}

module.exports = App;
