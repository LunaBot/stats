import uuidAPIKey from 'uuid-apikey';
import EnMap from 'enmap';

export const keys = new EnMap('keys');

export const generateKey = () => uuidAPIKey.create();

interface ConnectionParams {
    clientID?: string;
    apiKey?: string;
}

export const validate = async ({ clientID, apiKey }: ConnectionParams = {}) => {
    if (!clientID) throw new Error('Missing clientID');
    if (!apiKey) throw new Error('Missing apiKey');
    if (!keys.has(clientID)) throw new Error('Please register this clientID first!');
    if (keys.get(clientID) !== apiKey) throw new Error('Invalid API key!');

    // Success
    return true;
}