const fs = require('fs');
const path = require('path');

const DEFAULT_PATTERN = '(?<who>^[^〈｛〖［〔【]{0,5})([〈｛〖［〔【])(?<text>[^〈｛〖［〔【〉｝〗］〕】]+)([$〉｝〗］〕】]?)';
const DEFAULT_DANMAKU_SOURCE = 'bilibili';

class Settings {
    dataDir = '';
    dataSaveInterval = 1000;
    botToken = '';
    botProxy = '';
    botAdmins = [];
    danmakuSources = [];

    globalConfig = {};
    chatsConfig = {};

    globalConfigPath = '';
    chatsConfigDir = '';

    _saveCallback = null;

    init(botConfig, autoSave) {
        if (this._saveCallback) {
            clearInterval(this._saveCallback);
        }

        // Read bot configuration
        this.dataDir = botConfig.dataDir;
        this.dataSaveInterval = botConfig.dataSaveInterval;
        this.botToken = botConfig.botToken;
        this.botProxy = botConfig.botProxy;
        this.botAdmins = botConfig.botAdmins;
        this.danmakuSources = botConfig.danmakuSources;
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir);
        }
        this.globalConfigPath = path.join(this.dataDir, 'global.json');

        // Read global chat default configuration
        let globalConfig = {};
        if (fs.existsSync(this.globalConfigPath)) {
            const buf = fs.readFileSync(this.globalConfigPath);
            globalConfig = JSON.parse(buf.toString('utf-8'));
        }
        if (!globalConfig.pattern) {
            globalConfig.pattern = DEFAULT_PATTERN;
        }
        if (!globalConfig.admin) {
            globalConfig.admin = [];
        }
        if (!globalConfig.danmakuSource) {
            globalConfig.danmakuSource = DEFAULT_DANMAKU_SOURCE;
        }
        this.globalConfig = globalConfig;

        // Read chats configuration
        this.chatsConfigDir = path.join(this.dataDir, 'chats');
        let chatsConfig = {};
        if (!fs.existsSync(this.chatsConfigDir)) {
            fs.mkdirSync(this.chatsConfigDir);
        }
        for (let filename of fs.readdirSync(this.chatsConfigDir)) {
            if (!filename.endsWith('.json') || filename.indexOf('.') !== filename.lastIndexOf('.')) {
                continue;
            }
            const [chatId] = filename.split('.');
            if (isNaN(chatId)) {
                continue;
            }
            const buf = fs.readFileSync(path.join(this.chatsConfigDir, filename));
            chatsConfig[chatId] = JSON.parse(buf.toString('utf-8'));
        }
        this.chatsConfig = chatsConfig;

        if (autoSave) {
            this._saveCallback = setInterval(() => this.saveConfig(), this.dataSaveInterval);
        }
    }

    saveConfig() {
        const globalConfigJson = JSON.stringify(this.globalConfig, null, 4);
        fs.writeFileSync(this.globalConfigPath, globalConfigJson);

        for (let chatId of Object.keys(this.chatsConfig)) {
            const chatConfigJson = JSON.stringify(this.chatsConfig[chatId], null, 4);
            fs.writeFileSync(path.join(this.chatsConfigDir, `${chatId}.json`), chatConfigJson);
        }
    }

    getChatConfig(chatId) {
        const result = Object.assign({}, this.globalConfig, this.chatsConfig[chatId]);
        if (!result.danmakuSource) {
            result.danmakuSource = this.globalConfig.danmakuSource;
        }
        return result;
    }

    getChatConfigs() {
        const result = {};
        for (let chatId of Object.keys(this.chatsConfig)) {
            result[chatId] = this.getChatConfig(chatId);
        }
        return result;
    }

    getDanmakuSource(id) {
        for (let item of this.danmakuSources) {
            if (item.id === id) {
                return item;
            }
        }
        return null;
    }

    unsetChatRoomId(chatId) {
        const c = this._ensureChatConfig(chatId);
        c.roomId = undefined;
    }

    setChatRoomId(chatId, roomId) {
        const c = this._ensureChatConfig(chatId);
        c.roomId = roomId;
    }

    setChatDanmakuSource(chatId, id) {
        const c = this._ensureChatConfig(chatId);
        if (id && !this.getDanmakuSource(id)) {
            throw new Error('Cannot find danmaku source by id: ' + id);
        }
        c.danmakuSource = id;
    }

    setChatPattern(chatId, pattern) {
        const c = this._ensureChatConfig(chatId);
        new RegExp(pattern);
        c.pattern = pattern;
    }

    setChatAdmin(chatId, admin) {
        const c = this._ensureChatConfig(chatId);
        if (admin instanceof Array) {
            c.admin = admin;
        } else {
            c.admin = [];
        }
    }

    deleteChatConfig(chatId) {
        delete this.chatsConfig[chatId];
    }

    setGlobalPattern(pattern) {
        new RegExp(pattern);
        this.globalConfig.pattern = pattern;
    }

    setGlobalAdmin(admin) {
        if (admin instanceof Array) {
            this.globalConfig.admin = admin;
        } else {
            this.globalConfig.admin = [];
        }
    }

    setGlobalDanmakuSource(id) {
        if (id && !this.getDanmakuSource(id)) {
            throw new Error('Cannot find danmaku source by id: ' + id);
        }
        this.globalConfig.danmakuSource = id;
    }

    _ensureChatConfig(chatId) {
        if (!Object.keys(this.chatsConfig).find(value => value == chatId)) {
            this.chatsConfig[chatId] = {};
        }
        return this.chatsConfig[chatId];
    }

    _printConfig() {
        console.log('Data dir: ', this.dataDir);
        console.log('Global config: ', this.globalConfig);
        console.log('Chats config: ', this.chatsConfig);
    }
}

module.exports = new Settings();
