const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const Messages = require('./messages');

// 正则表达式常量
const spaceUrlRegexp = /https:\/\/space\.bilibili\.com\/(\d+)/;
const blkUserCallbackRe = /blk_user:([-\d]+):([-\d]+)/;

class DanmaquaBot {
    constructor({ livePool, entities, botToken, agent }) {
        this.livePool = livePool;
        this.entities = entities;
        this.botUser = {};

        // 初始化 Telegram Bot
        this.bot = new Telegraf(botToken, { telegram: { agent } });

        // 设定回调
        this.bot.start(this.onCommandStart);
        this.bot.command('help', this.onCommandHelp);
        this.bot.command('subscribe', this.checkIsAdmin, this.onCommandSubscribe);
        this.bot.command('unsubscribe', this.checkIsAdmin, this.onCommandUnsubscribe);
        this.bot.command('set_hide_username', this.checkIsAdmin, this.onCommandSetHideUsername);
        this.bot.command('block_user', this.checkIsAdmin, this.onCommandBlockUser);
        this.bot.command('list_blocked_users', this.onCommandListBlockedUsers);
        this.bot.command('reconnect', this.onCommandReconnect);
        this.bot.on('message', this.onMessage);
        this.bot.action(blkUserCallbackRe, this.onBlockUserCallback);
    }

    /**
     * 启动机器人
     */
    start = async () => {
        this.botUser = await this.bot.telegram.getMe();
        return await this.bot.launch();
    };

    /**
     * 将弹幕发送到指定对话
     *
     * @param chatId 对话 ID
     * @param data 弹幕数据
     * @param hideUsername 是否隐藏用户名
     * @returns {Promise<Message>} 发送消息结果
     */
    notifyDanmaku = async (chatId, data, { hideUsername = false }) => {
        let msg = '';
        if (!hideUsername) {
            const url = 'https://space.bilibili.com/' + data.sender.uid;
            msg += `<a href="${url}">${data.sender.username}</a>`;
            msg += ': ';
        }
        msg += data.text;
        return this.bot.telegram.sendMessage(chatId, msg, Extra.HTML().webPreview(false).notifications(false));
    };

    /**
     * 检查是否为机器人管理员的 Bot Middleware
     *
     * @param ctx
     * @param next
     * @returns {Promise<void>}
     */
    checkIsAdmin = async (ctx, next) => {
        if (!this.entities.isUserAllowedSet(ctx.message.from.id)) {
            ctx.reply(Messages.NO_PERMISSION_MSG);
            return;
        }
        await next();
    };

    /**
     * 检查能否在此对话中发送消息
     *
     * @param chatId 对话 ID
     * @returns {Promise<boolean>} 判断结果
     */
    canSendMessageToChat = async (chatId) => {
        try {
            let member = await this.bot.telegram.getChatMember(chatId, this.botUser.id);
            return member.status === 'member' || member.status === 'administrator' || member.status === 'creator';
        } catch (ignored) {
        }
        return false;
    };

    /**
     * /start 开始命令回调
     *
     * @param ctx 消息上下文
     */
    onCommandStart = async (ctx) => {
        return ctx.reply(Messages.WELCOME_MSG, Extra.markdown());
    };

    /**
     * /help 帮助命令回调
     *
     * @param ctx 消息上下文
     */
    onCommandHelp = async (ctx) => {
        return ctx.reply(Messages.HELP_MSG, Extra.markdown());
    };

    /**
     * /subscribe 订阅命令回调
     *
     * @param ctx 消息上下文
     */
    onCommandSubscribe = async (ctx) => {
        let [_, roomId, targetChatId] = ctx.message.text.split(' ');
        if (!roomId) {
            ctx.reply(Messages.SUBSCRIBE_HELP_MSG, Extra.markdown());
            return;
        }
        roomId = parseInt(roomId);
        if (roomId <= 0) {
            ctx.reply(Messages.SUBSCRIBE_ROOM_INVALID_MSG);
            return;
        }
        targetChatId = parseInt(targetChatId || ctx.chat.id);
        const canSend = await this.canSendMessageToChat(targetChatId);
        if (!canSend) {
            ctx.reply(Messages.CHAT_CANNOT_SEND_MSG);
            return;
        }

        const record = this.entities.getRecord(targetChatId);
        if (record != null) {
            if (record.roomId === roomId) {
                ctx.reply(Messages.SUBSCRIBE_DUPLICATED_MSG);
                return;
            }
            this.livePool.unregisterRoom(record.roomId);
        }
        this.entities.recordSubscribe(targetChatId, roomId);
        this.livePool.registerRoom(roomId);
        ctx.reply(Messages.SUBSCRIBE_SUCCESS_MSG(roomId));
    };

