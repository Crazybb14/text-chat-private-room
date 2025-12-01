import { useEffect, useState } from 'react';
import db from '../lib/shared/kliv-database';

interface OnlineUser {
  username: string;
  device_id: string;
  room_id: number;
  last_seen: string;
  is_online: boolean;
}

interface OnlineStatusTrackerProps {
  roomId: number;
}

export default function OnlineStatusTracker({ roomId }: OnlineStatusTrackerProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const loadOnlineUsers = async () => {
      try {
        // Clean up offline users (mark as offline if not seen for 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        await db.update("online_users", { 
          last_seen: `lt.${fiveMinutesAgo}` 
        }, { 
          is_online: false 
        });

        // Load current online users
        const { data } = await db.query("online_users", { 
          room_id: `eq.${roomId}`,
          is_online: 'eq.true',
        });
        setOnlineUsers(data || []);
      } catch (err) {
        console.log("Online users load error:", err);
      }
    };

    const interval = setInterval(loadOnlineUsers, 5000); // Update every 5 seconds
    loadOnlineUsers();

    return () => clearInterval(interval);
  }, [roomId]);

  if (onlineUsers.length === 0) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            No users online
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Online: {onlineUsers.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {onlineUsers.slice(0, 8).map((user, index) => (
            <span
              key={index}
              className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full"
            >
              {user.username}
            </span>
          ))}
          {onlineUsers.length > 8 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              +{onlineUsers.length - 8} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}