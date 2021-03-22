# Stats


### Installation

```bash
npm i github:lunabot/stats
```


```ts
import { createClient } from '@lunabot/stats';

(async () => {
    // Envs
    const apiKey = process.env.STATS_API_KEY;
    const botToken = process.env.BOT_TOKEN;

    // Clients
    const client = new DiscordClient();
    const statsClient = createClient({
        apiKey,
        client
    });

    // Bot's config
    const config = {
        prefix: '!'
    };

    // Connect to stats ws gateway
    await statsClient.connect().catch(error => {
        if (process.env.NODE_ENV === 'production') return;
        console.error(error);
    });

    client.on('ready', async () => {
        // Enable stats autoposting
        await statsClient.startAutoPosting().catch(error => {
            if (process.env.NODE_ENV === 'production') return;
            console.error(error);
        });
    });

    client.on('message', async (message) => {
        if (!message.content.startsWith(config.prefix)) return;

        // Get command name without the prefix
        const commandName = message.content.split(' ')[0].toLowerCase().substring(prefix.length);

        // Command was used
        await statsClient.commandUsed(commandName);
    });

    client.login(botToken);
})();
```