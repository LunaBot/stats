import {Client as DiscordClient } from 'discord.js';
import ws from 'ws';
import deepmerge from 'deepmerge';
import { Client as GraphqlWsClient, createClient as createGraphqlClient, SubscribePayload } from 'graphql-ws';

const sleep = (seconds: number) => new Promise<void>(resolve => setTimeout(() => resolve(), seconds * 1000));

// One hour in seconds
const ONE_HOUR_IN_MILLISECONDS = (60 * 1000) * 60;

interface GraphqlErrorLocation {
    line: number;
    column: number;
};
interface GraphqlError  {
    message: string,
    locations: GraphqlErrorLocation[],
    path: string[]
}
interface GraphqlResult<T> {
    data: T;
    errors?: GraphqlError[];
}

interface Options {
    /**
     * API key for stats
     */
    apiKey: string;
    /**
     * Discord bot clientID
     */
    clientID: string;
    /**
     * Discord.js client instance for the bot
     */
    client: DiscordClient
    /**
     * Stats auto-poster config
     */
    autoPost?: {
        /**
         * How often the stats should be pushed up
         */
        interval: number;
    }
    /**
     * Should we hide logs?
     */
    silent?: boolean;
}

export async function execute<T>(client: GraphqlWsClient, payload: SubscribePayload) {
    return new Promise<GraphqlResult<T>>((resolve, reject) => {
        let result: GraphqlResult<T>;
        client.subscribe<GraphqlResult<T>>(payload, {
            next: (data) => (result = data),
            error: reject,
            complete: () => resolve(result),
        });
    });
}

class Client {
    private url = 'wss://stats.lunabot.org/graphql';
    private graphqlWsClient?: GraphqlWsClient;
    private client: DiscordClient;
    private commands = new Map();
    options: {
        /**
         * API key for stats
         */
        apiKey: string;
        /**
         * Discord bot clientID
         */
        clientID: string;
        /**
         * Stats auto-poster config
         */
        autoPost: {
            /**
             * How often the stats should be pushed up
             */
            interval: number;
        };
        /**
         * Should we hide logs?
         */
        silent: boolean;
    };

    intervals: {
        autoPoster?: NodeJS.Timeout
    };

    constructor({ client, ...options }: Options) {
        this.client = client;
        this.options = {
            apiKey: options.apiKey,
            clientID: options.clientID,
            autoPost: {
                interval: options.autoPost?.interval ?? ONE_HOUR_IN_MILLISECONDS
            },
            silent: options.silent ?? false
        };
        this.intervals = {
            autoPoster: undefined
        };
    }

    private log(level: 'debug' | 'info' | 'error', message?: any, ...optionalParams: any[]): void {
        if (this.options.silent) return;
        console[level](message, ...optionalParams);
    }

    /**
     * Connect to ws gateway
     */
    async connect() {
        this.graphqlWsClient = createGraphqlClient({
            url: this.url,
            connectionParams: {
                clientID: this.options.clientID,
                apiKey: this.options.apiKey
            },
            webSocketImpl: ws,
            lazy: false,
        });

        interface Config {
            config: {
                autoPost: {
                    interval: number;
                };
                collectors: {
                    servers: boolean;
                    users: boolean;
                    commands: boolean;
                    popular: boolean;
                    memoryHeapTotal: boolean;
                    memoryHeapUsed: boolean;
                }
            }
        }

        // Get config
        const result = await execute<Config>(this.graphqlWsClient, {
            query: `
                query {
                    config {
                        autoPost {
                            interval # How often the auto poster should update the api
                        }
                        collectors {
                            servers # Count of servers
                            users # Count of users
                            commands # Count of commands used since last post
                            popular # Most popular commands used since last post
                            memoryHeapTotal # Total amount of heap memory allocated
                            memoryHeapUsed # Total amount of heap memory used by the current application
                        }
                    }
                }
            `
        });

        // Hit an error
        if (result.errors && result.errors.length >= 1) {
            throw new Error(result.errors?.[0].message);
        }

        // Got config, merge into options
        this.options = deepmerge(this.options, result.data.config);

        // Post inital query
        await this.sendStats().catch(error => this.log('error', error));
    }

    async sendStats() {
        const popularCommands = Array.from(this.commands.entries()).sort((a, b) => a[1] - b[1]).map(([name, count]) => ({ name, count }));
        const stats = {
            servers: this.client.guilds.cache.size,
            users: this.client.users.cache.size,
            commands: Array.from(this.commands.values()).reduce((a, b) => a + b, 0),
            popular: popularCommands,
            memoryHeapTotal: process.memoryUsage().heapTotal,
            memoryHeapUsed: process.memoryUsage().heapUsed
        };

        // Send stats
        const result = await execute(this.graphqlWsClient!, {
            query: `
                mutation($stats: StatsInput!) {
                    stats(stats: $stats) {
                        servers
                    }
                }
            `,
            variables: {
                stats
            }
        });

        // We hit a rate limit
        if (result.errors && result.errors[0].message.includes('You are doing that too often.')) {
            // Ensure minimum interval
            // If this is any quicker you'll hit rate limits
            if (this.options.autoPost.interval && this.options.autoPost.interval < ONE_HOUR_IN_MILLISECONDS) {
                // Clear existing interval
                clearInterval(this.options.autoPost.interval);

                // Log error
                this.log('error', 'Your autopost interval is too quick! Please use %sms or higher, you tried using %sms.', ONE_HOUR_IN_MILLISECONDS, this.options.autoPost.interval);
                this.log('debug', 'Waiting 60s to reschedule autoposter!');

                // Wait 60s
                await sleep(60);

                // Start auto poster again
                await this.startAutoPosting();
                return;
            } else {
                this.log('error', 'Failed autoposting as we hit a ratelimit, trying again in 60s.');
            }

            // Wait 60s
            await sleep(60);

            // Resend stats
            return this.sendStats();
        }

        // Hit an error
        if (result.errors && result.errors.length >= 1) {
            throw new Error(result.errors?.[0].message);
        }

        this.log('debug', 'Posted!', stats);
    }

    /**
     * Start autoposting stats
     */
    async startAutoPosting() {
        // Reconnect if we have to
        if (!this.client) {
            await this.connect();
        }

        // Ensure minimum interval
        // If this is any quicker you'll hit rate limits
        if (this.options.autoPost.interval && this.options.autoPost.interval <= ONE_HOUR_IN_MILLISECONDS) this.options.autoPost.interval = ONE_HOUR_IN_MILLISECONDS;
        this.log('debug', 'Scheduling autoposter to run every %sms!', this.options.autoPost.interval);

        // Run the auto poster once every interval
        this.intervals.autoPoster = setInterval(async () => {
            try {
                await this.sendStats();
            } catch (error) {
                this.log('error', 'Failed autoposting with "%s"', error.message);
            }
        }, this.options.autoPost.interval);
    }

    /**
     * Record a command has been used
     */
    async commandUsed(commandName) {
        if (!commandName) throw new Error('commandName argument missing');

        const commandCount = (this.commands.get(commandName) ?? 0) + 1;
        this.commands.set(commandName, commandCount);
    }
}

export const createClient = (options: Options) => {
    return new Client(options);
};
