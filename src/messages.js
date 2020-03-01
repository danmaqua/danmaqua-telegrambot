module.exports = {
    WELCOME_MSG: '欢迎使用 Danmaqua Bot 早期测试版本！\n' +
        '了解使用方法请输入 /help ，程序仍不稳定，数据设定可能会丢失，敬请理解。\n\n' +
        '项目源码以 GPLv3 协议发布于 https://github\\.com/danmaqua/danmaqua\\-telegrambot\n' +
        'Android App 版「悬浮字幕」体验更佳，请访问 https://danmaqua\\.github\\.io 获取。\n' +
        '特别感谢同传翻译大佬们的无私奉献为 VTB 观众提供中文字幕。',

    HELP_MSG: '目前只允许管理员使用，请联系当前 Bot 管理员获取权限，或自行搭建 Bot。\n' +
        '当前支持的命令：\n' +
        '`/subscribe [房间号] [目标聊天 ID（可选）]` ：订阅房间的同传弹幕并发送到目标聊天\n' +
        '`/unsubscribe [目标聊天 ID（可选）]` ：取消目标聊天的房间订阅\n' +
        '`/block_user [B 站用户 ID] [目标聊天 ID（可选）]` : 屏蔽/解除屏蔽特定用户的弹幕\n' +
        '`/set_hide_username [目标聊天 ID（可选）]` ：开关目标聊天的同传弹幕用户名显示\n\n' +
        '项目源码以 GPLv3 协议发布于 https://github\\.com/danmaqua/danmaqua\\-telegrambot\n' +
        'Android App 版「悬浮字幕」体验更佳，请访问 https://danmaqua\\.github\\.io 获取。\n' +
        '特别感谢同传翻译大佬们的无私奉献为 VTB 观众提供中文字幕。',

    NO_PERMISSION_MSG: '很抱歉，你无法设置这个机器人，请联系这个机器人的管理员进行添加权限。',
    CHAT_CANNOT_SEND_MSG: '你指定的目标不允许机器人发送消息，请检查机器人是否被禁言和是否未加入聊天。',

    SUBSCRIBE_HELP_MSG: '订阅房间命令格式：`/subscribe [房间号] [目标聊天 ID]`\n' +
        '目标聊天 ID 为选填，如不填将以当前聊天作为弹幕通知目标。',
    SUBSCRIBE_ROOM_INVALID_MSG: '要订阅的房间号必须大于 0。',
    SUBSCRIBE_DUPLICATED_MSG: '你已订阅这个房间了。',
    SUBSCRIBE_SUCCESS_MSG: (roomId) => `订阅 ${roomId} 成功。`,
    UNSUBSCRIBE_SUCCESS_MSG: (roomId) => `已取消订阅 ${roomId} 房间。`,
    NEED_SUBSCRIBE_MSG: (chatId) => `你未在 ${chatId} 订阅任何房间。`,

    HIDE_USERNAME_UPDATED_MSG: (chatId, enabled) => `现在 ${chatId} ` +
        (enabled ? '不再' : '将') +
        '显示发送弹幕的用户名。',
    BLOCKED_USER_UPDATED_MSG: (userId, blocked) => `用户 ${userId} 的弹幕已` +
        (blocked ? '加入' : '解除') +
        `封禁。`
};
