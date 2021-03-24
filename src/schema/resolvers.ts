import EnMap from 'enmap';
import { keys, generateKey } from '../auth';

const db = new EnMap('stats');

const ONE_HOUR_IN_MILLISECONDS = (60 * 1000) * 60;

export const resolvers = {
    Query: {
        ping: () => 'pong',
        stats: (_, { clientID, ...others }, ...args) => {
            const row = db.get(clientID);
            return row ? row.stats : [];
        },
        config() {
            return {
                autoPost: {
                    interval: ONE_HOUR_IN_MILLISECONDS
                },
                collectors: {
                    servers: true,
                    users: true,
                    commands: true,
                    popular: true,
                    memoryHeapTotal: true,
                    memoryHeapUsed: true
                }
            };
        }
    },
    Mutation: {
        register(_, { clientID }) {
            if (keys.has(clientID)) {
                throw new Error('ClientID is already registered!');
            }

            const key = generateKey();
            keys.set(clientID, key.apiKey);
            return {
                apiKey: key.apiKey
            };
        },
        stats(_, { stats }, { connectionParams }) {
            const clientID = connectionParams.clientID;

            // Create record if it doesn't exist
            if (!db.has(clientID)) {
                db.set(clientID, { stats: [] });
            }

            // Update record
            const record = db.get(clientID);
            record.stats.push(stats);
            db.set(clientID, record);

            console.log('\n');
            console.log('Recieved stats from %s', clientID);
            console.log(stats);
            console.log('\n');

            // Return newly added stats object
            return stats;
        }
    }
};
