const fs = require('fs');
const path = require('path');
const { Client, Collection, Intents, MessageEmbed } = require('discord.js');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGES] });
const Redis = require('./utility/redis');
const config = require('../config.json');
const perspectiveAPI = require('./utility/perspectiveapi');

client.config = config;

client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, '/commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(path.join(__dirname, '/commands', file));
	client.commands.set(command.data.name, command);
}

client.connections = new Map();
client.db = new Redis();

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	client.user.setPresence({ activities: [{ name: 'censorship' }], status: 'online' });
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.run(interaction);
	}
	catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply('There was an error while executing this command.');
		}
		else {
			await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
		}
	}
});

const multipliers = {
	'891461342400249886': 999,
	'891464376735916163': 999,
	'893646954003828757': 999,
	'891461451833815071': 1.7,
};

client.on('messageCreate', async message => {
	if (client.config.whitelistedGuilds.includes(message.guild.id)) {
		let multiplier = 1;

		for (const roleId in multipliers) {
			const roleMultiplier = multipliers[roleId];

			if (message.member.roles.cache.has(roleId)) {
				multiplier = roleMultiplier;
				break;
			}
		}

		if (multiplier >= 100) return;

		perspectiveAPI.getResults(message.content).then(async (results) => {
			const shouldCensor = perspectiveAPI.shouldCensor(results, multiplier);

			if (shouldCensor.shouldCensor) {
				await message.delete();
				await message.channel.send(`<@${message.author.id}>\n**Your message was detected as inappropriate and was moderated.**\n:flag_cn: **Glory to the CCP!**`);

				const logChannel = message.guild.channels.cache.get(message.guild.id == '891421040285212682' ? '895780692770832405' : '895872441606357032');

				if (logChannel) {
					const embed = new MessageEmbed()
						.setTitle('Message censored')
						.setColor(0x7d0505)
						.setDescription(`\`\`\`${message.content}\`\`\``)
						.addField('Author', message.author.tag ?? 'Unknown')
						.addField('Field', shouldCensor.initiatingField.toString() ?? 'Unknown')
						.addField('Score', shouldCensor.initiatingScore.toString() ?? 'Unknown')
						.addField('Censorship score', shouldCensor.censorValue.toString() ?? 'Unknown')
						.addField('Multiplier', multiplier.toString() ?? 'Unknown');

					logChannel.send({ embeds: [embed] });
				}
			}
		}).catch(console.warn);
	}
});

client.login(process.env.BOT_TOKEN);
