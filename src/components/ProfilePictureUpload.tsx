import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { content } from "@/lib/shared/kliv-content.js";
import db from "@/lib/shared/kliv-database.js";

interface ProfilePictureUploadProps {
  username: string;
}

const ProfilePictureUpload = ({ username }: ProfilePictureUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive"
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadProfilePicture = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      toast({
        title: "No file selected",
        description: "Please select a file first",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const file = fileInputRef.current.files[0];
      const fileName = `profile_${username}_${Date.now()}.${file.type.split('/')[1]}`;
      
      // Upload to content filesystem
      const result = await content.uploadFile(file, `/content/profiles/`);
      
      // Update user profile in database
      await db.insert("user_settings", {
        username: username,
        setting_key: "profile_picture",
        setting_value: result.contentUrl,
        created_at: Date.now()
      });

      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been saved successfully"
      });

      setPreviewUrl("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload profile picture",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="w-20 h-20">
          <AvatarImage src={previewUrl || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold">
            {username.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full"
            disabled={uploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose Picture
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {previewUrl && (
        <div className="space-y-2">
          <div className="relative">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full max-w-xs rounded-lg border border-gray-700"
              style={{ width: '200px' }}
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={clearPreview}
              className="absolute top-2 right-2"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={uploadProfilePicture}
              disabled={uploading}
              className="bg-green-600 hover:bg-green-700"
            >
              <Camera className="w-4 h-4 mr-2" />
              {uploading ? "Uploading..." : "Save Profile Picture"}
            </Button>
            <Button
              variant="outline"
              onClick={clearPreview}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p>• Supported formats: JPG, PNG, GIF</p>
        <p>• Maximum file size: 5MB</p>
        <p>• Square images work best</p>
      </div>
    </div>
  );
};

export default ProfilePictureUpload;