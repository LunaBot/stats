# Stats


## Installation

Install the library using either `npm` or `pnpm`.
If you're using `pnpm` please install `tsup` and `typescript` before installing stats.

```bash
# npm
npm i github:lunabot/stats#main

# pnpm
pnpm i github:lunabot/stats#main
```


```ts
import { Client as DiscordClient } from 'discord.js';
import { createClient } from 'stats';

(async () => {
    // Envs
    const apiKey = process.env.STATS_API_KEY;
    const botToken = process.env.BOT_TOKEN;
    const clientID = process.env.CLIENT_ID;

    if (!apiKey) {
        console.error('Please set the STATS_API_KEY env.');
        process.exit(1);
    }

    if (!botToken) {
        console.error('Please set the BOT_TOKEN env.');
        process.exit(1);
    }

    if (!clientID) {
        console.error('Please set the CLIENT_ID env.');
        process.exit(1);
    }

    // Clients
    const client = new DiscordClient();
    const statsClient = createClient({
        apiKey,
        clientID,
        client,
        silent: true
    });

    // Bot's config
    const config = {
        prefix: '!'
    };

    client.on('ready', async () => {
        // Connect to stats ws gateway
        await statsClient.connect().catch(error => {
            // Don't log errors in production
            if (process.env.NODE_ENV === 'production') return;
            console.error(error);
        });
    });

    client.on('message', async (message) => {
        if (!message.content.startsWith(config.prefix)) return;

        // Get command name without the prefix
        const commandName = message.content.split(' ')[0].toLowerCase().substring(config.prefix.length);

        // Command was used
        await statsClient.commandUsed(commandName);
    });

    // Connect to discord's ws gateway
    await client.login(botToken);
})();
```