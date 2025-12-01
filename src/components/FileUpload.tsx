import React, { useState, useRef, useEffect } from "react";
import { Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { content } from "@/lib/shared/kliv-content.js";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

interface FileUploadProps {
  roomId: number;
  roomType: string;
  username: string;
  onFileUploaded: () => void;
}

interface Setting {
  setting_key: string;
  setting_value: string;
}

const FileUpload = ({ roomId, roomType, username, onFileUploaded }: FileUploadProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await db.query('admin_settings', {});
      const map: Record<string, string> = {};
      data.forEach((s: Setting) => { map[s.setting_key] = s.setting_value; });
      setSettings(map);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const getBool = (key: string) => settings[key] === 'true';
  const getNum = (key: string) => parseInt(settings[key] || '10', 10);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isMediaFile = (fileType: string): boolean => {
    return fileType.startsWith('image/') || fileType.startsWith('video/');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
const fileUpload = async (file: File) => {
    try {
      if (!isMediaFile(file.type)) {
        toast({
          title: "❌ Invalid file type",
          description: "Only images and videos are allowed",
          variant: "destructive",
        });
        return;
      }

      if (file.size > (settings.max_file_size ? parseInt(settings.max_file_size) : 5 * 1024 * 1024)) {
        toast({
          title: "❌ File too large",
description: `Maximum size is ${Math.round((settings.max_file_size ? parseInt(settings.max_file_size) : 5 * 1024 * 1024) / (1024 * 1024))}MB`,
          variant: "destructive",
        });
        return;
      }

      const { content } = await import('../lib/shared/kliv-content.js');
      const result = await content.uploadFile(file, '/content/chat_files/');

      try {
const fileApprovalRequired = roomType === 'public' && settings.require_file_approval_public === 'true';
        if (fileApprovalRequired) {
          await db.insert("pending_files", {
            original_filename: file.name,
            file_path: result.contentUrl,
            uploaded_by: username,
            room_id: roomId,
            device_id: getDeviceId(),
            file_size: file.size,
            file_type: file.type,
          });
          toast({
            title: "📤 File uploaded for approval",
            description: "Your file is pending admin approval",
          });
        } else {
          // Store file directly for immediate display
          await db.insert("uploaded_files", {
            filename: result.contentUrl,
            room_id: roomId,
            uploaded_by: username,
          device_id: getDeviceId(),
            original_name: file.name,
            file_size: file.size,
            file_type: file.type
          });
          
          // Also store as message for instant chat display
          await db.insert("messages", {
            room_id: roomId,
            sender_name: username,
            content: `[FILE: ${file.name}]`,
            is_ai: 0,
            device_id: getDeviceId(),
          });
          
          toast({
            title: "✅ File uploaded successfully",
            description: `${file.name} is now visible in chat`,
          });
          
          onFileUploaded();
        }
      } catch (dbErr) {
        console.log("Database file insert error:", dbErr);
        throw dbErr;
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "❌ Upload failed",
        description: "Failed to upload file and save to database",
        variant: "destructive",
      });
    }
  };

    setIsUploading(true);

    try {
      const deviceId = getDeviceId();
      
      console.log("Starting file upload:", file.name, file.type, file.size);
      
      // Upload file to content storage
      const result = await content.uploadFile(file, '/content/chat_files/');
      
      console.log("Upload result:", result);
      
      if (!result || !result.filename) {
        throw new Error("Upload did not return a valid filename");
      }
      
      // Check if this is a public room and needs approval
      const requiresApproval = roomType === 'public' && getBool('require_file_approval_public');

      if (requiresApproval) {
        // Add to pending files for admin approval
        await db.insert("pending_files", {
          filename: result.filename,
          original_name: file.name,
          file_size: file.size,
          file_type: file.type,
          room_id: roomId,
          room_type: roomType,
          uploaded_by: username,
          device_id: deviceId,
          status: 'pending'
        });

        toast({
          title: "📤 File Submitted",
          description: "Admin will review before it shows in chat",
        });
      } else {
        // Direct upload for private rooms or if approval not required
        await db.insert("uploaded_files", {
          filename: result.filename,
          original_name: file.name,
          file_size: file.size,
          file_type: file.type,
          room_id: roomId,
          uploaded_by: username,
          device_id: deviceId,
        });

        // Send message about file
        const icon = file.type.startsWith('image/') ? '🖼️' : '🎬';
        await db.insert("messages", {
          room_id: roomId,
          sender_name: username,
          content: `${icon} Shared: ${file.name} (${formatFileSize(file.size)})`,
          is_ai: 0,
          device_id: deviceId,
        });

        toast({
          title: "✅ File shared!",
          description: file.name,
        });
      }
      
      // Log activity
      try {
        await db.insert("ip_activity_logs", {
          device_id: deviceId,
          username: username,
          action: "file_upload",
          room_id: roomId,
          message_preview: file.name,
        });
      } catch (logErr) {
        console.log("IP log failed:", logErr);
      }
      
      onFileUploaded();
    } catch (error: unknown) {
      console.error("File upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "❌ Upload failed",
        description: errorMessage.includes("filename") 
          ? "Could not save file. Please try again."
          : `Error: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Don't show if files are disabled
  if (settings.files_allowed === 'false') {
    return null;
  }

  return (
    <div className="flex gap-2">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,video/*"
      />
      <Button
        variant="outline"
        size="icon"
        onClick={handleUploadClick}
        disabled={isUploading}
        className="h-10 w-10 relative"
        title={roomType === 'public' ? 'Files need admin approval' : 'Upload photo/video'}
      >
        {isUploading ? (
          <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {roomType === 'public' && getBool('require_file_approval_public') && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-2 h-2 text-black" />
              </div>
            )}
          </>
        )}
      </Button>
    </div>
  );
};

export default FileUpload;
