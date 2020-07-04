const botConfig = require('../../bot.config');
const settings = require('../../bot/settings');
settings.init(botConfig, false);
const api = require('../../bot/api');

const man = new api.DanmakuSourceManager();
man.on('danmaku', (danmaku) => console.log(danmaku));
man.joinRoom('bilibili', 14327465);
