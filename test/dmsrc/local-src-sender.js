const ioClient = require('socket.io-client');
const localConfig = require('../../dmsrc.config').local;

const socket = ioClient('http://localhost:' + localConfig.port, {
    transportOptions: {
        polling: {
            extraHeaders: {
                'Authorization': localConfig.basicAuth
            }
        }
    }
});

socket.on('connect', () => {
    console.log('Connected!');
    socket.emit('send_danmaku', JSON.stringify({
        sender: {
            uid: 1,
            username: 'fython',
            url: 'http://localhost/fython'
        },
        text: '【Test danmaku',
        timestamp: Date.now(),
        roomId: 114514
    }));
});

socket.on('danmaku', () => socket.disconnect());
socket.on('disconnect', () => process.exit());