    /**
     * /unsubscribe 取消订阅命令回调
     *
     * @param ctx 消息上下文
     */
    onCommandUnsubscribe = async (ctx) => {
        let [_, targetChatId] = ctx.message.text.split(' ');
        targetChatId = parseInt(targetChatId || ctx.chat.id);
        const canSend = await this.canSendMessageToChat(targetChatId);
        if (!canSend) {
            ctx.reply(Messages.CHAT_CANNOT_SEND_MSG);
            return;
        }

        const record = this.entities.getRecord(targetChatId);
        if (record == null) {
            ctx.reply(Messages.NEED_SUBSCRIBE_MSG(targetChatId));
            return;
        }
        this.livePool.unregisterRoom(record.roomId);
        this.entities.deleteRecord(targetChatId);
        ctx.reply(Messages.UNSUBSCRIBE_SUCCESS_MSG(record.roomId));
    };

    /**
     * /set_hide_username 设定隐藏用户名命令回调
     *
     * @param ctx 消息上下文
     */
    onCommandSetHideUsername = async (ctx) => {
        let [_, targetChatId] = ctx.message.text.split(' ');
        targetChatId = parseInt(targetChatId || ctx.chat.id);
        const canSend = await this.canSendMessageToChat(targetChatId);
        if (!canSend) {
            ctx.reply(Messages.CHAT_CANNOT_SEND_MSG);
            return;
        }

        const record = this.entities.getRecord(targetChatId);
        if (record == null) {
            ctx.reply(Messages.NEED_SUBSCRIBE_MSG(targetChatId));
            return;
        }
        record.hideUsername = !record.hideUsername;
        this.entities.setRecord(record);
        ctx.reply(Messages.HIDE_USERNAME_UPDATED_MSG(targetChatId, record.hideUsername));
    };

    /**
     * /block_user 屏蔽指定用户命令回调
     *
     * @param ctx 消息上下文
     */
    onCommandBlockUser = async (ctx) => {
        let [_, userId, targetChatId] = ctx.message.text.split(' ');
        userId = parseInt(userId);
        targetChatId = parseInt(targetChatId || ctx.chat.id);
        const canSend = await this.canSendMessageToChat(targetChatId);
        if (!canSend) {
            ctx.reply(Messages.CHAT_CANNOT_SEND_MSG);
            return;
        }

        const record = this.entities.getRecord(targetChatId);
        if (record == null) {
            ctx.reply(Messages.NEED_SUBSCRIBE_MSG(targetChatId));
            return;
        }
        const isBlocked = record.isUserBlocked(userId);
        if (isBlocked) {
            record.unblockUser(userId);
        } else {
            record.blockUser(userId);
        }
        ctx.reply(Messages.BLOCKED_USER_UPDATED_MSG(userId, !isBlocked));
        this.entities.setRecord(record);
    };

    /**
     * 所有消息回调
     *
     * @param ctx 消息上下文
     */
    onMessage = async (ctx) => {
        if (ctx.message.forward_from_chat) {
            if (await this.onForwardMessageFromChat(ctx)) {
                return;
            }
        }
    };

