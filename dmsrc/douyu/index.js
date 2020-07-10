const { Danmaku, BaseDanmakuWebSocketSource } = require('../common');
const DouyuDM = require('douyudm');
const cron = require('node-cron');
const douyuConfig = require('../../dmsrc.config').douyu;

const BATCH_RECONNECT_DELAY = 1000 * 10;

function delay(ms) {
    return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

class DouyuDanmakuSource extends BaseDanmakuWebSocketSource {
    constructor(config) {
        super(config);
        this.liveList = {};
        if (config.reconnectCron) {
            this.logger.info('Reconnect task schedule at "' + config.reconnectCron + '"');
            cron.schedule(config.reconnectCron, () => this.batchReconnect());
        }
    }

    isConnected(roomId) {
        const entity = this.liveList[roomId];
        return entity && entity.live;
    }

    createLive(roomId) {
        const live = new DouyuDM(roomId, { debug: false });
        live.on('connect', () => {
            this.logger.debug(`Connect to live room: ${roomId}`);
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
            this.logger.error(`DouyuDanmakuSource roomId=${roomId} error:`, e);
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
            this.logger.error(e);
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
                this.logger.debug(`Room ${roomId} is no longer used. Close now.`);
                entity.live.logout();
                delete this.liveList[roomId];
            }
        } catch (e) {
            this.logger.error(e);
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
            this.logger.error(e);
        }
    }

    batchReconnect = async () => {
        this.logger.debug('Start batch reconnect task');
        for (let roomId of Object.keys(this.liveList)) {
            this.onReconnect(Number(roomId));
            await delay(BATCH_RECONNECT_DELAY);
        }
    }
}

const src = new DouyuDanmakuSource(douyuConfig);
src.listen();
src.logger.info('Douyu Danmaku Source Server is listening at port ' + src.port);
