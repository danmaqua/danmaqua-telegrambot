const settings = require('./settings');
const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');

class BotWrapper {
    constructor({ botConfig, botToken, agent }) {
        this.botConfig = botConfig;
        this.bot = new Telegraf(botToken, { telegram: { agent } });
        this.botUser = null;
        this.commandRecords = [];
        this.startCommandSimpleMessage = '';
        this.helpCommandMessageHeader = '';

        this.bot.start(this.onCommandStart);
        this.bot.command('help', this.onCommandHelp);
    }

    start = async () => {
        console.log('Bot is launching...');
        while (!this.botUser) {
            try {
                this.botUser = await this.bot.telegram.getMe();
            } catch (e) {
                console.error(e);
            }
        }
        return await this.bot.launch();
    };

    getChat = async (chatId) => {
        try {
            return await this.bot.telegram.getChat(chatId);
        } catch (e) {
            return null;
        }
    };

    hasUserPermissionForBot = (id) => {
        return this.botConfig.botAdmins.indexOf(id) !== -1;
    };

    hasPermissionForChat = (id, chatId) => {
        return this.hasUserPermissionForBot(id) || settings.getChatConfig(chatId).admin.indexOf(id) !== -1;
    };

    canSendMessageToChat = async (chatId) => {
        try {
            let member = await this.bot.telegram.getChatMember(chatId, this.botUser.id);
            return member.status === 'member' || member.status === 'administrator' || member.status === 'creator';
        } catch (ignored) {
        }
        return false;
    };

    checkUserPermissionForBot = async (ctx, next) => {
        if (!this.hasUserPermissionForBot(ctx.message.from.id)) {
            ctx.reply('No permission for bot');
            return;
        }
        await next();
    };

    checkUserPermissionForChat = (chatId) => {
        return async (ctx, next) => {
            if (!this.hasPermissionForChat(ctx.message.from.id, chatId)) {
                ctx.reply('No permission for chat');
                return;
            }
            await next();
        };
    };

    addCommand({
                   command,
                   title,
                   description,
                   help,
                   botAdminOnly = false,
                   callback
    }) {
        if (!command) {
            throw new Error('command cannot be empty');
        }
        if (!title) {
            throw new Error('title cannot be empty');
        }
        if (!description) {
            throw new Error('description cannot be empty');
        }
        if (!help) {
            throw new Error('help cannot be empty');
        }
        if (this.commandRecords.find((record) => record.command === command)) {
            throw new Error(`command "${command}" has been added`);
        }
        this.commandRecords.push({
            command,
            title,
            description,
            help,
            botAdminOnly,
        });
        if (botAdminOnly) {
            this.bot.command(command, this.checkUserPermissionForBot, callback);
        } else {
            this.bot.command(command, callback);
        }
    }

    addCommands(commands) {
        commands.forEach((item) => this.addCommand(item));
    }

    onCommandStart = async (ctx) => {
        return ctx.reply(this.startCommandSimpleMessage);
    };

    onCommandHelp = async (ctx) => {
        let [_, commandName] = ctx.message.text.split(' ');
        if (commandName) {
            const rec = this.commandRecords.find((record) => record.command === commandName);
            if (!rec) {
                return ctx.reply(`Cannot find command: ${commandName}`);
            } else {
                let res = 'Help for command /' + rec.command.replace(/_/g, '\\_');
                res += ' :\n' + rec.help;
                return ctx.reply(res, Extra.markdown());
            }
        }
        let res = this.helpCommandMessageHeader + '\n';
        res += 'Supported commands: \n';
        for (let command of this.commandRecords) {
            res += '/' + command.command.replace(/_/g, '\\_') +
                ' : **' + command.title + '**' +
                ' - ' + command.description + '\n';
        }
        if (this.commandRecords.length < 1) {
            res += 'No public commands.\n';
        }
        res += '\nInput `/help [command]` to query documentation for the command you want to know.';
        return ctx.reply(res, Extra.markdown());
    }
}

module.exports = BotWrapper;
