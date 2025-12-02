import { useEffect } from "react";
import db from "@/lib/shared/kliv-database.js";

/**
 * Automatically deletes private rooms that have been inactive for 1 hour
 * Runs cleanup check every 5 minutes
 */
const PrivateRoomAutoCleanup = () => {
  useEffect(() => {
    const cleanupInactiveRooms = async () => {
      try {
        console.log("Running private room cleanup check...");
        
        // Get all private rooms
        const privateRooms = await db.query("rooms", { type: "eq.private" });
        
        const oneHourAgo = Date.now() - (3600 * 1000); // 1 hour in milliseconds

        for (const room of privateRooms) {
          // Get the last message in this room
          const messages = await db.query("messages", {
            room_id: `eq.${room._row_id}`,
            order: "_created_at.desc",
            limit: 1
          });

          // Check if room has no messages or last message was over 1 hour ago
          const shouldDelete = messages.length === 0 
            ? (room._created_at * 1000) < oneHourAgo  // No messages, check room creation time
            : messages[0]._created_at < oneHourAgo;    // Has messages, check last message time

          if (shouldDelete) {
            console.log(`Deleting inactive private room: ${room.name} (ID: ${room._row_id})`);
            
            // Delete all messages in the room
            const allMessages = await db.query("messages", { room_id: `eq.${room._row_id}` });
            for (const msg of allMessages) {
              await db.delete("messages", { _row_id: `eq.${msg._row_id}` });
            }
            
            // Delete the room
            await db.delete("rooms", { _row_id: `eq.${room._row_id}` });
            
            console.log(`✅ Deleted room: ${room.name}`);
          }
        }
      } catch (error) {
        console.error("Error during private room cleanup:", error);
      }
    };

    // Run cleanup immediately
    cleanupInactiveRooms();

    // Run cleanup every 5 minutes
    const interval = setInterval(cleanupInactiveRooms, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // This component doesn't render anything
  return null;
};

export default PrivateRoomAutoCleanup;
