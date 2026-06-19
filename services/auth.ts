import { fetchAuthSession, signOut, getCurrentUser } from 'aws-amplify/auth';

export class AuthService {
  /**
   * Check if the user is authenticated
   * @returns Promise<boolean> - True if authenticated, false otherwise
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      return !!session.tokens;
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  static async getIdentityId(): Promise<string | undefined> {
    try {
      const session = await fetchAuthSession();
      return session.identityId || undefined;
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return undefined;
    }
  }

  /**
   * Get the current authenticated user
   * @returns Promise with user information
   */
  static async getCurrentUser() {
    try {
      return await getCurrentUser();
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut() {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
}