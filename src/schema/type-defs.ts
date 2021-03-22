import { gql } from 'apollo-server-express';

export const typeDefs = gql`
    directive @rateLimit(
      max: Int,
      window: String,
      message: String,
      identityArgs: [String],
      arrayLengthField: String
    ) on FIELD_DEFINITION

    type Stats {
        servers: Int!
    }

    type ConfigAutoPost {
        interval: Int!
    }

    type ConfigCollectors {
        servers: Boolean!
        users: Boolean!
        commands: Boolean!
        popular: Boolean!
        memoryHeapTotal: Boolean!
        memoryHeapUsed: Boolean!
    }

    type Config {
        autoPost: ConfigAutoPost
        collectors: ConfigCollectors
    }

    type Query {
        ping: String!
        stats: [Stats!]
        config: Config!
    }

    input Command {
        name: String!
        count: Int!
    }

    input StatsInput {
        servers: Int! # Count of servers
        users: Int! # Count of users
        commands: Int! # Count of commands used since last post
        popular: [Command!] # Most popular commands used since last post
        memoryHeapTotal: Int! # Total amount of heap memory allocated
        memoryHeapUsed: Int! # Total amount of heap memory used by the current application
    }

    type ApiKey {
        apiKey: String!
    }

    type Mutation {
        register(clientID: String!): ApiKey @rateLimit(window: "1m", max: 1, message: "You are doing that too often.")
        stats(stats: StatsInput!): Stats! @rateLimit(window: "1h", max: 1, message: "You are doing that too often.")
    }
`;
