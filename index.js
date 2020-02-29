const Telegraf = require('telegraf');
const HttpsProxyAgent = require('https-proxy-agent');
const { LivePool } = require('./src/livepool');
const { Entities } = require('./src/entities');
const TeleUtils = require('./src/telegram-utils');
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
const entities = new Entities();
const bot = new Telegraf(Config.botToken, { telegram: { agent } });
let botUser = {};

bot.start((ctx) => {
    ctx.reply('欢迎使用 Danmaqua Bot！');
});

bot.command('subscribe', async (ctx) => {
    let [_, roomId, targetChatId] = ctx.message.text.split(' ');
    if (!roomId) {
        ctx.reply('订阅房间命令格式：`/subscribe [房间号]`', {parse_mode: 'MarkdownV2'});
        return;
    }
    roomId = parseInt(roomId);
    if (roomId <= 0) {
        ctx.reply('要订阅的房间号必须大于 0。');
        return;
    }
    targetChatId = parseInt(targetChatId || ctx.chat.id);
    const canSend = await TeleUtils.canSendMessageToChat(ctx.telegram, targetChatId, botUser.id);
    if (!canSend) {
        ctx.reply('你指定的目标不允许机器人发送消息，请检查机器人是否被禁言和是否未加入聊天。');
        return;
    }

    const record = entities.getRecord(targetChatId);
    if (record != null) {
        if (record.roomId === roomId) {
            ctx.reply('你已订阅这个房间了。');
            return;
        }
        livePool.unregisterRoom(record.roomId);
    }
    entities.recordSubscribe(targetChatId, roomId);
    livePool.registerRoom(roomId);
    ctx.reply(`订阅 ${roomId} 成功。`);
});

bot.command('unsubscribe', async (ctx) => {
    let [_, targetChatId] = ctx.message.text.split(' ');
    targetChatId = parseInt(targetChatId || ctx.chat.id);
    const canSend = await TeleUtils.canSendMessageToChat(ctx.telegram, targetChatId, botUser.id);
    if (!canSend) {
        ctx.reply('你指定的目标不允许机器人发送消息，请检查机器人是否被禁言和是否未加入聊天。');
        return;
    }

    const record = entities.getRecord(targetChatId);
    if (record == null) {
        ctx.reply('你未订阅任何房间。');
        return;
    }
    livePool.unregisterRoom(record.roomId);
    entities.deleteRecord(targetChatId);
    ctx.reply(`已取消订阅 ${record.roomId} 房间。`);
});

livePool.on('danmaku', (room, data) => {
    console.log(`${room} : ${data}`);
    for (let key in entities.records) {
        const rec = entities.records[key];
        if (rec.roomId !== room) {
            continue;
        }
        if (Config.pattern.test(data.text)) {
            let msg = `[${data.sender.username}](https://space.bilibili.com/${data.sender.uid})`;
            msg += ': ';
            msg += data.text;
            bot.telegram.sendMessage(rec.chatId, msg, {
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
                disable_notification: true
            });
        }
    }
});

bot.launch();
bot.telegram.getMe().then((user) => botUser = user);
