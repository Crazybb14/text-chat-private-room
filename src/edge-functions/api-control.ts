export default async function(req: Request): Promise<Response> {
  // Add CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("X-API-Key");
    if (!apiKey) {
      return Response.json({ error: "API key required" }, { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Connect to database
    const url = req.headers.get("x-database-url");
    const token = req.headers.get("x-database-token");
    
    if (!url || !token) {
      return Response.json({ error: "Database connection failed" }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Import Turso driver for edge function
    const { connect } = await import("npm:@tursodatabase/serverless");
    const conn = connect({ url, authToken: token });

    // Verify API key
    const keyCheck = conn.prepare("SELECT * FROM user_settings WHERE setting_value = ? AND setting_key LIKE 'api_key_%'");
    const keyResult = await keyCheck.get([apiKey]);

    if (!keyResult) {
      return Response.json({ error: "Invalid API key" }, { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const username = keyResult.username;
    const urlObj = new URL(req.url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const action = pathParts[pathParts.length - 1];

    const body = req.method === "POST" ? await req.json() : {};

    switch (action) {
      case "send-message": {
        // Send a message as the user
        if (!body.roomId || !body.content) {
          return Response.json({ error: "roomId and content required" }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Insert message
        const insertMsg = conn.prepare(
          "INSERT INTO messages (room_id, sender_name, content, is_ai, device_id, _created_at) VALUES (?, ?, ?, 0, ?, ?)"
        );
        await insertMsg.run([
          parseInt(body.roomId),
          username,
          body.content,
          "", // device_id from API access
          Date.now()
        ]);

        return Response.json({ success: true, message: "Message sent" }, { 
          headers: corsHeaders 
        });
      }

      case "send-direct-message": {
        // Send direct message
        if (!body.recipient || !body.content) {
          return Response.json({ error: "recipient and content required" }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Insert direct message
        const insertDM = conn.prepare(
          "INSERT INTO direct_messages (sender_username, recipient_username, content, is_read, _created_at) VALUES (?, ?, ?, 0, ?)"
        );
        await insertDM.run([username, body.recipient, body.content, Date.now()]);

        return Response.json({ success: true, message: "Direct message sent" }, { 
          headers: corsHeaders 
        });
      }

      case "get-messages": {
        // Get messages from a room
        if (!body.roomId) {
          return Response.json({ error: "roomId required" }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Get messages
        const getMsgs = conn.prepare(
          "SELECT * FROM messages WHERE room_id = ? ORDER BY _created_at DESC LIMIT ?"
        );
        const messages = await getMsgs.all([parseInt(body.roomId), body.limit || 50]);

        return Response.json({ messages }, { headers: corsHeaders });
      }

      case "get-direct-messages": {
        // Get direct messages
        const getDMs = conn.prepare(`
          SELECT * FROM direct_messages 
          WHERE (sender_username = ? AND recipient_username = ?) 
             OR (sender_username = ? AND recipient_username = ?)
          ORDER BY _created_at DESC LIMIT ?
        `);
        const dms = await getDMs.all([username, body.otherUser, body.otherUser, username, body.limit || 50]);

        return Response.json({ messages: dms }, { headers: corsHeaders });
      }

      case "get-user-info": {
        // Get user information
        if (!body.targetUsername) {
          return Response.json({ error: "targetUsername required" }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Get user info
        const getUser = conn.prepare(`
          SELECT DISTINCT sender_name as username, 
                 MAX(_created_at) as last_seen,
                 device_id
          FROM messages 
          WHERE sender_name = ?
        `);
        const userInfo = await getUser.get([body.targetUsername]);

        return Response.json({ user: userInfo }, { headers: corsHeaders });
      }

      case "ban-user": {
        // Ban a user (admin only through API)
        if (!body.targetUsername) {
          return Response.json({ error: "targetUsername required" }, { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Check if this user is admin (simplified check)
        const adminCheck = conn.prepare("SELECT * FROM user_settings WHERE username = ? AND setting_key = 'is_admin'");
        const isAdmin = await adminCheck.get([username]);

        if (!isAdmin) {
          return Response.json({ error: "Admin access required" }, { 
            status: 403, 
            headers: corsHeaders 
          });
        }

        // Ban user
        const banUser = conn.prepare(
          "INSERT INTO bans (username, device_id, room_id, ban_reason, _created_at) VALUES (?, ?, ?, ?, ?)"
        );
        await banUser.run([
          body.targetUsername,
          body.deviceId || null,
          body.roomId || null,
          body.reason || "Banned via API",
          Date.now()
        ]);

        return Response.json({ success: true, message: "User banned" }, { 
          headers: corsHeaders 
        });
      }

      default:
        return Response.json({ error: "Unknown action" }, { 
          status: 400, 
          headers: corsHeaders 
        });
    }

  } catch (error) {
    console.error("API control error:", error);
    return Response.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      }
    });
  }
}