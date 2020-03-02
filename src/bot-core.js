const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const Messages = require('./messages');

const spaceUrlRegexp = /https:\/\/space\.bilibili\.com\/(\d+)/;
const blkUserCallbackRe = /blk_user:([-\d]+):([-\d]+)/;

class DanmaquaBot {
    constructor({ livePool, entities, botToken, agent }) {
        this.livePool = livePool;
        this.entities = entities;
        this.botUser = {};

        this.bot = new Telegraf(botToken, { telegram: { agent } });

        this.bot.start(this.onCommandStart);
        this.bot.command('help', this.onCommandHelp);
        this.bot.command('subscribe', this.checkIsAdmin, this.onCommandSubscribe);
        this.bot.command('unsubscribe', this.checkIsAdmin, this.onCommandUnsubscribe);
        this.bot.command('set_hide_username', this.checkIsAdmin, this.onCommandSetHideUsername);
        this.bot.command('block_user', this.checkIsAdmin, this.onCommandBlockUser);
        this.bot.command('list_blocked_users', this.onCommandListBlockedUsers);
        this.bot.on('message', this.onMessage);
        this.bot.action(blkUserCallbackRe, this.onBlockUserCallback);
    }

    start = async () => {
        this.botUser = await this.bot.telegram.getMe();
        return await this.bot.launch();
    };

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

    checkIsAdmin = async (ctx, next) => {
        if (!this.entities.isUserAllowedSet(ctx.message.from.id)) {
            ctx.reply(Messages.NO_PERMISSION_MSG);
            return;
        }
        await next();
    };

    canSendMessageToChat = async (chatId) => {
        try {
            let member = await this.bot.telegram.getChatMember(chatId, this.botUser.id);
            return member.status === 'member' || member.status === 'administrator' || member.status === 'creator';
        } catch (ignored) {
        }
        return false;
    };

    onCommandStart = async (ctx) => {
        return ctx.reply(Messages.WELCOME_MSG, Extra.markdown());
    };

    onCommandHelp = async (ctx) => {
        return ctx.reply(Messages.HELP_MSG, Extra.markdown());
    };

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

    onMessage = async (ctx) => {
        if (ctx.message.forward_from_chat) {
            if (await this.onForwardMessageFromChat(ctx)) {
                return;
            }
        }
    };

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
        ctx.reply(Messages.DANMAKU_OP_MENU_MSG, Extra.inReplyTo(ctx.message.message_id)
            .markup((m) => m.inlineKeyboard([
                m.callbackButton(
                    Messages.DANMAKU_OP_BLOCK_USER(username),
                    `blk_user:${chatId}:${uid}`
                )
            ])));
    };

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
}

module.exports = { DanmaquaBot };
