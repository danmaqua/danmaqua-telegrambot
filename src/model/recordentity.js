class RecordEntity {
    constructor(chatId, roomId, options) {
        this.chatId = chatId;
        this.roomId = roomId;
        this.options = options || {};
    }

    toString() {
        return 'RecordEntity{chatId=' + this.chatId + ', roomId=' + this.roomId + ', options=' + this.options + '}';
    }

    set hideUsername(value) {
        this.options.hideUsername = value;
    }

    get HideUsername() {
        return this.options.hideUsername;
    }

    static equals(one, other) {
        if (!(one instanceof RecordEntity) && !(other instanceof RecordEntity)) {
            return false;
        }
        return one.chatId === other.chatId && one.roomId === other.roomId;
    }
}

module.exports = { RecordEntity };
