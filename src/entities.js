const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const Memory = require('lowdb/adapters/Memory');
const { RecordEntity } = require('./model/recordentity');

/**
 * 数据库（数据访问层）
 */
class Entities {
    constructor(db) {
        this.db = db;
        this.records = [];

        db.defaults({ records: [], admins: [] }).write();

        this.records = this._db_records().value().map((value) => new RecordEntity(value));
    }

    /**
     * 从内存数据库创建 Entities
     *
     * @returns {Entities}
     */
    static fromMemory() {
        return new Entities(low(new Memory()));
    }

    /**
     * 从文件数据库创建 Entities
     *
     * @param file 文件路径
     * @returns {Entities}
     */
    static fromFile(file) {
        return new Entities(low(new FileSync(file)));
    }

    _db_records() {
        return this.db.get('records');
    }

    _db_admins() {
        return this.db.get('admins');
    }

    /**
     * 获取对话设置
     *
     * @param chatId 对话 ID
     * @returns {null|RecordEntity}
     */
    getRecord(chatId) {
        const value = this._db_records().find({ chatId }).value();
        if (value) {
            return new RecordEntity(value);
        }
        return null;
    }

    /**
     * 保存对话设置
     *
     * @param record 对话设置
     */
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

    /**
     * 为对话订阅房间号
     *
     * @param chatId 对话 ID
     * @param roomId 房间号
     */
    recordSubscribe(chatId, roomId) {
        const item = this._db_records().find({ chatId });
        if (item.value()) {
            item.assign({ roomId }).write();
        } else {
            this._db_records().push(new RecordEntity({chatId, roomId})).write();
        }
        this.records = this._db_records().value().map((value) => new RecordEntity(value));
    }

    /**
     * 删除对话设置
     *
     * @param chatId 对话 ID
     */
    deleteRecord(chatId) {
        this._db_records().remove({ chatId }).write();
        this.records = this._db_records().value().map((value) => new RecordEntity(value));
    }

    /**
     * 查询用户能否设置
     *
     * @param userId 用户 ID
     * @returns {boolean} 能否设置
     */
    isUserAllowedSet(userId) {
        const admins = this._db_admins().value();
        if (admins.length === 0) {
            return true;
        }
        return this._db_admins().indexOf(userId).value() !== -1;
    }

    /**
     * 是否允许所有用户设置
     *
     * @returns {boolean} 能否设置
     */
    isAllUserAllowed() {
        return this._db_admins().value().length === 0;
    }

    /**
     * 添加管理员
     *
     * @param userId 用户 ID
     */
    addAdmin(userId) {
        if (this.isAllUserAllowed()) {
            return;
        }
        if (this._db_admins().indexOf(userId).value() === -1) {
            this._db_admins().push(userId).write();
        }
    }

    /**
     * 移除管理员
     *
     * @param userId 用户 ID
     */
    removeAdmin(userId) {
        if (this.isAllUserAllowed()) {
            return;
        }
        this._db_admins().remove(userId).write();
    }

    /**
     * 设置默认管理员
     *
     * @param defaultAdmins 默认管理员列表
     */
    setDefaultAdmins(defaultAdmins) {
        if (this.isAllUserAllowed()) {
            this.db.set('admins', defaultAdmins).write();
        }
    }
}

module.exports = { Entities };
