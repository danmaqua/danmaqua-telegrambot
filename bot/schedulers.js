const cron = require('node-cron');

class ChatsScheduler {
    constructor() {
        this.chatSchedulers = {};
        this.timezone = 'Asia/Shanghai';
        this.bot = null;
    }

    init({ bot, settings, logger }) {
        this.bot = bot;
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
        return true;
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

    resolveAction(chatId, action) {
        this.logger.default.info(`resolveAction: chatId=${chatId} action=${action}`);
        console.log('TODO!');
    }

    _ensureChatSchedulers(chatId) {
        if (!Object.keys(this.chatSchedulers).find(value => value == chatId)) {
            this.chatSchedulers[chatId] = [];
        }
        return this.chatSchedulers[chatId];
    }
}

module.exports = {
    chats: new ChatsScheduler(),
};