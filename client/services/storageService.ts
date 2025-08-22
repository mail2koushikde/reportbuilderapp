import { SavedReport } from '../components/BuildReport';

class StorageService {
  private baseUrl = '/api/storage';

  async saveView(report: SavedReport): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/save-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error saving view:', error);
      throw error;
    }
  }

  async getAllViews(): Promise<SavedReport[]> {
    try {
      const response = await fetch(`${this.baseUrl}/get-views`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching views:', error);
      throw error;
    }
  }

  async deleteView(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/delete-view/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting view:', error);
      throw error;
    }
  }

  async clearAllViews(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/clear-views`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error clearing views:', error);
      throw error;
    }
  }

  async getStorageInfo(): Promise<{
    viewsCount: number;
    storageSize: number;
    percentUsed: number;
    isNearLimit: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/storage-info`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching storage info:', error);
      return { viewsCount: 0, storageSize: 0, percentUsed: 0, isNearLimit: false };
    }
  }
}

export const storageService = new StorageService();
