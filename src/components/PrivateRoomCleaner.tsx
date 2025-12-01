import { useEffect } from 'react';
import db from '../lib/shared/kliv-database';

interface PrivateRoomCleanerProps {
  isTimerActive: boolean;
  onCleanup: () => void;
}

export default function PrivateRoomCleaner({ isTimerActive, onCleanup }: PrivateRoomCleanerProps) {
  useEffect(() => {
    if (!isTimerActive) return;

    const cleanupOldRooms = async () => {
      try {
        // Get all private rooms
        const { data: rooms } = await db.query("rooms", { is_private: 'eq.true' });
        
        if (rooms && rooms.length > 0) {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          
          for (const room of rooms) {
            // Check last activity in the room
            const { data: recentMessages } = await db.query("messages", { 
              room_id: `eq.${room.id}` 
            }, { 
              orderBy: { column: 'created_at', ascending: false },
              limit: 1 
            });
            
            // Also check online users in this room
            const { data: usersOnline } = await db.query("online_users", { 
              room_id: `eq.${room.id}`,
              is_online: 'eq.true'
            });
            
            // Delete room if no recent messages and no online users
            const shouldDelete = (
              (!recentMessages || recentMessages.length === 0) ||
              new Date(recentMessages[0].created_at) < new Date(oneHourAgo)
            ) && usersOnline.length === 0;
            
            if (shouldDelete) {
              // Delete all messages in the room first
              await db.delete("messages", { room_id: `eq.${room.id}` });
              // Delete the room
              await db.delete("rooms", { id: `eq.${room.id}` });
              
              console.log(`Cleaned up inactive private room: ${room.name}`);
              onCleanup();
            }
          }
        }
      } catch (err) {
        console.log("Room cleanup error:", err);
      }
    };

    // Run cleanup every 10 minutes
    const cleanupInterval = setInterval(cleanupOldRooms, 600000);
    // Run once immediately
    cleanupOldRooms();

    return () => clearInterval(cleanupInterval);
  }, [isTimerActive, onCleanup]);

  return null; // This component runs silently in background
}