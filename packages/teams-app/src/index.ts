import 'dotenv/config';
import * as restify from 'restify';
import { BotFrameworkAdapter, TurnContext } from 'botbuilder';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const adapter = new BotFrameworkAdapter({
  appId: requireEnv('TEAMS_APP_ID'),
  appPassword: requireEnv('TEAMS_APP_PASSWORD'),
  channelAuthTenant: process.env['TEAMS_TENANT_ID'],
});

adapter.onTurnError = async (context: TurnContext, error: Error) => {
  console.error('Teams adapter error:', error);
  await context.sendActivity('Something went wrong. Please try again.');
};

const server = restify.createServer({ name: 'spann-teams' });
server.use(restify.plugins.bodyParser());

server.post('/api/messages', async (req, res) => {
  await adapter.processActivity(req as never, res as never, async (context) => {
    // Accessibility middleware will be wired here
    console.debug('Teams activity type:', context.activity.type);
  });
});

const port = Number(process.env['TEAMS_PORT'] ?? 3002);
server.listen(port, () => {
  console.log(`Spann Teams app listening on port ${port}`);
});
