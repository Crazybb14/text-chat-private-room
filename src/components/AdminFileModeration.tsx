import React, { useState, useEffect } from "react";
import { FileText, Download, Trash2, Eye, Image, Video, File, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { content } from "@/lib/shared/kliv-content.js";

interface UploadedFile {
  _row_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  file_type: string;
  room_id: number;
  uploaded_by: string;
  device_id: string | null;
  _created_at: number;
}

const AdminFileModeration = () => {
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [rooms, setRooms] = useState<{ _row_id: number; name: string }[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const query: Record<string, string> = { order: "_created_at.desc", limit: "50" };
        
        if (filterType !== "all") {
          query.file_type = `like.${filterType}%`;
        }
        if (filterRoom !== "all") {
          query.room_id = `eq.${filterRoom}`;
        }

        const [filesData, roomsData] = await Promise.all([
          db.query("uploaded_files", query),
          db.query("rooms", {}),
        ]);

        setFiles(filesData);
        setRooms(roomsData);
      } catch (error) {
        console.error("Error loading files:", error);
      }
    };
    
    loadData();
  }, [filterType, filterRoom]);

  const loadData = async () => {
    try {
      const query: Record<string, string> = { order: "_created_at.desc", limit: "50" };
      
      if (filterType !== "all") {
        query.file_type = `like.${filterType}%`;
      }
      if (filterRoom !== "all") {
        query.room_id = `eq.${filterRoom}`;
      }

      const [filesData, roomsData] = await Promise.all([
        db.query("uploaded_files", query),
        db.query("rooms", {}),
      ]);

      setFiles(filesData);
      setRooms(roomsData);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-400" />;
    }
    if (fileType.startsWith('video/')) {
      return <Video className="w-5 h-5 text-green-400" />;
    }
    if (fileType.startsWith('text/') || fileType.includes('document')) {
      return <FileText className="w-5 h-5 text-yellow-400" />;
    }
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileUrl = (filename: string) => {
    return `/content/chat_files/${filename}`;
  };

  const previewFile = async (file: UploadedFile) => {
    try {
      const url = getFileUrl(file.filename);
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: "Preview failed",
        description: "Could not preview this file",
        variant: "destructive",
      });
    }
  };

  const downloadFile = (file: UploadedFile) => {
    try {
      const link = document.createElement('a');
      link.href = getFileUrl(file.filename);
      link.download = file.original_name;
      link.click();
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download this file",
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (file: UploadedFile) => {
    if (confirm(`Delete ${file.original_name}? This action cannot be undone.`)) {
      try {
        // Delete file record from database
        await db.delete("uploaded_files", { _row_id: `eq.${file._row_id}` });
        
        // Delete actual file from content storage
        await content.deleteFile(`/content/chat_files/${file.filename}`);
        
        toast({
          title: "File deleted",
          description: `${file.original_name} has been removed`,
        });
        
        loadData(); // Refresh list
      } catch (error) {
        toast({
          title: "Delete failed",
          description: "Could not delete this file",
          variant: "destructive",
        });
      }
    }
  };

  const banUserForFile = async (username: string) => {
    if (confirm(`Ban ${username} for inappropriate file upload?`)) {
      try {
        // Find user's device ID and create ban
        const userFiles = await db.query("uploaded_files", { uploaded_by: `eq.${username}`, limit: 1 });
        if (userFiles.length > 0 && userFiles[0].device_id) {
          await db.insert("bans", {
            username: username,
            device_id: userFiles[0].device_id,
            room_id: null,
          });
          
          toast({
            title: "User banned",
            description: `${username} has been banned for file violation`,
          });
          
          // Delete all their files
          const allUserFiles = await db.query("uploaded_files", { uploaded_by: `eq.${username}` });
          for (const file of allUserFiles) {
            try {
              await db.delete("uploaded_files", { _row_id: `eq.${file._row_id}` });
              await content.deleteFile(`/content/chat_files/${file.filename}`);
            } catch (error) {
              console.error("Error deleting file during ban:", error);
            }
          }
          
          loadData();
        }
      } catch (error) {
        toast({
          title: "Ban failed",
          description: "Could not ban user",
          variant: "destructive",
        });
      }
    }
  };

  const getRiskLevelColor = (fileType: string, fileSize: number) => {
    const sizeMB = fileSize / (1024 * 1024);
    if (fileType.startsWith('video/') && sizeMB > 5) return "text-red-400";
    if (fileType.startsWith('image/') && sizeMB > 3) return "text-orange-400";
    if (!fileType.startsWith('image/') && !fileType.startsWith('text/')) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48 bg-secondary/50 border-white/10">
            <SelectValue placeholder="File Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Files</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="text">Documents</SelectItem>
            <SelectItem value="application">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterRoom} onValueChange={setFilterRoom}>
          <SelectTrigger className="w-48 bg-secondary/50 border-white/10">
            <SelectValue placeholder="Room" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rooms</SelectItem>
            {rooms.map((room) => (
              <SelectItem key={room._row_id} value={room._row_id.toString()}>
                {room.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={loadData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Files List */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            File Moderation
          </CardTitle>
          <CardDescription>
            Review, download, and moderate uploaded files
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-muted-foreground">No files found</p>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div key={file._row_id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-white/10">
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.file_type)}
                    <div>
                      <p className="font-medium">{file.original_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Uploaded by: {file.uploaded_by} • {formatFileSize(file.file_size)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file._created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className={`text-sm ${getRiskLevelColor(file.file_type, file.file_size)}`}>
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      Risk Assessment
                    </div>
                    
                    {(file.file_type.startsWith('image/') || file.file_type.startsWith('text/')) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => previewFile(file)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile(file)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => banUserForFile(file.uploaded_by)}
                    >
                      Ban User
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteFile(file)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFileModeration;