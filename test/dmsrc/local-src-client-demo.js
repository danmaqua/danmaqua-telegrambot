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
    socket.emit('join', 114514);
});

socket.on('danmaku', (danmaku) => {
    console.log('Received danmaku: ', danmaku);
});
