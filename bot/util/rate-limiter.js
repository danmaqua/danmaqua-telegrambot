const AsyncRateLimiter = require('async-ratelimiter');
const Redis = require('ioredis');

class RateLimiter {
    constructor(botConfig, logger) {
        this.enabled = botConfig.rateLimit.enabled;
        let redisServer = botConfig.rateLimit.redisServer;
        if (!redisServer.startsWith('redis://') && !redisServer.startsWith('rediss://')) {
            redisServer = 'redis://' + redisServer;
        }
        if (!this.enabled) return;
        this.client = new Redis(redisServer);
        this.logger = logger;
        this.selectDBIndex = botConfig.rateLimit.selectDB;

        logger.default.info('RateLimiter: RateLimiter is enabled. Redis server: ' + redisServer);
        logger.default.debug('RateLimiter: Since the function is incomplete, it will not affect the sending behavior.');

        this._selectDanmaquaDB()
            .then(() => this.limiter = this._initAsyncRateLimiter())
            .catch((e) => this.logger.default.error(e));
    }

    _initAsyncRateLimiter() {
        return new AsyncRateLimiter({ db: this.client, namespace: 'rate_limit' });
    }

    async _selectDanmaquaDB() {
        let dbIndex = this.selectDBIndex;
        if (isNaN(this.selectDBIndex)) {
            dbIndex = await this.client.get('danmaqua:db_index');
        }
        if (dbIndex > 0) {
            await this.client.select(dbIndex);
        }
    }

    async getForGlobal() {
        return await this.limiter.get({
            id: 'global',
            max: 30,
            duration: 1000
        });
    }

    async getForChatOnly(chatId) {
        return await this.limiter.get({
            id: 'chat_' + chatId,
            max: 20,
            duration: 1000 * 60
        });
    }

    async get(chatId) {
        const globalRes = await this.getForGlobal();
        const chatRes = await this.getForChatOnly(chatId);
        const reset = Math.max(globalRes.reset, chatRes.reset);
        if (globalRes.remaining <= 0 || chatRes.remaining <= 0) {
            return {
                available: false,
                reset: reset
            };
        } else {
            return {
                available: true,
                reset: reset
            };
        }
    }
}

module.exports = RateLimiter;
