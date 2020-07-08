const botConfig = require('../bot.config');
const settings = require('./settings');

const HttpsProxyAgent = require('https-proxy-agent');
const { DanmakuSourceManager } = require('./api');
const BotWrapper = require('./bot-wrapper');
const Extra = require('telegraf/extra');

class DanmaquaBot extends BotWrapper {
    constructor({ dmSrc, botToken, agent }) {
        super({ botConfig, botToken, agent });
        this.startCommandSimpleMessage = 'Welcome to use danmaqua bot!';
        this.dmSrc = dmSrc;

        this.addCommands([
            {
                command: 'register_chat',
                title: '注册频道',
                description: '让 Bot 将指定直播间的弹幕转发到频道中',
                help: '使用方法：/register\\_chat \\[频道ID] \\[直播间号] \\[弹幕源(可选)]',
                botAdminOnly: true,
                callback: this.onCommandRegisterChat
            },
            {
                command: 'unregister_chat',
                title: '取消注册频道',
                description: '对频道取消绑定弹幕转发',
                help: '使用方法：/unregister\\_chat \\[频道ID]',
                botAdminOnly: true,
                callback: this.onCommandUnregisterChat
            },
            {
                command: 'manage_chats',
                title: '管理频道',
                description: '管理已经绑定了弹幕转发的频道',
                help: '使用方法：/manage\\_chats',
                botAdminOnly: false,
                callback: this.onCommandManageChats
            },
            {
                command: 'set_default_admins',
                title: '设置默认管理员',
                description: '设置各个频道的默认管理员（并非 Bot 管理员）',
                help: '使用方法：/set\\_default\\_admins \\[第一个管理员ID] \\[第二个管理员ID] ...',
                botAdminOnly: true,
                callback: this.onCommandSetDefaultAdmins
            },
            {
                command: 'set_default_pattern',
                title: '设置默认过滤规则',
                description: '设置各个频道的默认过滤规则',
                help: '使用方法：/set\\_default\\_pattern \\[正则表达式]',
                botAdminOnly: true,
                callback: this.onCommandSetDefaultAdmins
            },
            {
                command: 'set_default_source',
                title: '设置默认过滤规则',
                description: '设置各个频道的默认过滤规则',
                help: '使用方法：/set\\_default\\_source \\[正则表达式]',
                botAdminOnly: true,
                callback: this.onCommandSetDefaultSource
            }
        ]);
    }

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

    getManagedChatsConfig = (userId) => {
        const result = [];
        const chatConfigs = settings.getChatConfigs();
        for (let chatId of Object.keys(chatConfigs)) {
            const chatConfig = Object.assign({}, chatConfigs[chatId], { chatId });
            if (this.hasUserPermissionForBot(userId) || chatConfig.admin.indexOf(userId) !== -1) {
                result.push(chatConfig);
            }
        }
        return result;
    };

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
        const userId = ctx.message.from.id;
        const managedChats = [];
        for (let cfg of this.getManagedChatsConfig(userId)) {
            const chat = await this.getChat(cfg.chatId);
            let displayName = '' + chat.id;
            if (chat.title && !chat.username) {
                displayName = chat.title;
            } else if (!chat.title && chat.username) {
                displayName = '@' + chat.username;
            } else if (chat.title && chat.username) {
                displayName = chat.title + ' (@' + chat.username + ')';
            }
            managedChats.push({
                id: chat.id,
                displayName,
            });
        }
        ctx.reply(JSON.stringify(managedChats));
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
