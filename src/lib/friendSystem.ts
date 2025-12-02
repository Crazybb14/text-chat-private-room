import { db } from '@/lib/shared/kliv-database';
import { auth } from '@/lib/shared/kliv-auth';

export interface UserProfile {
  user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
  last_seen?: number;
  timezone?: string;
  language?: string;
  theme?: string;
  notifications_enabled?: boolean;
  friend_requests_enabled?: boolean;
}

export interface Friendship {
  _row_id: number;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  requested_by: string;
}

export interface FriendRequest {
  _row_id: number;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message?: string;
}

export interface FriendshipMessage {
  _row_id: number;
  friendship_id: number;
  from_user_id: string;
  to_user_id: string;
  message: string;
}

export class FriendManager {
  // Create or update user profile
  static async updateProfile(profileData: Partial<UserProfile>): Promise<boolean> {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if profile exists
      const { data: existing } = await db.query('user_profiles', {
        user_id: `eq.${user.user_id}`
      });

      const profileToUpdate = {
        user_id: user.user_id,
        ...profileData,
        last_seen: Date.now(),
        ...(!existing?.length && { username: user.email }) // Only set username if new
      };

      if (existing && existing.length > 0) {
        await db.update('user_profiles', { user_id: `eq.${user.user_id}` }, profileToUpdate);
      } else {
        await db.insert('user_profiles', profileToUpdate);
      }

      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      return false;
    }
  }

  // Get user profile
  static async getProfile(userId?: string): Promise<UserProfile | null> {
    try {
      const user = await auth.getUser();
      const targetUserId = userId || user?.user_id;
      
      if (!targetUserId) return null;

      const { data: profiles } = await db.query('user_profiles', {
        user_id: `eq.${targetUserId}`
      });

      return profiles?.[0] || null;
    } catch (error) {
      console.error("Error getting profile:", error);
      return null;
    }
  }

  // Search for users
  static async searchUsers(query: string, limit: number = 10): Promise<UserProfile[]> {
    try {
      if (!query.trim()) return [];

      const user = await auth.getUser();
      if (!user) return [];

      const { data: profiles } = await db.query('user_profiles', {
        username: `ilike.*${query}*`,
        user_id: `neq.${user.user_id}`,
        limit
      });

      return profiles || [];
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  }

  // Send friend request
  static async sendFriendRequest(targetUserId: string, message?: string): Promise<boolean> {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (user.user_id === targetUserId) {
        throw new Error("Cannot send friend request to yourself");
      }

      // Check if request or friendship already exists
      const { data: existing } = await db.query('friend_requests', {
        or: `(and(from_user_id.eq.${user.user_id},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${user.user_id}))`
      });

      if (existing && existing.length > 0) {
        return false; // Request already exists
      }

      // Also check friendships
      const { data: friendship } = await db.query('friendships', {
        or: `(and(user_id.eq.${user.user_id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.user_id}))`
      });

      if (friendship && friendship.length > 0) {
        return false; // Already friends
      }

      await db.insert('friend_requests', {
        from_user_id: user.user_id,
        to_user_id: targetUserId,
        status: 'pending',
        message: message || "Hello! I'd like to be friends."
      });

      return true;
    } catch (error) {
      console.error("Error sending friend request:", error);
      return false;
    }
  }

  // Get pending friend requests
  static async getPendingRequests(): Promise<FriendRequest[]> {
    try {
      const user = await auth.getUser();
      if (!user) return [];

      const { data: requests } = await db.query('friend_requests', {
        or: `(to_user_id.eq.${user.user_id},from_user_id.eq.${user.user_id})`,
        status: 'eq.pending'
      });

      return requests || [];
    } catch (error) {
      console.error("Error getting pending requests:", error);
      return [];
    }
  }

  // Accept friend request
  static async acceptFriendRequest(requestId: number): Promise<boolean> {
    try {
      const user = await auth.getUser();
      if (!user) return false;

      // Get the request details
      const { data: requests } = await db.query('friend_requests', {
        _row_id: `eq.${requestId}`
      });

      if (!requests || requests.length === 0) return false;

      const request = requests[0] as FriendRequest;

      // Update request status
      await db.update('friend_requests', { _row_id: `eq.${requestId}` }, {
        status: 'accepted'
      });

      // Create friendship records (both directions)
      await db.insert('friendships', {
        user_id: user.user_id,
        friend_id: request.from_user_id,
        status: 'accepted',
        requested_by: request.from_user_id
      });

      await db.insert('friendships', {
        user_id: request.from_user_id,
        friend_id: user.user_id,
        status: 'accepted',
        requested_by: request.from_user_id
      });

      return true;
    } catch (error) {
      console.error("Error accepting friend request:", error);
      return false;
    }
  }

  // Decline friend request
  static async declineFriendRequest(requestId: number): Promise<boolean> {
    try {
      await db.update('friend_requests', { _row_id: `eq.${requestId}` }, {
        status: 'declined'
      });

      return true;
    } catch (error) {
      console.error("Error declining friend request:", error);
      return false;
    }
  }

  // Get friends list
  static async getFriends(status: 'accepted' | 'pending' = 'accepted'): Promise<UserProfile[]> {
    try {
      const user = await auth.getUser();
      if (!user) return [];

      // Get friendships
      const { data: friendships } = await db.query('friendships', {
        user_id: `eq.${user.user_id}`,
        status: `eq.${status}`
      });

      if (!friendships || friendships.length === 0) return [];

      // Get friend profiles
      const friends: UserProfile[] = [];
      for (const friendship of friendships) {
        const { data: profile } = await db.query('user_profiles', {
          user_id: `eq.${friendship.friend_id}`
        });

        if (profile && profile.length > 0) {
          friends.push(profile[0]);
        } else {
          // Friend without profile - create basic friend entry
          friends.push({
            user_id: friendship.friend_id,
            username: `User_${friendship.friend_id.slice(0, 8)}`,
            status: 'offline'
          } as UserProfile);
        }
      }

      return friends;
    } catch (error) {
      console.error("Error getting friends:", error);
      return [];
    }
  }

  // Remove friend
  static async removeFriend(friendUserId: string): Promise<boolean> {
    try {
      const user = await auth.getUser();
      if (!user) return false;

      // Delete friendship records (both directions)
      await db.delete('friendships', {
        user_id: `eq.${user.user_id}`,
        friend_id: `eq.${friendUserId}`
      });

      await db.delete('friendships', {
        user_id: `eq.${friendUserId}`,
        friend_id: `eq.${user.user_id}`
      });

      return true;
    } catch (error) {
      console.error("Error removing friend:", error);
      return false;
    }
  }

  // Block user
  static async blockUser(targetUserId: string): Promise<boolean> {
    try {
      const user = await auth.getUser();
      if (!user) return false;

      // Remove existing friendship
      await this.removeFriend(targetUserId);

      // Create blocked friendship record
      await db.insert('friendships', {
        user_id: user.user_id,
        friend_id: targetUserId,
        status: 'blocked',
        requested_by: user.user_id
      });

      // Decline any pending requests
      const { data: pendingRequests } = await db.query('friend_requests', {
        or: `(and(from_user_id.eq.${targetUserId},to_user_id.eq.${user.user_id}),and(from_user_id.eq.${user.user_id},to_user_id.eq.${targetUserId}))`,
        status: 'eq.pending'
      });

      for (const request of (pendingRequests || [])) {
        await db.update('friend_requests', { _row_id: `eq.${request._row_id}` }, {
          status: 'declined'
        });
      }

      return true;
    } catch (error) {
      console.error("Error blocking user:", error);
      return false;
    }
  }

  // Unblock user
  static async unblockUser(targetUserId: string): Promise<boolean> {
    try {
      const user = await auth.getUser();
      if (!user) return false;

      await db.delete('friendships', {
        user_id: `eq.${user.user_id}`,
        friend_id: `eq.${targetUserId}`,
        status: `eq.blocked`
      });

      return true;
    } catch (error) {
      console.error("Error unblocking user:", error);
      return false;
    }
  }

  // Check if users are friends
  static async areFriends(userId1: string, userId2: string): Promise<boolean> {
    try {
      const { data: friendship } = await db.query('friendships', {
        or: `(and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1}))`,
        status: 'eq.accepted'
      });

      return (friendship && friendship.length > 0) || false;
    } catch (error) {
      console.error("Error checking friendship:", error);
      return false;
    }
  }

  // Update online status
  static async updateStatus(status: UserProfile['status']): Promise<boolean> {
    try {
      const user = await auth.getUser();
      if (!user) return false;

      return this.updateProfile({
        status,
        last_seen: Date.now()
      });
    } catch (error) {
      console.error("Error updating status:", error);
      return false;
    }
  }

  // Send direct message to friend
  static async sendDirectMessage(friendId: string, message: string): Promise<boolean> {
    try {
      const user = await auth.getUser();
      if (!user) return false;

      // Check if they are friends
      const isFriend = await this.areFriends(user.user_id, friendId);
      if (!isFriend) return false;

      // Get friendship ID
      const { data: friendship } = await db.query('friendships', {
        user_id: `eq.${user.user_id}`,
        friend_id: `eq.${friendId}`,
        status: 'eq.accepted'
      });

      if (!friendship || friendship.length === 0) return false;

      // Add message to friendship messages table
      await db.insert('friendship_messages', {
        friendship_id: (friendship[0] as Partial<Friendship> & {_row_id?: number})?._row_id || 0,
        from_user_id: user.user_id,
        to_user_id: friendId,
        message
      });

      return true;
    } catch (error) {
      console.error("Error sending direct message:", error);
      return false;
    }
  }

  // Get direct messages with friend
  static async getDirectMessages(friendId: string): Promise<FriendshipMessage[]> {
    try {
      const user = await auth.getUser();
      if (!user) return [];

      // Get friendship ID
      const { data: friendship } = await db.query('friendships', {
        user_id: `eq.${user.user_id}`,
        friend_id: `eq.${friendId}`,
        status: 'eq.accepted'
      });

      if (!friendship || friendship.length === 0) return [];

      // Get messages
      const { data: messages } = await db.query('friendship_messages', {
        friendship_id: `eq.${(friendship[0] as Partial<Friendship> & {_row_id?: number})?._row_id || 0}`
      });

      return messages || [];
    } catch (error) {
      console.error("Error getting direct messages:", error);
      return [];
    }
  }
}