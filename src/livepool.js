const EventEmitter = require('events');
const { KeepLiveTCP } = require('bilibili-live-ws');
const { Danmaku } = require('./model/danmaku');

class LiveEntity {
    constructor(live, counter = 0) {
        this.live = live;
        this.counter = counter;
    }
}

class LivePool extends EventEmitter {
    constructor() {
        super();
        this.liveList = {};
    }

    isConnected(room) {
        const entity = this.liveList[room];
        return entity && entity.live && entity.live.connection.live;
    }

    registerRoom(room) {
        if (this.isConnected(room)) {
            this.liveList[room].counter++;
            return;
        }
        const live = new KeepLiveTCP(room);
        live.on('DANMU_MSG', (data) => {
            const danmaku = Danmaku.fromBilibiliMessage(data);
            this.emit('danmaku', room, danmaku);
        });
        live.on('error', ( e) => {
            this.emit('error', room, e);
        });
        this.liveList[room] = new LiveEntity(live, 1);
    }

    unregisterRoom(room) {
        if (!this.isConnected(room)) {
            return;
        }
        const entity = this.liveList[room];
        entity.counter--;
        if (entity.counter <= 0) {
            console.log(`Room ${room} is no longer used. Close now.`);
            entity.live.close();
            delete this.liveList[room];
        }
    }
}

module.exports = { LivePool };
