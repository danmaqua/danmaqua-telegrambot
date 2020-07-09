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
    userStatesPath = '';

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
            fs.mkdirSync(path.resolve(this.dataDir));
        }
        this.globalConfigPath = path.join(this.dataDir, 'global.json');
        this.chatsConfigDir = path.join(this.dataDir, 'chats');
        this.userStatesPath = path.join(this.dataDir, 'user_states.json');

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

        // Read user states configuration
        let userStates = {};
        if (fs.existsSync(this.userStatesPath)) {
            const buf = fs.readFileSync(this.userStatesPath);
            userStates = JSON.parse(buf.toString('utf-8'));
        }
        this.userStates = userStates;

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

        const userStatesJson = JSON.stringify(this.userStates, null, 4);
        fs.writeFileSync(this.userStatesPath, userStatesJson);
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

    setChatBlockedUsers(chatId, users) {
        const c = this._ensureChatConfig(chatId);
        c.blockedUsers = users || [];
    }

    addChatBlockedUsers(chatId, userId) {
        if (userId.indexOf('_') < 0) {
            console.error('Cannot add user id=' + userId + ' to block list. Please check id format.');
            return;
        }
        const c = this._ensureChatConfig(chatId);
        if (!c.blockedUsers) {
            c.blockedUsers = [];
        }
        const index = c.blockedUsers.indexOf(userId);
        if (index < 0) {
            c.blockedUsers.push(userId);
        }
    }

    removeChatBlockedUsers(chatId, userId) {
        if (userId.indexOf('_') < 0) {
            console.error('Cannot add user id=' + userId + ' to block list. Please check id format.');
            return;
        }
        const c = this._ensureChatConfig(chatId);
        if (!c.blockedUsers) {
            c.blockedUsers = [];
        }
        const index = c.blockedUsers.indexOf(userId);
        if (index >= 0) {
            c.blockedUsers.splice(userId, 1);
        }
    }

    containsChatBlockedUser(chatId, userId, source) {
        if (source) {
            userId = source + '_' + userId;
        }
        if (userId.indexOf('_') < 0) {
            console.error('Cannot add user id=' + userId + ' to block list. Please check id format.');
            return;
        }
        const c = this._ensureChatConfig(chatId);
        if (!c.blockedUsers) {
            c.blockedUsers = [];
        }
        return c.blockedUsers.indexOf(userId) >= 0;
    }

    getChatBlockedUsers(chatId) {
        return this.getChatConfig(chatId).blockedUsers.map((value) => {
            const [dmSrc, userId] = value.split('_');
            return { src: dmSrc, uid: userId };
        });
    }

    deleteChatConfig(chatId) {
        delete this.chatsConfig[chatId];
        fs.unlinkSync(path.join(this.chatsConfigDir, `${chatId}.json`));
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

    getUserStateCode(userId) {
        const state = this.userStates[userId];
        if (state) {
            return state.code;
        } else {
            return -1;
        }
    }

    getUserStateData(userId) {
        const state = this.userStates[userId];
        if (state) {
            return state.data;
        } else {
            return null;
        }
    }

    setUserState(userId, code, data) {
        if (!Object.keys(this.userStates).find(v => v === userId)) {
            this.userStates[userId] = { code, data: data || null };
        } else {
            this.userStates[userId].code = code;
            if (data !== undefined) {
                this.userStates[userId].data = data;
            }
        }
    }

    clearUserState(userId) {
        delete this.userStates[userId];
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
        console.log('User states: ', this.userStates);
    }
}

module.exports = new Settings();
