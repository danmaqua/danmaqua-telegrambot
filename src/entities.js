const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const Memory = require('lowdb/adapters/Memory');
const { RecordEntity } = require('./model/recordentity');

class Entities {
    constructor(db) {
        this.db = db;
        this.records = [];

        db.defaults({ records: [], admins: [] }).write();

        this.records = this._db_records().value().map((value) => new RecordEntity(value));
    }

    static fromMemory() {
        return new Entities(low(new Memory()));
    }

    static fromFile(file) {
        return new Entities(low(new FileSync(file)));
    }

    _db_records() {
        return this.db.get('records');
    }

    _db_admins() {
        return this.db.get('admins');
    }

    getRecord(chatId) {
        return new RecordEntity(this._db_records().find({ chatId }).value());
    }

    setRecord(record) {
        if (!(record instanceof RecordEntity)) {
            throw new Error('setRecord receives RecordEntity type argument only.');
        }
        const item = this._db_records().find({ chatId: record.chatId });
        if (item.value()) {
            item.assign(record).write();
        } else {
            this._db_records().push(record).write();
        }
        this.records = this._db_records().value().map((value) => new RecordEntity(value));
    }

    recordSubscribe(chatId, roomId) {
        const item = this._db_records().find({ chatId });
        if (item.value()) {
            item.assign({ roomId }).write();
        } else {
            this._db_records().push(new RecordEntity({chatId, roomId})).write();
        }
        this.records = this._db_records().value().map((value) => new RecordEntity(value));
    }

    deleteRecord(chatId) {
        this._db_records().remove({ chatId }).write();
        this.records = this._db_records().value().map((value) => new RecordEntity(value));
    }

    isUserAllowedSet(userId) {
        const admins = this._db_admins().value();
        if (admins.length === 0) {
            return true;
        }
        return this._db_admins().indexOf(userId).value() !== -1;
    }

    isAllUserAllowed() {
        return this._db_admins().value().length === 0;
    }

    addAdmin(userId) {
        if (this.isAllUserAllowed()) {
            return;
        }
        if (this._db_admins().indexOf(userId).value() === -1) {
            this._db_admins().push(userId).write();
        }
    }

    removeAdmin(userId) {
        if (this.isAllUserAllowed()) {
            return;
        }
        this._db_admins().remove(userId).write();
    }

    setDefaultAdmins(defaultAdmins) {
        if (this.isAllUserAllowed()) {
            this.db.set('admins', defaultAdmins).write();
        }
    }
}

module.exports = { Entities };
