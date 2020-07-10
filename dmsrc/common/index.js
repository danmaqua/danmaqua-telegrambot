const http = require('http');
const ioServer = require('socket.io');
const log4js = require('log4js');
const path = require('path');

const MSG_JOIN_ROOM = 'join_room';
const MSG_LEAVE_ROOM = 'leave_room';
const MSG_RECONNECT_ROOM = 'reconnect_room';

class Danmaku {
    constructor({sender: {uid, username, url}, text, timestamp, roomId}) {
        this.sender = {uid, username, url};
        this.text = text;
        this.timestamp = timestamp;
        this.roomId = roomId;
    }
}

class BaseDanmakuWebSocketSource {
    constructor(config) {
        log4js.configure({
            appenders: {
                stdout: { type: 'stdout' },
                outfile: {
                    type: 'dateFile',
                    filename: path.join(config.logsDir, 'access-log'),
                    pattern: 'yyyy-MM-dd.log',
                    alwaysIncludePattern: true,
                    keepFileExt: false
                }
            },
            categories: {
                default: {
                    appenders: ['stdout', 'outfile'],
                    level: 'debug'
                }
            }
        });
        this.logger = log4js.getLogger('default');
        this.port = config.port;
        this.basicAuth = config.basicAuth;
        this.server = http.createServer();
        this.io = ioServer(this.server);

        this.io.use((socket, next) => {
            if (this.basicAuth) {
                const authHeader = socket.handshake.headers['authorization'];
                if (this.basicAuth !== authHeader) {
                    this.logger.error('Remote address=' + socket.handshake.address + ' attempt to connect socket ' +
                        'with Authorization=' + authHeader + '. Refused due to incorrect auth.')
                    return next(new Error('Authentication error.'));
                }
            }
            return next();
        });
        this.io.on('connection', (socket) => {
            this.onConnected(socket);
            const connectedRooms = [];
            socket.on(MSG_JOIN_ROOM, (roomId) => {
                this.onJoin(roomId);
                connectedRooms.push(roomId);
            });
            socket.on(MSG_LEAVE_ROOM, (roomId) => {
                this.onLeave(roomId);
                const index = connectedRooms.indexOf(roomId);
                if (index >= 0) {
                    connectedRooms.splice(index, 1);
                }
            });
            socket.on(MSG_RECONNECT_ROOM, (roomId) => {
                this.onReconnect(roomId);
            });
            socket.on('disconnect', (reason) => {
                this.onDisconnect(reason);
                for (let room of connectedRooms) {
                    this.onLeave(room);
                }
            });
        });
    }

    onConnected(socket) {
        this.logger.debug('onConnected: socket address=' + socket.handshake.address + ' called.');
    }

    onJoin(roomId) {
        this.logger.debug('onJoin: roomId=' + roomId + ' called.');
    }

    onLeave(roomId) {
        this.logger.debug('onLeave: roomId=' + roomId + ' called.');
    }

    onReconnect(roomId) {
        this.logger.debug('onReconnect: roomId=' + roomId + ' called.');
    }

    onDisconnect(reason) {
        this.logger.debug('onDisconnect: reason=' + reason + ' called.')
    }

    sendDanmaku(danmaku) {
        this.io.sockets.emit('danmaku', JSON.stringify(danmaku));
    }

    listen() {
        this.server.listen(this.port);
    }
}

module.exports = { Danmaku, BaseDanmakuWebSocketSource, MSG_JOIN_ROOM, MSG_LEAVE_ROOM, MSG_RECONNECT_ROOM };
