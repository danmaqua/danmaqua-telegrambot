const Telegraf = require('telegraf');
const Messages = require("./messages");

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
        return this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            disable_notification: true
        });
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
        return ctx.reply(Messages.WELCOME_MSG, {parse_mode: 'MarkdownV2'});
    };

    onCommandHelp = async (ctx) => {
        return ctx.reply(Messages.HELP_MSG, {parse_mode: 'MarkdownV2'});
    };

    onCommandSubscribe = async (ctx) => {
        let [_, roomId, targetChatId] = ctx.message.text.split(' ');
        if (!roomId) {
            ctx.reply(Messages.SUBSCRIBE_HELP_MSG, {parse_mode: 'MarkdownV2'});
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
}

module.exports = { DanmaquaBot };
