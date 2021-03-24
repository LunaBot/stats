import uuidAPIKey from 'uuid-apikey';
import EnMap from 'enmap';

export const keys = new EnMap('keys');

export const generateKey = () => uuidAPIKey.create();

interface ConnectionParams {
    clientID?: string;
    apiKey?: string;
}

const throwErrorAndLog = (message) => {
    console.log(message);
    throw new Error(message);
}

export const validate = async ({ clientID, apiKey }: ConnectionParams = {}) => {
    if (!clientID) return throwErrorAndLog('Missing clientID');
    if (!apiKey) return throwErrorAndLog('Missing apiKey');
    if (!keys.has(clientID)) return throwErrorAndLog('Please register this clientID first!');
    if (keys.get(clientID) !== apiKey) return throwErrorAndLog('Invalid API key!');

    // Success
    return true;
}