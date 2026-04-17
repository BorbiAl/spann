import 'dotenv/config';
import { App, type AppOptions } from '@slack/bolt';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const socketMode = process.env['SLACK_SOCKET_MODE'] === 'true';

const options: AppOptions = socketMode
  ? {
      token: requireEnv('SLACK_BOT_TOKEN'),
      signingSecret: requireEnv('SLACK_SIGNING_SECRET'),
      socketMode: true,
      appToken: requireEnv('SLACK_APP_TOKEN'),
    }
  : {
      token: requireEnv('SLACK_BOT_TOKEN'),
      signingSecret: requireEnv('SLACK_SIGNING_SECRET'),
      port: Number(process.env['SLACK_PORT'] ?? 3001),
    };

export const app = new App(options);

// Accessibility middleware stub — wired in feature packages
app.use(async ({ next }) => {
  await next();
});

app.message(async ({ message, logger }) => {
  logger.debug('Received message', message);
});

(async () => {
  await app.start(Number(process.env['SLACK_PORT'] ?? 3001));
  console.log(`Spann Slack app running (socketMode=${socketMode})`);
})();
