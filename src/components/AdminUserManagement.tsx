import React, { useState, useEffect } from "react";
import { Users, Shield, Plus, Edit, Trash2, Eye, EyeOff, Key, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

interface AdminUser {
  _row_id: number;
  username: string;
  password_hash: string;
  display_name: string | null;
  permissions: string;
  last_login: number | null;
  is_active: number;
  created_by: string | null;
  role: string;
  _created_at: number;
}

interface AdminPermission {
  key: string;
  label: string;
  description: string;
  category: string;
}

const adminPermissions: AdminPermission[] = [
  // Core permissions
  { key: "all", label: "All Permissions", description: "Full system access", category: "Core" },
  { key: "ban", label: "Ban Users", description: "Can ban and unban users", category: "Moderation" },
  { key: "approve", label: "Approve Content", description: "Can approve pending files and requests", category: "Moderation" },
  { key: "reports", label: "Manage Reports", description: "Can view and resolve user reports", category: "Moderation" },
  { key: "settings", label: "Manage Settings", description: "Can modify system settings", category: "Administration" },
  { key: "lockdown", label: "Lockdown Mode", description: "Can enable/disable lockdown", category: "Administration" },
  { key: "create_admin", label: "Create Admins", description: "Can create new admin users", category: "Administration" },
  { key: "view_logs", label: "View Logs", description: "Can access system logs", category: "Administration" },
  { key: "manage_rooms", label: "Manage Rooms", description: "Can delete and manage rooms", category: "Administration" },
  { key: "chat_bypass", label: "Chat Access", description: "Can chat in read-only rooms", category: "Chat" },
];

const roles = [
  { value: "super_admin", label: "Super Admin", description: "Full system control" },
  { value: "admin", label: "Admin", description: "Standard administrative access" },
  { value: "moderator", label: "Moderator", description: "Content moderation only" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
];

const AdminUserManagement = () => {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    displayName: "",
    role: "admin",
    permissions: {} as Record<string, boolean>
  });

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      const data = await db.query("admin_users", {
        order: "_created_at.desc"
      });
      setAdmins(data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading admins:", error);
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!formData.username || !formData.password) {
      toast({
        title: "❌ Missing Fields",
        description: "Username and password are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedPermissions = adminPermissions
        .filter(p => formData.permissions[p.key])
        .map(p => p.key);

      const permissionData = formData.permissions.all 
        ? JSON.stringify({ all: true })
        : JSON.stringify(
            adminPermissions.reduce((acc, p) => {
              acc[p.key] = formData.permissions[p.key] || false;
              return acc;
            }, {} as Record<string, boolean>)
          );

      // Note: In a real implementation, you'd hash the password properly
      const passwordHash = `hashed_${formData.password}`; // Placeholder

      await db.insert("admin_users", {
        username: formData.username,
        password_hash: passwordHash,
        display_name: formData.displayName || formData.username,
        permissions: permissionData,
        role: formData.role,
        is_active: 1,
        created_by: getDeviceId()
      });

      setShowCreateDialog(false);
      resetFormData();
      loadAdmins();
      
      toast({
        title: "✅ Admin Created",
        description: `${formData.username} has been added as an admin`,
      });
    } catch (error) {
      console.error("Error creating admin:", error);
      toast({
        title: "❌ Error",
        description: "Failed to create admin. Username may already exist.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAdmin = async () => {
    if (!editingAdmin || !formData.username) {
      return;
    }

    try {
      const selectedPermissions = adminPermissions
        .filter(p => formData.permissions[p.key])
        .map(p => p.key);

      const permissionData = formData.permissions.all 
        ? JSON.stringify({ all: true })
        : JSON.stringify(
            adminPermissions.reduce((acc, p) => {
              acc[p.key] = formData.permissions[p.key] || false;
              return acc;
            }, {} as Record<string, boolean>)
          );

      const updateData: Record<string, unknown> = {
        display_name: formData.displayName || formData.username,
        permissions: permissionData,
        role: formData.role,
      };

      if (formData.password) {
        updateData.password_hash = `hashed_${formData.password}`; // Placeholder
      }

      await db.update("admin_users", { _row_id: `eq.${editingAdmin._row_id}` }, updateData);

      setShowEditDialog(false);
      setEditingAdmin(null);
      resetFormData();
      loadAdmins();
      
      toast({
        title: "✅ Admin Updated",
        description: `${formData.username}'s permissions have been updated`,
      });
    } catch (error) {
      console.error("Error updating admin:", error);
      toast({
        title: "❌ Error",
        description: "Failed to update admin",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAdmin = async (adminId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete admin user "${username}"?`)) {
      return;
    }

    try {
      await db.delete("admin_users", { _row_id: `eq.${adminId}` });
      loadAdmins();
      
      toast({
        title: "✅ Admin Deleted",
        description: `${username} has been removed from admin users`,
      });
    } catch (error) {
      console.error("Error deleting admin:", error);
      toast({
        title: "❌ Error",
        description: "Failed to delete admin",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (adminId: number, isActive: boolean) => {
    try {
      await db.update("admin_users", { _row_id: `eq.${adminId}` }, { is_active: isActive ? 1 : 0 });
      loadAdmins();
      
      toast({
        title: isActive ? "✅ Admin Activated" : "⚠️ Admin Deactivated",
        description: `Admin access has been ${isActive ? "enabled" : "disabled"}`,
      });
    } catch (error) {
      console.error("Error toggling admin status:", error);
      toast({
        title: "❌ Error",
        description: "Failed to update admin status",
        variant: "destructive",
      });
    }
  };

  const resetFormData = () => {
    setFormData({
      username: "",
      password: "",
      displayName: "",
      role: "admin",
      permissions: {}
    });
  };

  const openEditDialog = (admin: AdminUser) => {
    setEditingAdmin(admin);
    const permissions = JSON.parse(admin.permissions || "{}");
    
    setFormData({
      username: admin.username,
      password: "",
      displayName: admin.display_name || "",
      role: admin.role,
      permissions: adminPermissions.reduce((acc, p) => {
        acc[p.key] = permissions[p.key] || permissions.all || false;
        return acc;
      }, {} as Record<string, boolean>)
    });
    
    setShowEditDialog(true);
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-red-100 text-red-800";
      case "admin":
        return "bg-blue-100 text-blue-800";
      case "moderator":
        return "bg-green-100 text-green-800";
      case "viewer":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin User Management</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Admin User</DialogTitle>
              <DialogDescription>
                Add a new administrator with specific permissions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="admin_username"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="John Admin"
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label} - {role.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Permissions</Label>
                <div className="space-y-3 mt-2">
                  {Object.entries(
                    adminPermissions.reduce((acc, p) => {
                      if (!acc[p.category]) acc[p.category] = [];
                      acc[p.category].push(p);
                      return acc;
                    }, {} as Record<string, AdminPermission[]>)
                  ).map(([category, permissions]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground">{category}</h4>
                      {permissions.map((permission) => (
                        <div key={permission.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={permission.key}
                            checked={formData.permissions[permission.key] || false}
                            onCheckedChange={(checked) =>
                              setFormData({
                                ...formData,
                                permissions: { ...formData.permissions, [permission.key]: checked as boolean }
                              })
                            }
                          />
                          <Label htmlFor={permission.key} className="text-sm">
                            {permission.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAdmin}>
                  <Check className="w-4 h-4 mr-2" />
                  Create Admin
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Admins List */}
      <div className="space-y-3">
        {admins.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No admin users found</p>
            </CardContent>
          </Card>
        ) : (
          admins.map((admin) => (
            <Card key={admin._row_id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">{admin.username}</span>
                      {admin.display_name && (
                        <span className="text-muted-foreground">({admin.display_name})</span>
                      )}
                      <Badge className={getRoleBadgeColor(admin.role)}>
                        {roles.find(r => r.value === admin.role)?.label}
                      </Badge>
                      <Badge variant={admin.is_active ? "default" : "secondary"}>
                        {admin.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Last login: {formatTime(admin.last_login)}</p>
                      <p>Created: {formatTime(admin._created_at)}</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(JSON.parse(admin.permissions || "{}"))
                          .filter(([key, value]) => key !== "all" && value)
                          .map(([key]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {adminPermissions.find(p => p.key === key)?.label || key}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(admin)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(admin._row_id, !admin.is_active)}
                    >
                      {admin.is_active ? (
                        <><EyeOff className="w-4 h-4 mr-1" />Deactivate</>
                      ) : (
                        <><Eye className="w-4 h-4 mr-1" />Activate</>
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteAdmin(admin._row_id, admin.username)}
                      disabled={admin.username === "admin"} // Prevent deletion of default admin
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Admin User</DialogTitle>
            <DialogDescription>
              Update admin permissions and settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-displayName">Display Name</Label>
              <Input
                id="edit-displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateAdmin}>
                <Check className="w-4 h-4 mr-2" />
                Update Admin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManagement;