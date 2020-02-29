async function canSendMessageToChat(telegram, chatId, userId) {
    try {
        let member = await telegram.getChatMember(chatId, userId);
        return member.status === 'member' || member.status === 'administrator' || member.status === 'creator';
    } catch (ignored) {
    }
    return false;
}

module.exports = {
    canSendMessageToChat
};
