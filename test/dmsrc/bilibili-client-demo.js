const ioClient = require('socket.io-client');
const bilibiliConfig = require('../../dmsrc.config').bilibili;

const socket = ioClient('http://localhost:' + bilibiliConfig.port, {
    transportOptions: {
        polling: {
            extraHeaders: {
                'Authorization': bilibiliConfig.basicAuth
            }
        }
    }
});

socket.on('connect', () => {
   console.log('Connected!');
   socket.emit('join', 6);
   socket.emit('leave', 6);
   socket.emit('join', 21545232);
});

socket.on('danmaku', (danmaku) => {
    console.log('Received danmaku: ', danmaku);
});
