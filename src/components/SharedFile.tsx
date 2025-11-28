import React from "react";
import { Download, FileText, Image, Video, File, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UploadedFile {
  _row_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  _created_at: number;
}

interface SharedFileProps {
  file: UploadedFile;
  isOwn: boolean;
}

const SharedFile = ({ file, isOwn }: SharedFileProps) => {
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

  const getFileUrl = () => {
    return `/content/chat_files/${file.filename}`;
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = getFileUrl();
    link.download = file.original_name;
    link.click();
  };

  const handlePreview = () => {
    window.open(getFileUrl(), '_blank');
  };

  return (
    <div className={`rounded-lg border ${
      isOwn ? 'bg-purple-500/10 border-purple-500/30' : 'bg-secondary/50 border-white/10'
    } p-3 max-w-sm`}>
      <div className="flex items-start gap-3">
        <div className="mt-1">
          {getFileIcon(file.file_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-foreground">
              {file.original_name}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.file_size)}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">
              Shared by {file.uploaded_by}
            </span>
          </div>
          <div className="flex gap-1">
            {file.file_type.startsWith('image/') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePreview}
                className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Preview
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedFile;