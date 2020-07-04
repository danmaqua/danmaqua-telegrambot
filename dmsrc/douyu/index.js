const { Danmaku, BaseDanmakuWebSocketSource } = require('../common');
const DouyuDM = require('douyudm');
const douyuConfig = require('../../dmsrc.config').douyu;

class DouyuDanmakuSource extends BaseDanmakuWebSocketSource {
    constructor(config) {
        super(config);
        this.liveList = {};
    }

    isConnected(roomId) {
        const entity = this.liveList[roomId];
        return entity && entity.live;
    }

    createLive(roomId) {
        const live = new DouyuDM(roomId, { debug: false });
        live.on('connect', () => {
            console.log(`Connect to live room: ${roomId}`);
        });
        live.on('chatmsg', (data) => {
            const dmSenderUid = data.uid;
            const dmSenderUsername = data.nn;
            const dmSenderUrl = 'https://yuba.douyu.com/wbapi/web/jumpusercenter?id=' + dmSenderUid +
                '&name=' + encodeURIComponent(dmSenderUsername);
            const dmText = data.txt;
            const dmTimestamp = data.cst;

            const danmaku = new Danmaku({
                sender: {
                    uid: dmSenderUid,
                    username: dmSenderUsername,
                    url: dmSenderUrl
                },
                text: dmText,
                timestamp: dmTimestamp,
                roomId: roomId
            });
            this.sendDanmaku(danmaku);
        });
        live.on('error', (e) => {
            console.log(`DouyuDanmakuSource roomId=${roomId} error:`, e);
        });
        live.run();
        return live;
    }

    onJoin(roomId) {
        super.onJoin(roomId);
        if (this.isConnected(roomId)) {
            this.liveList[roomId].counter++;
            return;
        }
        try {
            this.liveList[roomId] = {
                live: this.createLive(roomId),
                counter: 1
            };
        } catch (e) {
            console.error(e);
        }
    }

    onLeave(roomId) {
        super.onLeave(roomId);
        if (!this.isConnected(roomId)) {
            return;
        }
        try {
            const entity = this.liveList[roomId];
            entity.counter--;
            if (entity.counter <= 0) {
                console.log(`Room ${roomId} is no longer used. Close now.`);
                entity.live.logout();
                delete this.liveList[roomId];
            }
        } catch (e) {
            console.error(e);
        }
    }

    onReconnect(roomId) {
        super.onReconnect(roomId);
        if (!this.isConnected(roomId)) {
            return;
        }
        try {
            const entity = this.liveList[roomId];
            entity.live.logout();
            entity.live = this.createLive(roomId);
        } catch (e) {
            console.error(e);
        }
    }
}

const src = new DouyuDanmakuSource(douyuConfig);
src.listen();
console.log('Douyu Danmaku Source Server is listening at port ' + src.port);
