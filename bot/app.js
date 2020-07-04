const botConfig = require('../bot.config');
const settings = require('./settings');

const HttpsProxyAgent = require('https-proxy-agent');
const { DanmakuSourceManager } = require('./api');
const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');

class DanmaquaBot {
    constructor({ dmSrc, botToken, agent }) {
        this.dmSrc = dmSrc;
        this.bot = new Telegraf(botToken, { telegram: { agent } });

        this.bot.start(this.onCommandStart);
        this.bot.command('register_chat',
            this.checkUserPermissionForBot, this.onCommandRegisterChat);
        this.bot.command('unregister_chat',
            this.checkUserPermissionForBot, this.onCommandUnregisterChat);
        this.bot.command('manage_chats',
            this.onCommandManageChats);
        this.bot.command('set_default_pattern',
            this.checkUserPermissionForBot, this.onCommandSetDefaultPattern);
        this.bot.command('set_default_admins',
            this.checkUserPermissionForBot, this.onCommandSetDefaultAdmins);
        this.bot.command('set_default_source',
            this.checkUserPermissionForBot, this.onCommandSetDefaultSource);
    }

    start = async () => {
        console.log('Bot is launching...');
        while (!this.botUser) {
            try {
                this.botUser = await this.bot.telegram.getMe();
            } catch (e) {
                console.error(e);
            }
        }
        return await this.bot.launch();
    };

    notifyDanmaku = async (chatId, data, { hideUsername = false }) => {
        let msg = '';
        if (!hideUsername) {
            const url = data.sender.url + '#' + data.sourceId + '_' + data.sender.uid;
            msg += `<a href="${url}">${data.sender.username}</a>：`;
        }
        msg += data.text;
        const extras = Extra.HTML().webPreview(false).notifications(false);
        return await this.bot.telegram.sendMessage(chatId, msg, extras);
    };

    getChat = async (chatId) => {
        try {
            return await this.bot.telegram.getChat(chatId);
        } catch (e) {
            return null;
        }
    };

    hasUserPermissionForBot = (id) => {
        return botConfig.botAdmins.indexOf(id) !== -1;
    };

    hasPermissionForChat = (id, chatId) => {
        return botConfig.botAdmins.indexOf(id) !== -1 ||
            settings.getChatConfig(chatId).admin.indexOf(id) !== -1;
    };

    canSendMessageToChat = async (chatId) => {
        try {
            let member = await this.bot.telegram.getChatMember(chatId, this.botUser.id);
            return member.status === 'member' || member.status === 'administrator' || member.status === 'creator';
        } catch (ignored) {
        }
        return false;
    };

    checkUserPermissionForBot = async (ctx, next) => {
        if (!this.hasUserPermissionForBot(ctx.message.from.id)) {
            ctx.reply('No permission for bot');
            return;
        }
        await next();
    };

    checkUserPermissionForChat = (chatId) => {
        return async (ctx, next) => {
            if (!this.hasPermissionForChat(ctx.message.from.id, chatId)) {
                ctx.reply('No permission for chat');
                return;
            }
            await next();
        };
    };

    onCommandStart = async (ctx) => {
        return ctx.reply('Welcome to use danmaqua bot!');
    };

    onCommandHelp = async (ctx) => {
        return ctx.reply('TODO!');
    }

    onCommandRegisterChat = async (ctx) => {
        let [_, chatId, roomId, source] = ctx.message.text.split(' ');
        if (!chatId) {
            ctx.reply('Register chat command usage: /register_chat chatId roomId [source]');
            return;
        }
        if (!roomId) {
            ctx.reply('Please input room id!');
            return;
        }
        if (isNaN(Number(roomId))) {
            ctx.reply('Room ID should be number.');
            return;
        }
        if (source && !settings.danmakuSources.find((value) => value.id === source)) {
            ctx.reply(`Danmaku source ${source} isn't supported.`);
            return;
        }
        const targetChat = await this.getChat(chatId || ctx.chat.id);
        const canSend = targetChat != null && await this.canSendMessageToChat(targetChat.id);
        if (!canSend) {
            ctx.reply('Bot is not allowed to send messages to chat id=' + targetChat.id);
            return;
        }
        chatId = targetChat.id;
        roomId = Number(roomId);
        const curRoomId = settings.getChatConfig(chatId).roomId;
        const curDanmakuSource = settings.getChatConfig(chatId).danmakuSource;
        if (curRoomId !== roomId || curDanmakuSource !== source) {
            if (curRoomId) {
                this.dmSrc.leaveRoom(curDanmakuSource, curRoomId);
            }
            settings.setChatRoomId(chatId, roomId);
            settings.setChatDanmakuSource(chatId, source);
            this.dmSrc.joinRoom(settings.getChatConfig(chatId).danmakuSource, roomId);
        }
        ctx.reply(
            `Chat [id=${targetChat.id}] is registered to danmaku source ` +
            `${settings.getChatConfig(chatId).danmakuSource}:${roomId}`
        );
    };

