import uuidAPIKey from 'uuid-apikey';
import EnMap from 'enmap';

export const keys = new EnMap('keys');

export const generateKey = () => uuidAPIKey.create();

interface ConnectionParams {
    clientID?: string;
    apiKey?: string;
}

export const validate = async ({ clientID, apiKey }: ConnectionParams = {}) => {
    const throwErrorAndLog = (message) => {
        console.log('[%s] %s', clientID, message);
        throw new Error(message);
    }

    if (!clientID) return throwErrorAndLog('Missing clientID');
    if (!apiKey) return throwErrorAndLog('Missing apiKey');
    if (!keys.has(clientID)) return throwErrorAndLog('Please register this clientID first!');
    if (keys.get(clientID) !== apiKey) return throwErrorAndLog('Invalid API key!');

    // Success
    return true;
}