const botConfig = require('../bot.config');
const settings = require('./settings');

const HttpsProxyAgent = require('https-proxy-agent');
const { DanmakuSourceManager } = require('./api');
const BotWrapper = require('./bot-wrapper');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');

const MANAGE_PAGE_MAX_ITEMS = 4;
const USER_STATE_CODE_CHAT_CHANGE_DANMAKU_SRC = 1;
const USER_STATE_CODE_CHAT_CHANGE_PATTERN = 2;
const USER_STATE_CODE_CHAT_CHANGE_ADMIN = 3;
const USER_STATE_CODE_CHAT_CHANGE_BLOCK_USERS = 4;

class DanmaquaBot extends BotWrapper {
    constructor({ dmSrc, botToken, agent }) {
        super({ botConfig, botToken, agent });
        this.startCommandSimpleMessage = '欢迎使用 Danmaqua Bot！';
        this.dmSrc = dmSrc;

        this.addCommands([
            {
                command: 'list_dm_src',
                title: '查询支持的弹幕源',
                description: '查看 Bot 支持哪些直播平台的弹幕源',
                help: '使用方法： /list\\_dm\\_src',
                botAdminOnly: false,
                callback: this.onCommandListDMSrc
            },
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
                description: '列出已经绑定了弹幕转发的频道，并进行选择管理',
                help: '使用方法：/manage\\_chats',
                botAdminOnly: false,
                callback: this.onCommandManageChats
            },
            {
                command: 'manage_chat',
                title: '管理指定的频道',
                description: '管理指定的已绑定弹幕转发的频道',
                help: '使用方法：/manage\\_chat \\[频道ID]',
                botAdminOnly: false,
                callback: this.onCommandManageChat
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
                callback: this.onCommandSetDefaultPattern
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

        this.bot.command('cancel', this.onCommandCancel);
        this.bot.action(/manage_chat:([-\d]+)/, this.onActionManageChat);
        this.bot.action(/manage_chats_pages:(\d+)/, this.onActionManageChatsPages);
        this.bot.action(/change_danmaku_src:([-\d]+)/, this.onActionChangeDanmakuSrc);
        this.bot.action(/change_pattern:([-\d]+)/, this.onActionChangePattern);
        this.bot.action(/change_admin:([-\d]+)/, this.onActionChangeAdmin);
        this.bot.action(/change_blocked_users:([-\d]+)/, this.onActionChangeBlockedUsers);
        this.bot.action(/block_user:([-\d]+):([-_a-zA-Z\d]+)/, this.onActionBlockUser);
        this.bot.on('message', this.onMessage);
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

    getManagedChatsCount = (userId) => {
        let count = 0;
        const chatConfigs = settings.getChatConfigs();
        for (let chatId of Object.keys(chatConfigs)) {
            const chatConfig = Object.assign({}, chatConfigs[chatId], { chatId });
            if (this.hasUserPermissionForBot(userId) || chatConfig.admin.indexOf(userId) !== -1) {
                count++;
            }
        }
        return count;
    }

    getManagedChatsPageCount = (userId) => {
        return Math.ceil(this.getManagedChatsCount(userId) / MANAGE_PAGE_MAX_ITEMS);
    }

    getManagedChatsConfigByPage = (userId, page) => {
        const chatConfigs = this.getManagedChatsConfig(userId);
        const minIndex = page * MANAGE_PAGE_MAX_ITEMS;
        const maxIndex = minIndex + MANAGE_PAGE_MAX_ITEMS;
        return chatConfigs.filter((v, index) => index >= minIndex && index < maxIndex);
    };

    onMessage = async (ctx) => {
        if (ctx.message.forward_from_chat) {
            if (await this.onForwardMessageFromChat(ctx)) {
                return;
            }
        }
        const userId = ctx.message.from.id;
        const stateCode = settings.getUserStateCode(userId);
        const stateData = settings.getUserStateData(userId);
        if (stateCode === USER_STATE_CODE_CHAT_CHANGE_DANMAKU_SRC) {
            this.onAnswerChangeDanmakuSrc(ctx, stateData);
        } else if (stateCode === USER_STATE_CODE_CHAT_CHANGE_PATTERN) {
            this.onAnswerChangePattern(ctx, stateData);
        } else if (stateCode === USER_STATE_CODE_CHAT_CHANGE_ADMIN) {
            this.onAnswerChangeAdmin(ctx, stateData);
        } else if (stateCode === USER_STATE_CODE_CHAT_CHANGE_BLOCK_USERS) {
            this.onAnswerChangeBlockedUsers(ctx, stateData);
        }
    };

    onForwardMessageFromChat = async (ctx) => {
        const chatId = ctx.message.forward_from_chat.id;
        if (!ctx.message.text || ctx.message.chat.type !== 'private') {
            return;
        }
        if (!this.hasPermissionForChat(ctx.message.from.id, chatId)) {
            ctx.reply('你没有这个对话的管理权限。');
            return;
        }
        if (!settings.getChatConfig(chatId)) {
            ctx.reply('这个对话没有在 Bot 注册。');
            return;
        }
        // 提取弹幕中的用户信息，如果没有则提示错误
        let username = null;
        let uid = 0;
        if (ctx.message.entities.length === 1) {
            const firstEntity = ctx.message.entities[0];
            if (firstEntity.type === 'text_link') {
                const [_, result] = firstEntity.url.split('#');
                if (result && result.indexOf('_') >= 0) {
                    uid = result;
                    username = ctx.message.text.substr(firstEntity.offset, firstEntity.length);
                }
            }
        }
        if (!username) {
            ctx.reply('这条消息无法寻找到弹幕用户信息。');
            return;
        }
        ctx.reply('你要对这条弹幕进行什么操作：', Extra.inReplyTo(ctx.message.message_id)
            .markup(Markup.inlineKeyboard([
                Markup.callbackButton(
                    `屏蔽用户：${username}（${uid}）`,
                    `block_user:${chatId}:${uid}`
                )
            ])));
    };

    onActionBlockUser = async (ctx) => {
        const actionUser = ctx.update.callback_query.from;
        const chatId = ctx.match[1];
        const uid = ctx.match[2];
        if (!this.hasPermissionForChat(actionUser.id, chatId)) {
            return await ctx.answerCbQuery('你没有权限设置这个对话。', true);
        }
        if (!settings.getChatConfig(chatId)) {
            return await ctx.answerCbQuery('这个对话没有在 Bot 中注册。', true);
        }
        const isBlocked = settings.containsChatBlockedUser(chatId, uid);
        if (isBlocked) {
            settings.removeChatBlockedUsers(chatId, uid);
        } else {
            settings.addChatBlockedUsers(chatId, uid);
        }
        return await ctx.answerCbQuery(
            '用户 ' + uid + ' 已在对话 ' + chatId + ' 中被' + (isBlocked ? '解除屏蔽' : '屏蔽'),
            true
        );
    };

    onCommandRegisterChat = async (ctx) => {
        let [_, chatId, roomId, source] = ctx.message.text.split(' ');
        if (!chatId) {
            ctx.reply('注册命令使用方法：/register_chat `chatId` `roomId` `\\[source]`', Extra.markdown());
            return;
        }
        if (!roomId) {
            ctx.reply('请输入房间号！');
            return;
        }
        if (isNaN(Number(roomId))) {
            ctx.reply('房间号必须是数字。');
            return;
        }
        if (source && !settings.danmakuSources.find((value) => value.id === source)) {
            ctx.reply(`弹幕源 ${source} 不受支持。`);
            return;
        }
        const targetChat = await this.getChat(chatId || ctx.chat.id);
        const canSend = targetChat != null && await this.canSendMessageToChat(targetChat.id);
        if (!canSend) {
            ctx.reply('Bot 不被允许发送消息到对话 id=' + targetChat.id);
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
            `对话 id=${targetChat.id} 已被注册到弹幕源 ` +
            `${settings.getChatConfig(chatId).danmakuSource}:${roomId}`
        );
    };

    onCommandUnregisterChat = async (ctx) => {
        let [_, chatId] = ctx.message.text.split(' ');
        if (!chatId) {
            ctx.reply('取消注册命令使用方法：/unregister_chat `chatId`', Extra.markdown());
            return;
        }
        const targetChat = await this.getChat(chatId || ctx.chat.id);
        if (!targetChat) {
            ctx.reply('无法找到这个对话。');
            return;
        }
        chatId = targetChat.id;
        const regRoomId = settings.getChatConfig(chatId).roomId;
        const regSource = settings.getChatConfig(chatId).danmakuSource;
        if (!regRoomId) {
            ctx.reply('这个对话未注册任何弹幕源。');
            return;
        }
        settings.unsetChatRoomId(chatId);
        this.dmSrc.leaveRoom(regSource, regRoomId);
        ctx.reply(`对话 id=${targetChat.id} 已成功取消注册。`);
    };

    createManageChatsMessageKeyboard = async (userId, page) => {
        const buttons = [];
        for (let cfg of this.getManagedChatsConfigByPage(userId, page)) {
            const chat = await this.getChat(cfg.chatId);
            let displayName = '' + chat.id;
            if (chat.title && !chat.username) {
                displayName = chat.title;
            } else if (!chat.title && chat.username) {
                displayName = '@' + chat.username;
            } else if (chat.title && chat.username) {
                displayName = chat.title + ' (@' + chat.username + ')';
            }
            buttons.push([Markup.callbackButton(displayName, 'manage_chat:' + chat.id)]);
        }
        const pageButtons = [];
        const pageCount = this.getManagedChatsPageCount(userId);
        pageButtons.push(Markup.callbackButton('第' + (page+1) + '/' + pageCount + '页', 'noop'));
        if (page > 0) {
            pageButtons.push(Markup.callbackButton('上一页', 'manage_chats_pages:' + (page - 1)));
        }
        if (page < pageCount - 1) {
            pageButtons.push(Markup.callbackButton('下一页', 'manage_chats_pages:' + (page + 1)))
        }
        if (pageButtons.length > 1) {
            buttons.push(pageButtons);
        }
        return Markup.inlineKeyboard(buttons);
    };

    onCommandManageChats = async (ctx) => {
        const userId = ctx.message.from.id;
        ctx.reply(
            '请选择你要管理的频道：\n如果你要找的频道没有显示，可能是你的账号没有权限。',
            Extra.markup(await this.createManageChatsMessageKeyboard(userId, 0))
        );
    };

    onActionManageChatsPages = async (ctx) => {
        const userId = ctx.update.callback_query.from.id;
        const targetPage = parseInt(ctx.match[1]);
        if (targetPage >= 0 && targetPage < this.getManagedChatsPageCount(userId)) {
            await ctx.editMessageReplyMarkup(await this.createManageChatsMessageKeyboard(userId, targetPage));
            return await ctx.answerCbQuery();
        } else {
            return await ctx.answerCbQuery('你选择的页数 ' + targetPage + ' 不存在。', true);
        }
    };

    onActionManageChat = async (ctx) => {
        const targetChatId = parseInt(ctx.match[1]);
        this.requestManageChat(ctx, targetChatId);
        return await ctx.answerCbQuery();
    };

    requestManageChat = async (ctx, chatId) => {
        const chat = await this.getChat(chatId);
        let displayName = '' + chat.id;
        if (chat.title && !chat.username) {
            displayName = chat.title;
        } else if (!chat.title && chat.username) {
            displayName = '@' + chat.username;
        } else if (chat.title && chat.username) {
            displayName = chat.title + ' (@' + chat.username + ')';
        }
        const msgText = `你想要修改频道 “${displayName}” (id: ${chat.id}) 的什么设置？`;
        ctx.reply(msgText, Extra.markup(Markup.inlineKeyboard([
            [
                Markup.callbackButton('房间号/弹幕源', 'change_danmaku_src:' + chat.id),
                Markup.callbackButton('过滤规则', 'change_pattern:' + chat.id),
                Markup.callbackButton('管理员', 'change_admin:' + chat.id)
            ],
            [Markup.callbackButton('已屏蔽的用户', 'change_blocked_users:' + chat.id)]
        ])));
    };

    onActionChangeDanmakuSrc = async (ctx) => {
        const targetChatId = parseInt(ctx.match[1]);
        settings.setUserState(ctx.update.callback_query.from.id,
            USER_STATE_CODE_CHAT_CHANGE_DANMAKU_SRC,
            targetChatId);
        ctx.reply('你正在编辑 id=' + targetChatId + ' 的弹幕房间号/弹幕源，' +
            '如果你只需要修改房间号，回复房间号即可。\n' +
            '如果你需要修改弹幕源，请按格式回复：`[房间号] [弹幕源]` 。' +
            '例如需要使用斗鱼 10 号房间弹幕，则回复：`10 douyu`\n\n' +
            '当前设置：房间号=`' + settings.getChatConfig(targetChatId).roomId +
            '`, 弹幕源=`' + settings.getChatConfig(targetChatId).danmakuSource + '`\n' +
            '回复 /cancel 退出互动式对话。', Extra.markdown());
        return await ctx.answerCbQuery();
    };

    onActionChangePattern = async (ctx) => {
        const targetChatId = parseInt(ctx.match[1]);
        settings.setUserState(ctx.update.callback_query.from.id,
            USER_STATE_CODE_CHAT_CHANGE_PATTERN,
            targetChatId);
        ctx.reply('你正在编辑 id=' + targetChatId + ' 的过滤规则，' +
            '符合过滤规则正则表达式的弹幕内容将会被转发到指定 id 的对话/频道中。\n\n' +
            '当前设置：`' + settings.getChatConfig(targetChatId).pattern + '`\n' +
            '回复 /cancel 退出互动式对话。', Extra.markdown());
        return await ctx.answerCbQuery();
    };

    onActionChangeAdmin = async (ctx) => {
        if (!this.hasUserPermissionForBot(ctx.update.callback_query.from.id)) {
            return await ctx.answerCbQuery('很抱歉，这项操作只有 Bot 管理员可以使用。', true);
        }
        const targetChatId = parseInt(ctx.match[1]);
        settings.setUserState(ctx.update.callback_query.from.id,
            USER_STATE_CODE_CHAT_CHANGE_ADMIN,
            targetChatId);
        ctx.reply('你正在编辑 id=' + targetChatId + ' 的管理员列表，' +
            '管理员可以对该频道修改\n\n' +
            '当前设置：`' + settings.getChatConfig(targetChatId).admin + '`\n' +
            '回复 /cancel 退出互动式对话。', Extra.markdown());
        return await ctx.answerCbQuery();
    };

    onActionChangeBlockedUsers = async (ctx) => {
        const targetChatId = parseInt(ctx.match[1]);
        const message = await ctx.reply(this.getChangeBlockedUsersMessageText(targetChatId), Extra.markdown());

        settings.setUserState(ctx.update.callback_query.from.id,
            USER_STATE_CODE_CHAT_CHANGE_BLOCK_USERS,
            {
                targetChatId,
                chatId: message.chat.id,
                messageId: message.message_id
            });
    };

    getChangeBlockedUsersMessageText = (chatId) => {
        let blockedUsers = settings.getChatBlockedUsers(chatId)
            .map(({src, uid}) => src + '_' + uid);
        if (blockedUsers.length > 0) {
            blockedUsers = blockedUsers.reduce((t, next) => t + ', ' + next);
        } else {
            blockedUsers = '空';
        }
        return '你正在编辑 id=' + chatId + ' 的屏蔽用户列表，' +
            '被屏蔽的用户弹幕不会被转发到对话中。\n' +
            '输入 `add [弹幕源] [用户id]` 可以添加屏蔽用户，输入 `del [弹幕源] [用户id]` 可以解除屏蔽用户。' +
            '例如：输入 `add bilibili 100` 可以屏蔽 bilibili 弹幕源 id 为 100 的用户。\n\n' +
            '当前已被屏蔽的用户：\n`' + blockedUsers + '`\n' +
            '回复 /cancel 完成屏蔽修改并退出互动式对话。';
    };

    onAnswerChangeDanmakuSrc = async (ctx, chatId) => {
        let [roomId, srcId] = ctx.message.text.split(' ');
        if (isNaN(roomId)) {
            ctx.reply('你输入的房间号不是合法的数字。', Extra.inReplyTo(ctx.message.message_id));
            return;
        }
        roomId = Number(roomId);
        if (srcId) {
            const src = settings.getDanmakuSource(srcId);
            if (!src) {
                ctx.reply('你输入的弹幕源不是合法的弹幕源，你可以输入 /list_dm_src 进行查询。',
                    Extra.inReplyTo(ctx.message.message_id));
                return;
            }
        }
        const curRoomId = settings.getChatConfig(chatId).roomId;
        const curDanmakuSource = settings.getChatConfig(chatId).danmakuSource;
        if (curRoomId !== roomId || curDanmakuSource !== srcId) {
            if (curRoomId) {
                this.dmSrc.leaveRoom(curDanmakuSource, curRoomId);
            }
            settings.setChatRoomId(chatId, roomId);
            settings.setChatDanmakuSource(chatId, srcId);
            this.dmSrc.joinRoom(settings.getChatConfig(chatId).danmakuSource, roomId);
        }
        const newDanmakuSource = settings.getChatConfig(chatId).danmakuSource;
        ctx.reply(`已成功为 id=${chatId} 频道注册了 ${newDanmakuSource}:${roomId} 房间弹幕转发。`);
        settings.clearUserState(ctx.message.from.id);
    };

    onAnswerChangePattern = async (ctx, chatId) => {
        let pattern = ctx.message.text;
        if (!pattern) {
            ctx.reply('请输入过滤规则正则表达式。', Extra.markdown());
            return;
        }
        try {
            new RegExp(pattern);
            settings.setChatPattern(chatId, pattern);
            ctx.reply(`已成功为 id=${chatId} 频道设置了过滤规则：\`${pattern}\``, Extra.markdown());
            settings.clearUserState(ctx.message.from.id);
        } catch (e) {
            ctx.reply('设置失败，你输入的不是合法的正则表达式，错误：' + e);
        }
    };

    onAnswerChangeAdmin = async (ctx, chatId) => {
        const admins = ctx.message.text.split(' ')
            .map((value) => Number(value))
            .filter((value) => Number.isNaN(value));
        settings.setChatAdmin(chatId, admins);
        ctx.reply(`已成功为 id=${chatId} 频道设置了管理员：\`${admins}\``, Extra.markdown());
        settings.clearUserState(ctx.message.from.id);
    };

    onAnswerChangeBlockedUsers = async (ctx, { targetChatId, chatId, messageId }) => {
        const [operation, src, uid] = ctx.message.text.split(' ');
        if (operation !== 'add' && operation !== 'del') {
            ctx.reply('不支持的屏蔽用户操作，如果你要进行其他操作请回复 /cancel');
            return;
        }
        if (!src || !uid) {
            ctx.reply('格式错误，请认真阅读修改说明。');
            return;
        }
        if (operation === 'add') {
            settings.addChatBlockedUsers(targetChatId, src + '_' + uid);
            ctx.reply('已成功添加屏蔽用户：' + src + '_' + uid);
        } else if (operation === 'del') {
            settings.removeChatBlockedUsers(targetChatId, src + '_' + uid);
            ctx.reply('已成功取消屏蔽用户：' + src + '_' + uid);
        }
        await this.bot.telegram.editMessageText(
            chatId, messageId, undefined,
            this.getChangeBlockedUsersMessageText(targetChatId),
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });
    };

    onCommandManageChat = async (ctx) => {
        let [_, chatId] = ctx.message.text.split(' ');
        if (!chatId) {
            ctx.reply('管理频道命令使用方法：/manage_chat `chatId`', Extra.markdown());
            return;
        }
        const targetChat = await this.getChat(chatId || ctx.chat.id);
        if (!targetChat) {
            ctx.reply('无法找到这个对话。');
            return;
        }
        chatId = targetChat.id;
        if (!settings.getChatConfig(chatId)) {
            ctx.reply('这个对话未注册任何弹幕源。');
            return;
        }
        if (!this.hasPermissionForChat(ctx.message.from.id, chatId)) {
            ctx.reply('你没有管理这个对话的权限。');
            return;
        }
        await this.requestManageChat(ctx, chatId);
    };

    onCommandListDMSrc = async (ctx) => {
        let msgText = 'Bot 支持的弹幕源：\n';
        for (let src of settings.danmakuSources) {
            msgText += '- `' + src.id + '` : ' + src.description + '\n';
        }
        ctx.reply(msgText, Extra.markdown());
    };

    onCommandCancel = async (ctx) => {
        const code = settings.getUserStateCode(ctx.message.from.id);
        if (code < 0) {
            ctx.reply('你没有取消任何操作。');
            return;
        }
        settings.clearUserState(ctx.message.from.id);
        ctx.reply('已取消互动式操作。');
    };

    onCommandSetDefaultPattern = async (ctx) => {
        let [_, pattern] = ctx.message.text.split(' ');
        if (!pattern) {
            ctx.reply('请输入要设置的默认过滤规则。', Extra.markdown());
            return;
        }
        try {
            new RegExp(pattern);
            settings.setGlobalPattern(pattern);
            ctx.reply('成功设置默认过滤规则为：`' + pattern + '`', Extra.markdown());
        } catch (e) {
            ctx.reply('设置默认过滤规则失败，错误原因：' + e);
        }
    };

    onCommandSetDefaultAdmins = async (ctx) => {
        const admins = ctx.message.text.split(' ')
            .slice(1)
            .map((value) => Number(value))
            .filter((value) => Number.isNaN(value));
        settings.setGlobalAdmin(admins);
        ctx.reply('已设置默认管理员为 `' + admins.toString() + '`', Extra.markdown());
    }

    onCommandSetDefaultSource = async (ctx) => {
        let [_, newSrc] = ctx.message.text.split(' ');
        if (!newSrc) {
            ctx.reply('请输入一个弹幕源 id，要查询 Bot 支持哪些弹幕源可以输入 /list_dm_src');
            return;
        }
        if (settings.danmakuSources.find((value) => value.id === newSrc)) {
            settings.setGlobalDanmakuSource(newSrc);
            ctx.reply('成功设置默认弹幕源为 ' + newSrc);
        } else {
            ctx.reply('无法找到弹幕源 id=' + newSrc);
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
        this.dmSrc.on('danmaku', (danmaku) => {
            try {
                this.onReceiveDanmaku(danmaku);
            } catch (e) {
                console.error(e);
            }
        });
        this.dmSrc.on('connect', (source) => {
            try {
                this.onConnectDMSource(source);
            } catch (e) {
                console.error(e);
            }
        });
    }

    onReceiveDanmaku(danmaku) {
        if (!this.bot.botUser) {
            return;
        }
        for (let chatId of Object.keys(settings.chatsConfig)) {
            let chatConfig = settings.chatsConfig[chatId];
            if (chatConfig.roomId) {
                chatConfig = settings.getChatConfig(chatId);
                if (chatConfig.blockedUsers &&
                    chatConfig.blockedUsers.indexOf(danmaku.sourceId + '_' + danmaku.sender.uid) >= 0) {
                    return;
                }
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
