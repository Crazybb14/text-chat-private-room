import { useEffect } from "react";
import { getDeviceId } from "@/lib/deviceId";
import db from "@/lib/shared/kliv-database.js";

interface IPTrackerProps {
  username: string;
  roomId?: number;
  action?: string;
}

const IPTracker = ({ username, roomId, action = "login" }: IPTrackerProps) => {
  useEffect(() => {
    const trackUserActivity = async () => {
      try {
        const deviceId = getDeviceId();
        
        // Generate mock IP based on device ID (in production, this would be real IP)
        const mockIPs = [
          "192.168.1.100", "10.0.0.50", "172.16.0.25", "203.0.113.1", 
          "198.51.100.10", "192.0.2.100", "172.217.16.200", "142.250.184.150",
          "157.240.229.35", "151.101.65.140"
        ];
        
        const hash = deviceId.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        
        const ipAddress = mockIPs[Math.abs(hash) % mockIPs.length];
        
        // Location data based on IP
        const locations = [
          { country: "United States", city: "New York" },
          { country: "United States", city: "Los Angeles" },
          { country: "United Kingdom", city: "London" },
          { country: "Canada", city: "Toronto" },
          { country: "Australia", city: "Sydney" },
          { country: "Germany", city: "Berlin" },
          { country: "Japan", city: "Tokyo" },
          { country: "France", city: "Paris" },
          { country: "Brazil", city: "São Paulo" },
          { country: "India", city: "Mumbai" }
        ];
        
        const location = locations[Math.abs(hash) % locations.length];

        // Log IP activity 
        await db.insert("ip_activity_logs", {
          device_id: deviceId,
          username: username,
          ip_address: ipAddress,
          country: location.country,
          city: location.city,
          action: action,
          room_id: roomId || null,
          _created_at: Date.now()
        });

        console.log(`IP tracked for ${username}: ${ipAddress} (${location.city}, ${location.country})`);
      } catch (error) {
        console.log("Error tracking IP activity:", error);
      }
    };

    if (username) {
      trackUserActivity();
    }
  }, [username, roomId, action]);

  return null;
};

export default IPTracker;