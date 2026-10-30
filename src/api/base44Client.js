import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { scopeEntities } from '@/lib/regionScope';

const { appId, serverUrl, token, functionsVersion } = appParams;

//Create a client with authentication required
const client = createClient({
  appId,
  serverUrl,
  token,
  functionsVersion,
  requiresAuth: false
});

let scopedEntities = null;

// Region-aware client: entity reads are automatically limited to the user's active region.
export const base44 = new Proxy(client, {
  get(target, prop) {
    if (prop === 'entities') {
      if (!scopedEntities) scopedEntities = scopeEntities(target.entities);
      return scopedEntities;
    }
    const value = Reflect.get(target, prop);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

// Unscoped client for the rare cases that must see every region.
export const rawBase44 = client;