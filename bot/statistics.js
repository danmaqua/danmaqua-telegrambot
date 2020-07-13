const { promisify } = require('util');
const redis = require('redis');

class DanmakuStatistics {
    constructor(botConfig, logger) {
        this.enabled = botConfig.statistics.enabled;
        let redisServer = botConfig.statistics.redisServer;
        if (!redisServer.startsWith('//')) {
            redisServer = '//' + redisServer;
        }
        if (!this.enabled) return;
        const client = redis.createClient(redisServer);
        this.client = client;
        this.logger = logger;
        this.selectDBIndex = botConfig.statistics.selectDB;

        this.getSync = promisify(client.get).bind(client);
        this.incrSync = promisify(client.incr).bind(client);
        this.incrbySync = promisify(client.incrby).bind(client);
        this.selectSync = promisify(client.select).bind(client);
        this.keysSync = promisify(client.keys).bind(client);
        this.saddSync = promisify(client.sadd).bind(client);
        this.smembersSync = promisify(client.smembers).bind(client);

        this._selectDanmaquaDB().catch((e) => {
            this.logger.default.error(e);
        });
        client.on('error', (e) => {
            this.logger.default.error(e);
        });
    }

    async _selectDanmaquaDB() {
        let dbIndex = this.selectDBIndex;
        if (isNaN(this.selectDBIndex)) {
            dbIndex = await this.getSync('danmaqua:db_index');
        }
        if (dbIndex > 0) {
            await this.selectSync(dbIndex);
        }
    }

    async incrementSentences(userId, roomId) {
        if (!this.enabled) return;
        await this.saddSync('users', userId);
        await this.saddSync('rooms', roomId);
        return await this.incrSync(`sentences:${userId}:${roomId}`);
    }

    async incrementWordsBy(userId, roomId, count) {
        if (!this.enabled) return;
        await this.saddSync('users', userId);
        await this.saddSync('rooms', roomId);
        return await this.incrbySync(`words:${userId}:${roomId}`, count);
    }

    async getUsers() {
        if (!this.enabled) return [];
        return await this.smembersSync('users');
    }

    async getRooms() {
        if (!this.enabled) return [];
        return await this.smembersSync('rooms');
    }

    async getSentencesEntry(userId, roomId) {
        if (!this.enabled) return 0;
        return Number(await this.getSync(`sentences:${userId}:${roomId}`));
    }

    async getWordsEntry(userId, roomId) {
        if (!this.enabled) return 0;
        return Number(await this.getSync(`words:${userId}:${roomId}`));
    }

    async countSentencesByUserId(userId) {
        if (!this.enabled) return 0;
        const keys = await this.keysSync(`sentences:${userId}:*`);
        let sum = 0;
        for (let key of keys) {
            sum += Number(await this.getSync(key));
        }
        return sum;
    }

    async countWordsByUserId(userId) {
        if (!this.enabled) return 0;
        const keys = await this.keysSync(`words:${userId}:*`);
        let sum = 0;
        for (let key of keys) {
            sum += Number(await this.getSync(key));
        }
        return sum;
    }

    async countSentencesByRoomId(roomId) {
        if (!this.enabled) return 0;
        const keys = await this.keysSync(`sentences:*:${roomId}`);
        let sum = 0;
        for (let key of keys) {
            sum += Number(await this.getSync(key));
        }
        return sum;
    }

    async countWordsByRoomId(roomId) {
        if (!this.enabled) return 0;
        const keys = await this.keysSync(`words:*:${roomId}`);
        let sum = 0;
        for (let key of keys) {
            sum += Number(await this.getSync(key));
        }
        return sum;
    }
}

module.exports = {
    DanmakuStatistics,
};
