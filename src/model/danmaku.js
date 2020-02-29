class Danmaku {
    constructor({sender: {uid, username}, text, timestamp}) {
        this.sender = { uid, username };
        this.text = text;
        this.timestamp = timestamp;
    }

    get time() {
        return new Date(this.timestamp * 1000);
    }

    toString() {
        return `[${this.time.toLocaleString()}]${this.sender.username}(${this.sender.uid}):${this.text}`;
    }

    static fromBilibiliMessage(message) {
        const info = message['info'];
        const senderInfo = info[2];
        return new Danmaku({
            sender: {
                uid: senderInfo[0],
                username: senderInfo[1]
            },
            text: info[1],
            timestamp: info[9]['ts']
        });
    }
}

module.exports = { Danmaku };
