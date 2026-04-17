import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  type Message,
} from 'discord.js';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Spann Discord bot ready as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  // Accessibility middleware will be wired here
  console.debug(`[${message.guild?.name ?? 'DM'}] ${message.author.tag}: ${message.content}`);
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

void client.login(requireEnv('DISCORD_BOT_TOKEN'));
