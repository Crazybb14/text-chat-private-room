import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Flag, Loader2, MessageSquare, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import UserManager from "@/lib/userManagement";
import {
  acceptFriendRequest,
  getProfile,
  getRelationship,
  removeFriend,
  sendFriendRequest,

  type ProfileRow,
  type Relationship,
} from "@/lib/friends";
import { getDeviceId } from "@/lib/deviceId";

const Profile = () => {
  const { username: rawUsername } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const username = (rawUsername || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [firstSeen, setFirstSeen] = useState<number | null>(null);
  const [relationship, setRelationship] = useState<Relationship>("none");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const myUser = await UserManager.getUsername();
    setMe(myUser);
    const p = await getProfile(username);
    setProfile(p);
    const userRows = await db.query<{ first_seen: number }>("users", { username: `eq.${username}` });
    setFirstSeen(userRows[0]?.first_seen ?? null);
    if (myUser) {
      setRelationship(await getRelationship(myUser, username));
    }
    setLoading(false);
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshRelationship = async () => {
    if (me) setRelationship(await getRelationship(me, username));
  };

  const handleAdd = async () => {
    if (!me) return;
    setBusy(true);
    const result = await sendFriendRequest(me, username);
    toast({
      title: result.ok ? "Request sent" : "Couldn't send request",
      description: result.message,
      variant: result.ok ? undefined : "destructive",
    });
    await refreshRelationship();
    setBusy(false);
  };

  const handleAccept = async () => {
    if (!me) return;
    setBusy(true);
    try {
      const pending = await db.query<{ _row_id: number; requested_by: string }>(
        "friendships",
        { friend_id: `eq.${me}`, status: "eq.pending" }
      );
      const row = pending.find((r) => r.requested_by === username);
      if (row) {
        await acceptFriendRequest(row._row_id);
        toast({ title: "Friend added", description: `You and ${username} are now friends.` });
      }
    } finally {
      await refreshRelationship();
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!me) return;
    setBusy(true);
    await removeFriend(me, username);
    toast({ title: "Friend removed" });
    await refreshRelationship();
    setBusy(false);
  };

  const handleReport = async () => {
    await db.insert("user_reports", {
      reported_username: username,
      reported_device_id: null,
      reporter_username: me || "anonymous",
      reporter_device_id: getDeviceId(),
      room_id: null,
      report_reason: "Reported from profile",
      custom_reason: null,
      report_type: "user",
      status: "pending",
    });
    toast({ title: "Report submitted", description: "An admin will review it." });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = (profile?.display_name as string) || username;
  const bio = (profile?.bio as string) || "";
  const avatarUrl = (profile?.avatar_url as string) || "";
  const status = (profile?.status as string) || "offline";
  const isMe = me === username;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border border-white/10">
                {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                <AvatarFallback className="bg-primary/20 text-3xl">
                  {username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-xl font-bold truncate">{displayName}</h2>
                <p className="text-sm text-muted-foreground">@{username}</p>
                <Badge variant="secondary" className="mt-1 capitalize">{status}</Badge>
              </div>
            </div>

            {bio && <p className="text-sm whitespace-pre-wrap">{bio}</p>}

            {firstSeen && (
              <p className="text-xs text-muted-foreground">
                Member since{" "}
                {new Date(firstSeen).toLocaleDateString([], { month: "long", year: "numeric" })}
              </p>
            )}

            <div className="flex gap-2 flex-wrap pt-2">
              {isMe ? (
                <Button onClick={() => navigate("/settings")}>Edit profile</Button>
              ) : (
                <>
                  {relationship === "none" && (
                    <Button onClick={handleAdd} disabled={busy}>
                      <UserPlus className="w-4 h-4 mr-2" /> Add friend
                    </Button>
                  )}
                  {relationship === "outgoing" && (
                    <Button variant="outline" disabled>
                      Request pending
                    </Button>
                  )}
                  {relationship === "incoming" && (
                    <Button onClick={handleAccept} disabled={busy}>
                      <Check className="w-4 h-4 mr-2" /> Accept friend request
                    </Button>
                  )}
                  {relationship === "friends" && (
                    <>
                      <Button onClick={() => navigate(`/dm/${username}`)}>
                        <MessageSquare className="w-4 h-4 mr-2" /> Message
                      </Button>
                      <Button variant="outline" onClick={handleRemove} disabled={busy}>
                        <UserMinus className="w-4 h-4 mr-2" /> Remove friend
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" className="text-destructive" onClick={handleReport}>
                    <Flag className="w-4 h-4 mr-2" /> Report
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
