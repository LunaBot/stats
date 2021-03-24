import http from 'http';
import ws from 'ws';
import { makeServer } from 'graphql-ws';
import { execute, subscribe } from 'graphql';
import { schema } from './schema';
import { validate } from './auth';
import { Forbidden } from './errors';
import { gql } from 'apollo-server-express';

// extra in the context
interface Extra {
  readonly request: http.IncomingMessage;
}

// create http server
const server = http.createServer(function weServeSocketsOnly(_, res) {
  res.writeHead(200);
  res.end();
});

// make graphql server
const gqlServer = makeServer<Extra>({
  schema,
  execute,
  subscribe,
  context: (ctx, msg, args) => {
    return ctx;
  },
  onSubscribe: async (ctx, message) => {
    const parsedQuery = gql`${message.payload.query}`;
    const ops = parsedQuery.definitions.filter(definition => definition.kind === 'OperationDefinition');
    // @ts-expect-error
    const operationName = ops[0].selectionSet.selections[0].name.value;
    const hasApiKey = ctx.connectionParams?.apiKey;
    const hasMultipleOperations = ops.length >= 2;
    const isOperationPrivate = !['register', '__schema'].includes(operationName);

    // Only allow the "register" mutation and "__schema" query to bypass authentication
    if (hasApiKey || hasMultipleOperations || isOperationPrivate) {
      await validate(ctx.connectionParams);
    }
  }
});

// create websocket server
const wsServer = new ws.Server({
  server,
  path: '/graphql',
});

// implement
wsServer.on('connection', (socket, request) => {
  // you may even reject the connection without ever reaching the lib
  // return socket.close(4403, 'Forbidden');

  // pass the connection to graphql-ws
  const closed = gqlServer.opened(
    {
      protocol: socket.protocol, // will be validated
      send: (data) =>
        new Promise((resolve, reject) => {
          // control your data flow by timing the promise resolve
          socket.send(data, (err) => (err ? reject(err) : resolve()));
        }),
      close: (code, reason) => socket.close(code, reason), // for standard closures
      onMessage: (cb) => {
        socket.on('message', async (event) => {
          try {
            // wait for the the operation to complete
            // - if init message, waits for connect
            // - if query/mutation, waits for result
            // - if subscription, waits for complete
            await cb(event.toString());
          } catch (err) {
            // all errors that could be thrown during the
            // execution of operations, will be caught here
            if (err instanceof Forbidden) {
              // your magic
            } else {
              socket.close(1011, err.message);
            }
          }
        });
      },
    },
    // pass request to the extra
    { request },
  );

  // notify server that the socket closed
  socket.once('close', (code, reason) => closed(code, reason));
});

server.listen(4000, (...args) => {
  console.log('Server started at ws://localhost:4000');
});