    /**
     * 来自其它对话的转发消息回调
     * 目前用于响应转发的弹幕消息，提供操作菜单。
     *
     * @param ctx 消息上下文
     */
    onForwardMessageFromChat = async (ctx) => {
        if (!ctx.message.text || ctx.message.chat.type !== 'private') {
            return;
        }
        if (!this.entities.isUserAllowedSet(ctx.message.from.id)) {
            ctx.reply(Messages.NO_PERMISSION_MSG);
            return;
        }
        const chatId = ctx.message.forward_from_chat.id;
        const record = this.entities.getRecord(chatId);
        if (!record) {
            ctx.reply(Messages.DANMAKU_NO_SUBSCRIPTION_IN_CHAT_MSG(chatId));
            return;
        }
        // 提取弹幕中的用户信息，如果没有则提示错误
        let username = null;
        let uid = 0;
        if (ctx.message.entities.length === 1) {
            const firstEntity = ctx.message.entities[0];
            if (firstEntity.type === 'text_link') {
                const result = spaceUrlRegexp.exec(firstEntity.url);
                if (result) {
                    uid = parseInt(result[1]);
                    if (uid > 0) {
                        username = ctx.message.text.substr(firstEntity.offset, firstEntity.length);
                    }
                }
            }
        }
        if (!username) {
            ctx.reply(Messages.DANMAKU_INVALID_MSG);
            return;
        }
        // 发送菜单
        ctx.reply(Messages.DANMAKU_OP_MENU_MSG, Extra.inReplyTo(ctx.message.message_id)
            .markup((m) => m.inlineKeyboard([
                m.callbackButton(
                    Messages.DANMAKU_OP_BLOCK_USER(username),
                    `blk_user:${chatId}:${uid}`
                )
            ])));
    };

    /**
     * 弹幕操作菜单的屏蔽用户按钮回调
     *
     * @param ctx 消息上下文
     */
    onBlockUserCallback = (ctx) => {
        const user = ctx.update.callback_query.from;
        if (!this.entities.isUserAllowedSet(user.id)) {
            return ctx.answerCbQuery(Messages.NO_PERMISSION_MSG, true);
        }

        const targetChatId = parseInt(ctx.match[1]);
        const userId = parseInt(ctx.match[2]);

        const record = this.entities.getRecord(targetChatId);
        if (record == null) {
            return ctx.answerCbQuery(Messages.NEED_SUBSCRIBE_MSG(targetChatId), true);
        }
        const isBlocked = record.isUserBlocked(userId);
        if (isBlocked) {
            record.unblockUser(userId);
        } else {
            record.blockUser(userId);
        }
        this.entities.setRecord(record);
        return ctx.answerCbQuery(Messages.BLOCKED_USER_UPDATED_MSG(userId, !isBlocked), true);
    };

    /**
     * /list_blocked_users 显示已被屏蔽的用户命令回调
     *
     * @param ctx 消息上下文
     */
    onCommandListBlockedUsers = async (ctx) => {
        let [_, targetChatId] = ctx.message.text.split(' ');
        targetChatId = parseInt(targetChatId || ctx.chat.id);
        const canSend = await this.canSendMessageToChat(targetChatId);
        if (!canSend) {
            ctx.reply(Messages.CHAT_CANNOT_SEND_MSG);
            return;
        }

        const record = this.entities.getRecord(targetChatId);
        if (record == null) {
            ctx.reply(Messages.NEED_SUBSCRIBE_MSG(targetChatId));
            return;
        }
        ctx.reply(
            Messages.BLOCKED_USER_LIST_MSG(targetChatId, record.options.blockedUsers),
            Extra.HTML().webPreview(false)
        );
    };

    /**
     * /reconnect 重连命令回调
     *
     * @param ctx 消息上下文
     */
    onCommandReconnect = async (ctx) => {
        let [_, targetChatId] = ctx.message.text.split(' ');

        if (targetChatId) {
            targetChatId = parseInt(targetChatId);
            const canSend = await this.canSendMessageToChat(targetChatId);
            if (!canSend) {
                ctx.reply(Messages.CHAT_CANNOT_SEND_MSG);
                return;
            }
            const record = this.entities.getRecord(targetChatId);
            if (record) {
                this.livePool.reconnect(record.roomId);
                ctx.reply(Messages.RECONNECT_REQUESTED_MSG(targetChatId, record.roomId));
            }
        } else {
            const list = [];
            for (let record of this.entities.records) {
                try {
                    const chat = await this.bot.telegram.getChat(record.chatId);
                    if (chat.username) {
                        list.push({
                            id: chat.id,
                            username: chat.username
                        });
                    }
                } catch (ignored) {

                }
            }
            ctx.reply(Messages.RECONNECT_CHOOSE_MSG(list), Extra.HTML());
        }
    };
}

module.exports = { DanmaquaBot };
