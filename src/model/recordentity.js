class RecordEntity {
    constructor({chatId, roomId, options = {}}) {
        this.chatId = chatId;
        this.roomId = roomId;
        this.options = new RecordEntity.Options(options);
    }

    toString() {
        return 'RecordEntity{chatId=' + this.chatId + ', roomId=' + this.roomId + ', options=' + this.options + '}';
    }

    set hideUsername(value) {
        this.options.hideUsername = value;
    }

    get hideUsername() {
        return this.options.hideUsername || false;
    }

    isUserBlocked(uid) {
        return this.options.blockedUsers.indexOf(uid) !== -1;
    }

    blockUser(uid) {
        if (this.isUserBlocked(uid)) {
            return;
        }
        this.options.blockedUsers.push(uid);
    }

    unblockUser(uid) {
        if (!this.isUserBlocked(uid)) {
            return;
        }
        this.options.blockedUsers = this.options.blockedUsers.filter((item) => item !== uid);
    }

    static equals(one, other) {
        if (!(one instanceof RecordEntity) && !(other instanceof RecordEntity)) {
            return false;
        }
        return one.chatId === other.chatId && one.roomId === other.roomId;
    }
}

RecordEntity.Options = class Options {
  constructor({hideUsername = false, blockedUsers = []}) {
      this.hideUsername = hideUsername;
      this.blockedUsers = blockedUsers;
  }
};

module.exports = { RecordEntity };