    onCommandUnregisterChat = async (ctx) => {
        let [_, chatId] = ctx.message.text.split(' ');
        if (!chatId) {
            ctx.reply('Unregister chat command usage: /unregister_chat chatId');
            return;
        }
        const targetChat = await this.getChat(chatId || ctx.chat.id);
        if (!targetChat) {
            ctx.reply('Cannot find this chat!');
            return;
        }
        chatId = targetChat.id;
        const regRoomId = settings.getChatConfig(chatId).roomId;
        const regSource = settings.getChatConfig(chatId).danmakuSource;
        if (!regRoomId) {
            ctx.reply('This chat didn\'t register any danmaku source.');
            return;
        }
        settings.unsetChatRoomId(chatId);
        this.dmSrc.leaveRoom(regSource, regRoomId);
        ctx.reply(`Chat [id=${targetChat.id}] has been unregistered.`);
    };

    onCommandManageChats = async (ctx) => {
        ctx.reply('TODO!');
    };

    onCommandSetDefaultPattern = async (ctx) => {
        let [_, pattern] = ctx.message.text.split(' ');
        if (!pattern) {
            ctx.reply('Please input default pattern.', Extra.markdown());
            return;
        }
        try {
            new RegExp(pattern);
            settings.setGlobalPattern(pattern);
            ctx.reply('Set default pattern successfully!');
        } catch (e) {
            ctx.reply('Failed to set default pattern. Error: ' + e);
        }
    };

    onCommandSetDefaultAdmins = async (ctx) => {
        const admins = ctx.message.text.split(' ')
            .slice(1)
            .map((value) => Number(value))
            .filter((value) => Number.isNaN(value));
        settings.setGlobalAdmin(admins);
        ctx.reply('Set default admins to `' + admins.toString() + '`', Extra.markdown());
    }

    onCommandSetDefaultSource = async (ctx) => {
        let [_, newSrc] = ctx.message.text.split(' ');
        if (!newSrc) {
            const sources = settings.danmakuSources
                .map((value) => value.id)
                .reduce((a, b) => a + ', ' + b);
            ctx.reply('Available danmaku sources: ' + sources);
            return;
        }
        if (settings.danmakuSources.find((value) => value.id === newSrc)) {
            settings.setGlobalDanmakuSource(newSrc);
            ctx.reply('Set default danmaku source to ' + newSrc + ' successfully.');
        } else {
            ctx.reply('Cannot find danmaku source by id=' + newSrc);
        }
    }
}

class Application {
    constructor() {
        settings.init(botConfig, true);
        this.dmSrc = new DanmakuSourceManager();
        this.agent = null;
        if (botConfig.botProxy) {
            this.agent = new HttpsProxyAgent(botConfig.botProxy);
            console.log('Bot is using proxy: ', botConfig.botProxy);
        }
        this.bot = new DanmaquaBot({
            dmSrc: this.dmSrc,
            botToken: botConfig.botToken,
            agent: this.agent
        });
        this.dmSrc.on('danmaku', (danmaku) => this.onReceiveDanmaku(danmaku));
        this.dmSrc.on('connect', (source) => this.onConnectDMSource(source));
    }

    onReceiveDanmaku(danmaku) {
        if (!this.bot.botUser) {
            return;
        }
        for (let chatId of Object.keys(settings.chatsConfig)) {
            let chatConfig = settings.chatsConfig[chatId];
            if (chatConfig.roomId) {
                chatConfig = settings.getChatConfig(chatId);
                if (danmaku.sourceId === chatConfig.danmakuSource && danmaku.roomId === chatConfig.roomId) {
                    const reg = new RegExp(chatConfig.pattern);
                    if (reg.test(danmaku.text)) {
                        const opts = { hideUsername: chatConfig.hideUsername };
                        this.bot.notifyDanmaku(chatId, danmaku, opts).catch((e) => {
                            console.error(`Failed to notify ${chatId}: `, e);
                        });
                    }
                }
            }
        }
    }

    onConnectDMSource(source) {
        for (let chatId of Object.keys(settings.chatsConfig)) {
            let chatConfig = settings.chatsConfig[chatId];
            if (chatConfig.roomId) {
                chatConfig = settings.getChatConfig(chatId);
                if (source.id === chatConfig.danmakuSource) {
                    this.dmSrc.joinRoom(chatConfig.danmakuSource, chatConfig.roomId);
                }
            }
        }
    }

    startBot() {
        this.bot.start().then(() => {
            console.log('Bot is launched. Username: @' + this.bot.botUser.username);
        }).catch((err) => {
            console.error(err);
        });
    }
}

if (!botConfig.botToken || botConfig.botToken.length === 0) {
    throw new Error('Please set bot token in bot.config.js!');
}
if (!botConfig.botAdmins || botConfig.botAdmins.length === 0) {
    throw new Error('Please set bot administrators id in bot.config.js!');
}
new Application().startBot();
