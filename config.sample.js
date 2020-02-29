/**
 * Danmaqua Telegram Bot 配置样例
 * ======
 * 请将 config.sample.js 复制并改名为 config.js 再进行修改。
 * 程序将读取运行目录下的 config.js。
 */
module.exports = {
    // LowDB 数据库（JSON）路径
    dbPath: './data/db.json',
    // Telegram Bot Token
    botToken: null,
    // Telegram Bot API 代理服务器
    botProxy: null,
    // Bilibili API 代理服务器
    biliProxy: null,
    // 弹幕匹配规则
    pattern: /(?<who>[^〈｛『〖［〔「【]*)[〈｛『〖［〔「【](?<text>[^〉｝『〗］〕」】]*)[$〉｝『〗］〕」】]?/,
    // 默认管理员 ID 列表，空数组代表允许任何人使用 Bot 进行订阅
    defaultAdmins: [],
};
