import { GraphQLSchema } from 'graphql';
import { makeExecutableSchema } from 'graphql-tools';
import { typeDefs } from './type-defs';
import { resolvers } from './resolvers';
import { createRateLimitDirective } from 'graphql-rate-limit';

export const schema: GraphQLSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective({ identifyContext: (ctx) => ctx.id })
  }
});