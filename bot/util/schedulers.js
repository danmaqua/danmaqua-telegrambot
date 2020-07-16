const cron = require('node-cron');

class ChatsScheduler {
    static OP_SET_ROOM = 'set_room';
    static OP_SEND_TEXT = 'send_text';
    static OP_SEND_HTML = 'send_html';

    constructor({ bot, settings, logger }) {
        this.chatSchedulers = {};
        this.timezone = 'Asia/Shanghai';
        this.bot = bot;
        this.settings = settings;
        this.logger = logger;

        const configs = settings.getChatConfigs();
        for (let chatId of Object.keys(configs)) {
            const chatConfig = configs[chatId];
            const schedules = chatConfig.schedules || [];
            for (let s of schedules) {
                this.addScheduler(chatId, s.expression, s.action);
            }
        }
    }

    validateExpression(expression) {
        return cron.validate(expression);
    }

    validateAction(action) {
        const [op, ...args] = action.split(' ');
        if (op === ChatsScheduler.OP_SET_ROOM) {
            if (args.length !== 1 && args.length !== 2) {
                return false;
            }
            if (args.length === 2) {
                const src = this.settings.getDanmakuSource(args[1]);
                if (!src) {
                    return false;
                }
            }
            if (isNaN(Number(args[0]))) {
                return false;
            }
            return true;
        } else if (op === ChatsScheduler.OP_SEND_TEXT) {
            return args.length > 0;
        } else if (op === ChatsScheduler.OP_SEND_HTML) {
            return args.length > 0;
        }
        return false;
    }

    addScheduler(chatId, expression, action) {
        const s = this._ensureChatSchedulers(chatId);
        const obj = {
            expression,
            action
        };
        obj.instance = cron.schedule(
            expression,
            () => this.resolveAction(chatId, action),
            { timezone: this.timezone }
            );
        s.push(obj);
    }

    removeScheduler(chatId, expression) {
        const index = this.indexOfScheduler(chatId, expression);
        if (index >= 0) {
            const s = this._ensureChatSchedulers(chatId)[index];
            s.instance.destroy();
            this._ensureChatSchedulers(chatId).splice(index, 1);
        }
    }

    clearSchedulersForChat(chatId) {
        const schedulers = this._ensureChatSchedulers(chatId);
        for (let s of schedulers) {
            s.instance.destroy();
        }
        this.chatSchedulers[chatId] = [];
    }

    findScheduler(chatId, expression) {
        return this._ensureChatSchedulers(chatId).find((s) => s.expression === expression);
    }

    indexOfScheduler(chatId, expression) {
        return this._ensureChatSchedulers(chatId).findIndex((s) => s.expression === expression);
    }

    async resolveAction(chatId, action) {
        this.logger.default.info(`Resolve action: chatId=${chatId} action=${action}`);
        const [op, ...args] = action.split(' ');
        try {
            if (op === ChatsScheduler.OP_SET_ROOM) {
                let [roomId, src] = args;
                roomId = Number(roomId);
                this.bot.doRegisterChat(chatId, roomId, src);
            } else if (op === ChatsScheduler.OP_SEND_TEXT) {
                const msg = args.reduce((a, b) => `${a} ${b}`);
                await this.bot.sendPlainText(chatId, msg);
            } else if (op === ChatsScheduler.OP_SEND_HTML) {
                const msg = args.reduce((a, b) => `${a} ${b}`);
                await this.bot.sendHtml(chatId, msg);
            }
            this.bot.notifyActionDone(chatId, action);
        } catch (e) {
            this.logger.default.error(e);
            this.bot.notifyActionError(chatId, action, e);
        }
    }

    _ensureChatSchedulers(chatId) {
        if (!Object.keys(this.chatSchedulers).find(value => value == chatId)) {
            this.chatSchedulers[chatId] = [];
        }
        return this.chatSchedulers[chatId];
    }
}

module.exports = {
    ChatsScheduler,
};