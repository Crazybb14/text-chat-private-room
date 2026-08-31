import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import UserManager from "@/lib/userManagement";
import { getProfile, saveProfile } from "@/lib/friends";
import { useUserPrefs } from "@/lib/userSettings";

const STATUSES = ["online", "away", "busy", "offline"];

function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Couldn't read image"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Couldn't read file"));
    reader.readAsDataURL(file);
  });
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState("online");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { prefs, update } = useUserPrefs(username);

  useEffect(() => {
    const init = async () => {
      const user = await UserManager.getUsername();
      if (!user) {
        navigate("/");
        return;
      }
      setUsername(user);
      const profile = await getProfile(user);
      if (profile) {
        setDisplayName((profile.display_name as string) || "");
        setBio((profile.bio as string) || "");
        setStatus((profile.status as string) || "online");
        setAvatarUrl((profile.avatar_url as string) || "");
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please pick an image file", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarUrl(dataUrl);
      toast({ title: "Picture ready", description: "Hit Save to keep it." });
    } catch {
      toast({ title: "Couldn't process that image", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!username) return;
    setSaving(true);
    try {
      await saveProfile(username, {
        display_name: displayName.trim().slice(0, 60),
        bio: bio.trim().slice(0, 400),
        status,
        avatar_url: avatarUrl,
      });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Couldn't save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await UserManager.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border border-white/10">
                {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                <AvatarFallback className="bg-primary/20 text-xl">
                  {(username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Upload picture
                </Button>
                {avatarUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setAvatarUrl("")}>
                    Remove
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0])}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={username || ""}
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people a bit about yourself"
                rows={3}
                maxLength={400}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chat experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Message text size</p>
                <p className="text-xs text-muted-foreground">Applies in rooms and private messages.</p>
              </div>
              <Select value={String(prefs.font_size)} onValueChange={(v) => update({ font_size: Number(v) })}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="13">Small</SelectItem>
                  <SelectItem value="15">Normal</SelectItem>
                  <SelectItem value="17">Large</SelectItem>
                  <SelectItem value="19">Bigger</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Sound on new message</p>
                <p className="text-xs text-muted-foreground">A soft chime when someone messages you.</p>
              </div>
              <Switch
                checked={prefs.sound}
                onCheckedChange={(v) => update({ sound: v })}
                aria-label="Sound on new message"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show me as online</p>
                <p className="text-xs text-muted-foreground">
                  Turn off to keep your status hidden from everyone.
                </p>
              </div>
              <Switch
                checked={prefs.show_online}
                onCheckedChange={(v) => update({ show_online: v })}
                aria-label="Show me as online"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Enter sends the message</p>
                <p className="text-xs text-muted-foreground">
                  Off means Enter makes a new line and you send with the Send button.
                </p>
              </div>
              <Switch
                checked={prefs.enter_to_send}
                onCheckedChange={(v) => update({ enter_to_send: v })}
                aria-label="Enter sends the message"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show message times</p>
                <p className="text-xs text-muted-foreground">Timestamps next to each message.</p>
              </div>
              <Switch
                checked={prefs.timestamps}
                onCheckedChange={(v) => update({ timestamps: v })}
                aria-label="Show message times"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Compact messages</p>
                <p className="text-xs text-muted-foreground">Tighter spacing between messages.</p>
              </div>
              <Switch
                checked={prefs.compact}
                onCheckedChange={(v) => update({ compact: v })}
                aria-label="Compact messages"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You're signed in as <span className="text-foreground font-medium">@{username}</span>.
            </p>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
