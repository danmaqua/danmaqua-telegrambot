const EventEmitter = require('events');
const { KeepLiveTCP } = require('bilibili-live-ws');
const { Danmaku } = require('./model/danmaku');

/**
 * 带引用计数的弹幕连接
 */
class LiveEntity {
    constructor(live, counter = 0) {
        this.live = live;
        this.counter = counter;
    }
}

/**
 * 弹幕连接池，通过 EventEmitter 实现分发弹幕事件。
 *
 * 监听 danmaku
 */
class LivePool extends EventEmitter {
    constructor() {
        super();
        this.liveList = {};
    }

    /**
     * 检查是否已连接到指定房间
     *
     * @param room 房间号
     * @returns {boolean} 是否已连接
     */
    isConnected(room) {
        const entity = this.liveList[room];
        return entity && entity.live && entity.live.connection.live;
    }

    /**
     * 注册房间，若已连接则仅新增一个引用计数
     *
     * @param room 房间号
     */
    registerRoom(room) {
        if (this.isConnected(room)) {
            this.liveList[room].counter++;
            return;
        }
        this.liveList[room] = new LiveEntity(this._createLive(room), 1);
    }

    /**
     * 取消注册房间，若弹幕连接不再被引用则断开
     *
     * @param room 房间号
     */
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

    /**
     * 手动重新连接房间
     *
     * @param room 房间号
     */
    reconnect(room) {
        if (!this.isConnected(room)) {
            return;
        }
        const entity = this.liveList[room];
        entity.live.close();
        entity.live = this._createLive(room);
    }

    /**
     * 创建弹幕连接
     *
     * @param room 房间号
     * @private
     */
    _createLive(room) {
        const live = new KeepLiveTCP(room);
        live.on('live', () => {
            console.log(`Connected to live room: ${room}`);
        });
        live.on('DANMU_MSG', (data) => {
            const danmaku = Danmaku.fromBilibiliMessage(data);
            this.emit('danmaku', room, danmaku);
        });
        live.on('error', ( e) => {
            this.emit('error', room, e);
        });
        return live;
    }
}

module.exports = { LivePool };
