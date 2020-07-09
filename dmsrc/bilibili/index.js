const { Danmaku, BaseDanmakuWebSocketSource } = require('../common');
const { KeepLiveWS, KeepLiveTCP } = require('bilibili-live-ws');
const cron = require('node-cron');
const bilibiliConfig = require('../../dmsrc.config').bilibili;

const BATCH_RECONNECT_DELAY = 1000 * 10;

function delay(ms) {
    return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

class BilibiliDanmakuSource extends BaseDanmakuWebSocketSource {
    constructor(config) {
        super(config);
        this.liveList = {};
        this.bilibiliProtocol = config.bilibiliProtocol;
        if (this.bilibiliProtocol !== 'ws' || this.bilibiliProtocol !== 'tcp') {
            console.log('Bilibili Danmaku Source configuration didn\'t specify protocol type. Set to ws as default.');
            this.bilibiliProtocol = 'ws';
        }
        if (config.reconnectCron) {
            console.log('Reconnect task schedule at "' + config.reconnectCron + '"');
            cron.schedule(config.reconnectCron, () => this.batchReconnect());
        }
    }

    isConnected(roomId) {
        const entity = this.liveList[roomId];
        return entity && entity.live;
    }

    createLive(roomId) {
        const live = this.bilibiliProtocol === 'ws' ? new KeepLiveWS(roomId) : new KeepLiveTCP(roomId);
        live.on('live', () => {
            console.log(`Connected to live room: ${roomId}`);
        });
        live.on('DANMU_MSG', (data) => {
            const dmInfo = data['info'];
            const dmSenderInfo = dmInfo[2];
            const dmSenderUid = dmSenderInfo[0];
            const dmSenderUsername = dmSenderInfo[1];
            const dmSenderUrl = 'https://space.bilibili.com/' + dmSenderUid;
            const dmText = dmInfo[1];
            const dmTimestamp = dmInfo[9]['ts'];

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
            console.error(`BilibiliDanmakuSource roomId=${roomId} error:`, e);
        });
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
                entity.live.close();
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
            entity.live.close();
            entity.live = this.createLive(roomId);
        } catch (e) {
            console.error(e);
        }
    }

    batchReconnect = async () => {
        console.log('Start batch reconnect task');
        for (let roomId of Object.keys(this.liveList)) {
            this.onReconnect(Number(roomId));
            await delay(BATCH_RECONNECT_DELAY);
        }
    }
}

const src = new BilibiliDanmakuSource(bilibiliConfig);
src.listen();
console.log('Bilibili Danmaku Source Server is listening at port ' + src.port);
