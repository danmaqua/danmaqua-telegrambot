const fs = require('fs');
const botConfig = require('../bot.config');
const settingsV2 = require('./settings');

function transferDataFromV1() {
    if (!fs.existsSync('./data/db.json')) {
        console.error('Cannot find ./data/db.json database file! Transfer has been stopped.');
        return;
    }
    const buf = fs.readFileSync('./data/db.json');
    const oldData = JSON.parse(buf.toString('utf-8'));
    settingsV2.init(botConfig, false);
    console.log('Set global admin to: ' + oldData.admins);
    settingsV2.setGlobalAdmin(oldData.admins);
    for (let record of oldData.records) {
        const chatId = record.chatId;
        console.log('Found chat record: id=' + chatId);
        const blockedUsers = record.options.blockedUsers.map((value) => 'bilibili_' + value);
        settingsV2.setChatRoomId(chatId, record.roomId);
        settingsV2.setChatDanmakuSource(chatId, 'bilibili');
        settingsV2.setChatBlockedUsers(chatId, blockedUsers);
        console.log('Saved chat config: id=' + chatId + ' value=' + JSON.stringify(settingsV2.chatsConfig[chatId]));
    }
    console.log('Transfer has been finished. Now saving...');
    settingsV2.saveConfig();
    console.log('Done!');
}

transferDataFromV1();
