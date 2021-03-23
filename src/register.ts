import ws from 'ws';
import { execute } from './client';
import { createClient as createGraphqlClient } from 'graphql-ws';

(async () => {
    const clientID = process.env.CLIENT_ID ?? process.argv[2];

    const graphqlWsClient = createGraphqlClient({
        url: 'wss://stats.lunabot.org/graphql',
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
        console.log('\nError: "%s"', result.errors?.[0].message);
        return;
    }

    // Show API key
    console.log(`\nAPI key: %s\nYou won't be shown this again, please copy it down now!\n`, result.data.register.apiKey);
})();