const ioClient = require('socket.io-client');
const douyuConfig = require('../../dmsrc.config').douyu;

const socket = ioClient('http://localhost:' + douyuConfig.port, {
    transportOptions: {
        polling: {
            extraHeaders: {
                'Authorization': douyuConfig.basicAuth
            }
        }
    }
});

socket.on('connect', () => {
   console.log('Connected!');
   socket.emit('join', 1126960);
});

socket.on('danmaku', (danmaku) => {
    console.log('Received danmaku: ', danmaku);
});
