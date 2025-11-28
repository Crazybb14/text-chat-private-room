import React, { useState, useRef } from "react";
import { Upload, X, FileText, Image, Video, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { content } from "@/lib/shared/kliv-content.js";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

interface FileUploadProps {
  roomId: number;
  username: string;
  onFileUploaded: () => void;
}

interface UploadedFile {
  _row_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  device_id: string | null;
  _created_at: number;
}

const FileUpload = ({ roomId, username, onFileUploaded }: FileUploadProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-4 h-4 text-blue-400" />;
    }
    if (fileType.startsWith('video/')) {
      return <Video className="w-4 h-4 text-green-400" />;
    }
    if (fileType.startsWith('text/') || fileType.includes('document')) {
      return <FileText className="w-4 h-4 text-yellow-400" />;
    }
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please keep files under 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const deviceId = getDeviceId();
      
      // Upload file to content storage
      const result = await content.uploadFile(file, '/content/chat_files/');
      
      // Save file info to database
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
      await db.insert("messages", {
        room_id: roomId,
        sender_name: username,
        content: `📎 Shared a file: ${file.name} (${formatFileSize(file.size)})`,
        is_ai: 0,
        device_id: deviceId,
      });

      toast({
        title: "File uploaded!",
        description: `${file.name} has been shared`,
      });
      
      onFileUploaded();
    } catch (error) {
      console.log("Error uploading file:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file",
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

  return (
    <div className="flex gap-2">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,video/*,.pdf,.txt,.doc,.docx"
      />
      <Button
        variant="outline"
        size="icon"
        onClick={handleUploadClick}
        disabled={isUploading}
        className="h-10 w-10"
      >
        {isUploading ? (
          <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
};

export default FileUpload;