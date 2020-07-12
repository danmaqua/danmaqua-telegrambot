const { BaseDanmakuWebSocketSource } = require('../common');
const localConfig = require('../../dmsrc.config').local;

class LocalDanmakuSource extends BaseDanmakuWebSocketSource {
    constructor(config) {
        super(config);
    }

    onConnected(socket) {
        super.onConnected(socket);
        socket.on('send_danmaku', (danmaku) => {
            this.sendDanmaku(JSON.parse(danmaku));
        });
    }

    onJoin(roomId) {
        super.onJoin(roomId);
    }

    onLeave(roomId) {
        super.onLeave(roomId);
    }

    onDisconnect(reason) {
        super.onDisconnect(reason);
    }
}

const src = new LocalDanmakuSource(localConfig);
src.listen();
src.logger.info('Local Danmaku Source Server is listening at port ' + src.port);
