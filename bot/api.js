const EventEmitter = require('events');
const { MSG_JOIN_ROOM, MSG_LEAVE_ROOM, MSG_RECONNECT_ROOM } = require('../dmsrc/common');
const ioClient = require('socket.io-client');
const settings = require('./util/settings');

class DanmakuWebSocketSource {
    constructor({id, type, socket}) {
        this.id = id;
        this.type = type;
        this.socket = socket;
    }

    join(roomId) {
        this.socket.emit(MSG_JOIN_ROOM, roomId);
    }

    leave(roomId) {
        this.socket.emit(MSG_LEAVE_ROOM, roomId);
    }

    reconnect(roomId) {
        this.socket.emit(MSG_RECONNECT_ROOM, roomId);
    }
}

class DanmakuSourceManager extends EventEmitter {
    constructor(logger) {
        super();
        this.sourceInstance = {};
        this.logger = logger;
        for (let source of settings.danmakuSources) {
            if (source.type === 'common-danmaku-ws') {
                this.initWebSocketSource(source);
            } else {
                throw new Error('Source type ' + source.type + ' isn\'t supported!');
            }
        }
    }

    initWebSocketSource(source) {
        const value = source.value;
        let url = '';
        let options = null;
        if (typeof value === 'string') {
            url = value;
        } else {
            url = value.url;
            if (value.basicAuth) {
                options = {
                    transportOptions: {
                        polling: { extraHeaders: { 'Authorization': value.basicAuth } }
                    }
                }
            }
        }
        const socket = ioClient('http://' + url, options);
        socket.on('connect', () => {
            this.logger.default.debug(`Danmaku source is connected! [id=${source.id}, url=${url}]`);
            this.emit('connect', source);
        });
        const instance = new DanmakuWebSocketSource({
            id: source.id,
            type: source.type,
            socket: socket
        });
        socket.on('danmaku', (json) => {
            const danmaku = JSON.parse(json);
            danmaku.sourceId = source.id;
            this.emit('danmaku', danmaku);
        });
        this.sourceInstance[source.id] = instance;
    }

    joinRoom(sourceId, roomId) {
        this.sourceInstance[sourceId].join(roomId);
    }

    leaveRoom(sourceId, roomId) {
        this.sourceInstance[sourceId].leave(roomId);
    }

    reconnectRoom(sourceId, roomId) {
        this.sourceInstance[sourceId].reconnect(roomId);
    }

    onDanmaku(par1, par2) {
        this.on('danmaku', (danmaku) => {
            if (typeof par1 === 'string' && typeof par2 === 'function') {
                const sourceId = par1;
                const callback = par2;
                if (danmaku.sourceId === sourceId) {
                    callback(danmaku);
                }
            } else if (typeof par1 === 'function') {
                const callback = par1;
                callback(danmaku);
            } else {
                throw new Error('par1 should be String or Function.');
            }
        });
    }
}

module.exports = {
    DanmakuSourceManager
};
