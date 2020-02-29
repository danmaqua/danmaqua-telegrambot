const { RecordEntity } = require('./model/recordentity');

class Entities {
    constructor() {
        this.records = {};
    }

    getRecord(chatId) {
        return this.records[chatId];
    }

    setRecord(record) {
        this.records[record.chatId] = record;
    }

    recordSubscribe(chatId, roomId) {
        if (!this.records.hasOwnProperty(chatId)) {
            this.records[chatId] = new RecordEntity(chatId);
        }
        this.records[chatId].roomId = roomId;
    }

    deleteRecord(chatId) {
        delete this.records[chatId];
    }
}

module.exports = { Entities };
