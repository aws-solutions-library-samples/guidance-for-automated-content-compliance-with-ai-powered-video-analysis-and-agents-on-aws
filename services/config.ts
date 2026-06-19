import { uploadData, downloadData, remove, getUrl } from 'aws-amplify/storage';
import { get } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth'
import outputs from '../amplify_outputs.json';

export class ConfigurationService {
  //@ts-ignore
  async saveConfig(config): Promise<void> {
    try {
      config.isCustom = true;
      
      const configJson = JSON.stringify(config, null, 2);
      const blob = new Blob([configJson], { type: 'application/json' });
      
      await uploadData({
        path: ({ identityId }) => `config/${identityId}/config.json`,
        data: blob,
        options: {
          contentType: 'application/json',
        }
      }).result;
      
      console.log('Custom configuration saved successfully');
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }
  
  async uploadDefaultConfig(configFile: Blob): Promise<void> {
    try {      
      await uploadData({
        path: "config/default-config.json",
        data: configFile,
        options: {
          contentType: 'application/json',
        }
      }).result;
      
      console.log('Default configuration uploaded successfully');
    } catch (error) {
      console.error('Error uploading default configuration:', error);
      throw error;
    }
  }
  
  async getDefaultConfig(): Promise<any> {
    try {
      const response = await fetch('/default-config.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading default configuration:', error);
      throw error;
    }
  }
  
  async getCustomConfig(identityId: string): Promise<any> {
    try {
      // First verify if the object exists. This is critical, do not remove, downloadData uses cached objects
      // This will throw an error and bypass downloadData, then it will get the default config instead
      await getUrl({
        path: ({ identityId }) => `config/${identityId}/config.json`,
        options: {
          // ensure object exists before getting url
          validateObjectExistence: true
        }
      });

      const session = await fetchAuthSession();
      const token = session.tokens?.idToken;

      if (!token) {
        throw new Error('No valid authentication token available. Please sign in.');
      }

      const { body } = await get({
        apiName: outputs.custom.apiName,
        path: `custom-config/${identityId}`,
        options: {
          headers: {
            Authorization: token.toString(),
          }
        }
      }).response;

      return await body.json();
    } catch (error) {
      console.error('Error loading custom configuration:', error);
      throw error;
    }
  }
  
  async deleteCustomConfig(): Promise<void> {
    try {
      await remove({
        path: ({ identityId }) => `config/${identityId}/config.json`
      });
      
      console.log('Custom configuration deleted successfully');
    } catch (error) {
      console.error('Error deleting custom configuration:', error);
      throw error;
    }
  }
}