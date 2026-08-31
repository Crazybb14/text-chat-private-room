import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, RefreshCw, Shield, ShieldOff, Trash2, UserCog } from "lucide-react";
import db from "@/lib/shared/kliv-database.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_ABILITIES, generateInviteCode, parsePermissions, type Permissions } from "@/lib/adminAccounts";

export interface AdminUserRow {
  _row_id: number;
  username: string;
  display_name: string | null;
  password_hash: string;
  permissions: string;
  last_login: number | string | null;
  is_active: number;
  created_by: string | null;
  status: string;
  invite_code: string;
  invited_at: number | null;
  [key: string]: unknown;
}

const fmtTime = (value: number | string | null) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "never";
  return new Date(n * (n > 1e11 ? 1 : 1000)).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/** Owner screen: every admin account, their abilities, invite codes, and access. */
const AdminManagers = ({ ownerEmail }: { ownerEmail: string | null }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editPerms, setEditPerms] = useState<Permissions>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    try {
      setRows(await db.query<AdminUserRow>("admin_users", { order: "_row_id.asc" }));
    } catch {
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (row: AdminUserRow) => {
    setEditing(row);
    setEditPerms(parsePermissions(safeParse(row.permissions)));
  };

  const safeParse = (raw: unknown): unknown => {
    try {
      return JSON.parse(String(raw ?? "{}"));
    } catch {
      return {};
    }
  };

  const handleSaveAbilities = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await db.updateOne(
        "admin_users",
        { _row_id: `eq.${editing._row_id}` },
        { permissions: JSON.stringify(editPerms) }
      );
      toast({ title: "Abilities updated", description: `@${editing.username} can now use the checked areas.` });
      setEditing(null);
      load();
    } catch {
      toast({ title: "Couldn't save those abilities", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleNewInvite = async (row: AdminUserRow) => {
    const code = generateInviteCode();
    try {
      await db.updateOne(
        "admin_users",
        { _row_id: `eq.${row._row_id}` },
        { invite_code: code, password_hash: "", salt: "", status: "invited", invited_at: Date.now() }
      );
      await db.insert("notifications", {
        type: "admin_invite",
        recipient_username: row.username,
        title: "Admin panel access",
        message: `Your admin invite code is ${code}. Open the admin panel to set your password.`,
        link: "/admin",
        is_read: 0,
        created_by_admin: 1,
      });
      toast({
        title: "New invite sent",
        description: `@${row.username} was notified with code ${code}.`,
      });
      load();
    } catch {
      toast({ title: "Couldn't resend that invite", variant: "destructive" });
    }
  };

  const handleToggleActive = async (row: AdminUserRow) => {
    try {
      await db.updateOne("admin_users", { _row_id: `eq.${row._row_id}` }, { is_active: row.is_active === 1 ? 0 : 1 });
      toast({
        title: row.is_active === 1 ? `Deactivated @${row.username}` : `Reactivated @${row.username}`,
        description: row.is_active === 1 ? "They can't sign in until reactivated." : undefined,
      });
      load();
    } catch {
      toast({ title: "Couldn't change that account", variant: "destructive" });
    }
  };

  const handleRemove = async (row: AdminUserRow) => {
    if (!window.confirm(`Remove @${row.username} as an admin? They immediately lose panel access.`)) return;
    try {
      await db.deleteOne("admin_users", { _row_id: `eq.${row._row_id}` });
      toast({ title: `Removed @${row.username}` });
      load();
    } catch {
      toast({ title: "Couldn't remove that admin", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (denied) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <Shield className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="font-semibold">Owner sign-in required</p>
          <p className="text-sm text-muted-foreground">
            Admin accounts are only managed while signed in with the site owner's own login.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="py-3 space-y-1 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Each admin signs in with their own username and the password they chose. You control
            exactly which parts of the panel they can use.
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </CardContent>
      </Card>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No extra admins yet — add one from the Accounts tab with the "Make admin" button.
        </p>
      )}

      {rows.map((row) => {
        const perms = parsePermissions(safeParse(row.permissions));
        const labels = ADMIN_ABILITIES.filter((a) => perms[a.key]).map((a) => a.label);
        const invited = !row.password_hash;
        return (
          <Card key={row._row_id}>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold flex items-center gap-2 flex-wrap">
                    <UserCog className="w-4 h-4 text-primary" />@{row.username}
                    {row.is_active === 1 ? (
                      <Badge variant={invited ? "secondary" : "default"}>
                        {invited ? "invite pending" : "active"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">disabled</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created by {row.created_by || ownerEmail || "owner"} · Last signed in{" "}
                    {fmtTime(row.last_login as number | string | null)}
                  </p>
                  {invited && (
                    <p className="text-xs text-muted-foreground">
                      Invite code:{" "}
                      <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">{row.invite_code}</code>{" "}
                      — they use it to set their password in the admin panel.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                    <UserCog className="w-4 h-4 mr-2" /> Abilities
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleNewInvite(row)}>
                    <KeyRound className="w-4 h-4 mr-2" /> New invite code
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggleActive(row)}>
                    <ShieldOff className="w-4 h-4 mr-2" />
                    {row.is_active === 1 ? "Deactivate" : "Reactivate"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleRemove(row)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>@{editing?.username}'s abilities</DialogTitle>
            <DialogDescription>
              Check what this admin can do. Anything unchecked is hidden from their panel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
            {ADMIN_ABILITIES.map((ability) => (
              <div key={ability.key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{ability.label}</p>
                  <p className="text-xs text-muted-foreground">{ability.description}</p>
                </div>
                <Switch
                  checked={editPerms[ability.key] === true}
                  onCheckedChange={(v) => setEditPerms((prev) => ({ ...prev, [ability.key]: v }))}
                  aria-label={ability.label}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAbilities} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save abilities
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Shown on the Accounts tab: invite a member as an admin with chosen abilities. */
export const MakeAdminDialog = ({
  username,
  ownerEmail,
  onClose,
  onDone,
}: {
  username: string | null;
  ownerEmail: string | null;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { toast } = useToast();
  const [perms, setPerms] = useState<Permissions>({});
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (username) {
      setPerms({ rooms: true, messages: true, people: true });
      setCode(generateInviteCode());
    }
  }, [username]);

  const handleMakeAdmin = async () => {
    if (!username) return;
    setBusy(true);
    try {
      const existing = await db.query<{ _row_id: number }>("admin_users", { username: `eq.${username}` });
      if (existing.length > 0) {
        await db.updateOne(
          "admin_users",
          { _row_id: `eq.${existing[0]._row_id}` },
          {
            permissions: JSON.stringify(perms),
            invite_code: code,
            password_hash: "",
            salt: "",
            status: "invited",
            invited_at: Date.now(),
            is_active: 1,
          }
        );
      } else {
        await db.insert("admin_users", {
          username,
          display_name: username,
          password_hash: "",
          salt: "",
          permissions: JSON.stringify(perms),
          is_active: 1,
          created_by: ownerEmail ?? "owner",
          role: "admin",
          status: "invited",
          invite_code: code,
          invited_at: Date.now(),
        });
      }
      await db.insert("notifications", {
        type: "admin_invite",
        recipient_username: username,
        title: "You've been made an admin",
        message: `You now have admin access. Your invite code is ${code} — open the admin panel to set your password.`,
        link: "/admin",
        is_read: 0,
        created_by_admin: 1,
      });
      toast({
        title: `@${username} is now an admin`,
        description: `They were notified with invite code ${code}.`,
      });
      onDone();
      onClose();
    } catch {
      toast({ title: "Couldn't make that admin", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={username !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Make @{username} an admin</DialogTitle>
          <DialogDescription>
            Choose what they can do. They'll get a notification with an invite code and set their own
            password the first time they open the admin panel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[45vh] overflow-y-auto">
          {ADMIN_ABILITIES.map((ability) => (
            <div key={ability.key} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{ability.label}</p>
                <p className="text-xs text-muted-foreground">{ability.description}</p>
              </div>
              <Switch
                checked={perms[ability.key] === true}
                onCheckedChange={(v) => setPerms((prev) => ({ ...prev, [ability.key]: v }))}
                aria-label={ability.label}
              />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-code">Invite code</Label>
          <div className="flex gap-2">
            <Input id="invite-code" value={code} readOnly className="font-mono" />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                navigator.clipboard?.writeText(code).then(
                  () => toast({ title: "Copied" }),
                  () => undefined
                );
              }}
            >
              Copy
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleMakeAdmin} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Make admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminManagers;
