import ws from 'ws';
import { execute } from './client';
import { createClient as createGraphqlClient } from 'graphql-ws';

(async () => {
    const url = process.env.STATS_URL ?? 'wss://stats.lunabot.org/graphql';
    const clientID = process.env.CLIENT_ID ?? process.argv[2];

    if (!clientID) {
        console.error('Please set the CLIENT_ID env.');
        process.exit(1);
    }

    const graphqlWsClient = createGraphqlClient({
        url,
        connectionParams: {
            clientID
        },
        webSocketImpl: ws,
        lazy: false,
    });

    // Get api key
    const result = await execute<{ register: { apiKey } }>(graphqlWsClient, {
        query: `
            mutation($clientID: String!) {
                register(clientID: $clientID) {
                    apiKey
                }
            }
        `,
        variables: {
            clientID
        }
    });

    // Hit an error
    if (result.errors && result.errors.length >= 1) {
        console.log('\nError: %s', result.errors?.[0].message);
        return;
    }

    // Show API key
    console.log(`\nAPI key: %s\nYou won't be shown this again, please copy it down now!\n`, result.data.register.apiKey);
    process.exit(0);
})();