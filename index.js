const HttpsProxyAgent = require('https-proxy-agent');
const { LivePool } = require('./src/livepool');
const { Entities } = require('./src/entities');
const { DanmaquaBot } = require('./src/bot-core');
const Config = require('./config');

if (!Config.botToken) {
    throw new Error('Did you forget to set bot token in config.js?');
}

let agent = null;
if (Config.botProxy) {
    agent = new HttpsProxyAgent(Config.botProxy);
    console.log('Bot is using proxy: ' + Config.botProxy);
}

const livePool = new LivePool();
const entities = Config.dbPath ? Entities.fromFile(Config.dbPath) : Entities.fromMemory();
entities.setDefaultAdmins(Config.defaultAdmins);

const bot = new DanmaquaBot({
    livePool,
    entities,
    botToken: Config.botToken,
    agent
});

livePool.on('danmaku', (room, data) => {
    entities.records.forEach((rec) => {
        if (rec.roomId !== room || rec.isUserBlocked(data.sender.uid)) {
            return;
        }
        if (Config.pattern.test(data.text)) {
            bot.notifyDanmaku(rec.chatId, data, rec.hideUsername).catch((e) => {
                console.log(`Failed to notify ${rec.chatId}: ${e}`);
            });
        }
    });
});
livePool.on('error', (room, e) => {
    console.log('LivePool: onError ' + e);
});

bot.start().then(() => {
    console.log('Bot is launched.');

    entities.records.forEach((record) => {
        console.log(`Registered ${record.roomId} for ${record.chatId}.`);
        livePool.registerRoom(record.roomId);
    });
});
