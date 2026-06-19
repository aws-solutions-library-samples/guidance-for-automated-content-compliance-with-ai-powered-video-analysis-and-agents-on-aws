import { defineStorage } from '@aws-amplify/backend';
import { vars } from '../global-variables';

// Define the storage resource using Amplify's defineStorage function
export const storage = defineStorage({
  name: vars.ASSET_S3_BUCKET_NAME,
  access: (allow) => ({
    'assets/video/{entity_id}/*': [
      allow.authenticated.to(['read','write','delete']),
    ],
    'assets/transcript/{entity_id}/*': [
      allow.authenticated.to(['read','write','delete']),
    ],
    'processed/video/{entity_id}/*': [
      allow.authenticated.to(['read','write','delete']),
    ],
    'config/{entity_id}/*': [
      allow.authenticated.to(['read','write','delete']),
    ]
  })
});