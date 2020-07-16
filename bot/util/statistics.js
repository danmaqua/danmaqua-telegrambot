const Redis = require('ioredis');

class DanmakuStatistics {
    constructor(botConfig, logger) {
        this.enabled = botConfig.statistics.enabled;
        let redisServer = botConfig.statistics.redisServer;
        if (!redisServer.startsWith('redis://') && !redisServer.startsWith('rediss://')) {
            redisServer = 'redis://' + redisServer;
        }
        if (!this.enabled) return;
        this.client = new Redis(redisServer);
        this.logger = logger;
        this.selectDBIndex = botConfig.statistics.selectDB;

        logger.default.info('DanmakuStatistics: DanmakuStatistics is enabled. Redis server: ' + redisServer);

        this._selectDanmaquaDB().catch((e) => {
            this.logger.default.error(e);
        });
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

    async incrementSentences(userId, roomId) {
        if (!this.enabled) return;
        await this.client.sadd('users', userId);
        await this.client.sadd('rooms', roomId);
        return await this.client.incr(`sentences:${userId}:${roomId}`);
    }

    async incrementWordsBy(userId, roomId, count) {
        if (!this.enabled) return;
        await this.client.sadd('users', userId);
        await this.client.sadd('rooms', roomId);
        return await this.client.incrby(`words:${userId}:${roomId}`, count);
    }

    async getUsers() {
        if (!this.enabled) return [];
        return await this.client.smembers('users');
    }

    async getRooms() {
        if (!this.enabled) return [];
        return await this.client.smembers('rooms');
    }

    async getSentencesEntry(userId, roomId) {
        if (!this.enabled) return 0;
        return Number(await this.client.get(`sentences:${userId}:${roomId}`));
    }

    async getWordsEntry(userId, roomId) {
        if (!this.enabled) return 0;
        return Number(await this.client.get(`words:${userId}:${roomId}`));
    }

    async countSentencesByUserId(userId) {
        if (!this.enabled) return 0;
        const keys = await this.client.keys(`sentences:${userId}:*`);
        let sum = 0;
        for (let key of keys) {
            sum += Number(await this.client.get(key));
        }
        return sum;
    }

    async countWordsByUserId(userId) {
        if (!this.enabled) return 0;
        const keys = await this.client.keys(`words:${userId}:*`);
        let sum = 0;
        for (let key of keys) {
            sum += Number(await this.client.get(key));
        }
        return sum;
    }

    async countSentencesByRoomId(roomId) {
        if (!this.enabled) return 0;
        const keys = await this.client.keys(`sentences:*:${roomId}`);
        let sum = 0;
        for (let key of keys) {
            sum += Number(await this.client.get(key));
        }
        return sum;
    }

    async countWordsByRoomId(roomId) {
        if (!this.enabled) return 0;
        const keys = await this.client.keys(`words:*:${roomId}`);
        let sum = 0;
        for (let key of keys) {
            sum += Number(await this.client.get(key));
        }
        return sum;
    }
}

module.exports = {
    DanmakuStatistics,
};
