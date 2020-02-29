const Telegraf = require('telegraf');
const HttpsProxyAgent = require('https-proxy-agent');
const { LivePool } = require('./src/livepool');
const { Entities } = require('./src/entities');
const Messages = require('./src/messages');
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
const entities = Config.dbPath ? Entities.fromFile(Config.dbPath) : Entities.fromMemory();
entities.setDefaultAdmins(Config.defaultAdmins);

const bot = new Telegraf(Config.botToken, { telegram: { agent } });
let botUser = {};

bot.start((ctx) => {
    ctx.reply(Messages.WELCOME_MSG, {parse_mode: 'MarkdownV2'});
});

bot.command('help', (ctx) => {
   ctx.reply(Messages.HELP_MSG, {parse_mode: 'MarkdownV2'});
});

bot.command('subscribe', async (ctx) => {
    if (!entities.isUserAllowedSet(ctx.message.from.id)) {
        ctx.reply('很抱歉，你无法设置这个机器人，请联系这个机器人的管理员进行添加权限。');
        return;
    }
    let [_, roomId, targetChatId] = ctx.message.text.split(' ');
    if (!roomId) {
        ctx.reply('订阅房间命令格式：`/subscribe [房间号] [目标聊天 ID]`\n' +
            '目标聊天 ID 为选填，如不填将以当前聊天作为弹幕通知目标。', {parse_mode: 'MarkdownV2'});
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
    if (!entities.isUserAllowedSet(ctx.message.from.id)) {
        ctx.reply('很抱歉，你无法设置这个机器人，请联系这个机器人的管理员进行添加权限。');
        return;
    }
    let [_, targetChatId] = ctx.message.text.split(' ');
    targetChatId = parseInt(targetChatId || ctx.chat.id);
    const canSend = await TeleUtils.canSendMessageToChat(ctx.telegram, targetChatId, botUser.id);
    if (!canSend) {
        ctx.reply('你指定的目标不允许机器人发送消息，请检查机器人是否被禁言和是否未加入聊天。');
        return;
    }

    const record = entities.getRecord(targetChatId);
    if (record == null) {
        ctx.reply(`你未在 ${targetChatId} 订阅任何房间。`);
        return;
    }
    livePool.unregisterRoom(record.roomId);
    entities.deleteRecord(targetChatId);
    ctx.reply(`已取消订阅 ${record.roomId} 房间。`);
});

bot.command('set_hide_username', async (ctx) => {
    if (!entities.isUserAllowedSet(ctx.message.from.id)) {
        ctx.reply('很抱歉，你无法设置这个机器人，请联系这个机器人的管理员进行添加权限。');
        return;
    }
    let [_, targetChatId] = ctx.message.text.split(' ');
    targetChatId = parseInt(targetChatId || ctx.chat.id);
    const canSend = await TeleUtils.canSendMessageToChat(ctx.telegram, targetChatId, botUser.id);
    if (!canSend) {
        ctx.reply('你指定的目标不允许机器人发送消息，请检查机器人是否被禁言和是否未加入聊天。');
        return;
    }

    const record = entities.getRecord(targetChatId);
    if (record == null) {
        ctx.reply(`你未在 ${targetChatId} 订阅任何房间。`);
        return;
    }
    record.hideUsername = !record.hideUsername;
    entities.setRecord(record);
    ctx.reply(`现在 ${targetChatId} ` + (record.hideUsername ? '不再' : '将') + '显示发送弹幕的用户名。');
});

livePool.on('danmaku', (room, data) => {
    console.log(`${room} : ${data}`);
    for (let key in entities.records) {
        if (!entities.records.hasOwnProperty(key)) {
            continue;
        }
        const rec = entities.records[key];
        if (rec.roomId !== room) {
            continue;
        }
        if (Config.pattern.test(data.text)) {
            let msg = '';
            if (!rec.hideUsername) {
                msg += `[${data.sender.username}](https://space.bilibili.com/${data.sender.uid})`;
                msg += ': ';
            }
            msg += data.text;
            bot.telegram.sendMessage(rec.chatId, msg.replace('-', '\\-'), {
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
                disable_notification: true
            });
        }
    }
});

bot.launch();

console.log('Bot has been launched.');

bot.telegram.getMe().then((user) => botUser = user);

entities.records.forEach((record) => {
    console.log(`Registered ${record.roomId} for ${record.chatId}.`);
    livePool.registerRoom(record.roomId);
});
