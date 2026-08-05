import { ElfaSDK } from '@elfa-ai/sdk';

if (!process.env.ELFA_API_KEY) {
  throw new Error('ELFA_API_KEY is not set');
}

export const elfa = new ElfaSDK({
  elfaApiKey: process.env.ELFA_API_KEY,
});
