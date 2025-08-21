const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL + '/api';

export interface BookmarkData {
  ruleGuid: string;
  UserId: string;
}

export interface BookmarkResponse {
  error?: boolean;
  message?: string;
  bookmarkStatus?: boolean;
}

export class BookmarkService {
  static async getBookmarkStatus(ruleGuid: string, userId: string, token: string): Promise<BookmarkResponse> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/GetBookmarkStatusFunction?rule_guid=${ruleGuid}&user_id=${userId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking bookmark status:', error);
      throw error;
    }
  }

  static async getUserBookmarks(userId: string, token: string): Promise<BookmarkResponse> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/GetAllBookmarkedFunction?user_id=${userId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user bookmarks:', error);
      throw error;
    }
  }

  static async addBookmark(data: BookmarkData, token: string): Promise<BookmarkResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/BookmarkRuleFunction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding bookmark:', error);
      throw error;
    }
  }

  static async removeBookmark(data: BookmarkData, token: string): Promise<BookmarkResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/RemoveBookmarkFunction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error removing bookmark:', error);
      throw error;
    }
  }
}
