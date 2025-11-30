import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Image, Video, FileText, CheckCircle2, XCircle, Eye, 
  RefreshCw, Clock, User, Home, Trash2, Download,
  AlertTriangle, Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';
import { content } from '@/lib/shared/kliv-content.js';
import { getDeviceId } from '@/lib/deviceId';

interface PendingFile {
  _row_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  file_type: string;
  room_id: number;
  room_type: string;
  uploaded_by: string;
  device_id: string;
  status: string;
  _created_at: number;
}

interface Room {
  _row_id: number;
  name: string;
  type: string;
}

const AdminFileApproval = () => {
  const { toast } = useToast();
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<PendingFile | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadData = async () => {
    try {
      const query = filter === 'all' ? {} : { status: `eq.${filter}` };
      const [files, roomsData] = await Promise.all([
        db.query('pending_files', { ...query, order: '_created_at.desc' }),
        db.query('rooms', {})
      ]);
      setPendingFiles(files);
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoomName = (roomId: number) => {
    const room = rooms.find(r => r._row_id === roomId);
    return room?.name || `Room ${roomId}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-5 h-5 text-blue-400" />;
    if (fileType.startsWith('video/')) return <Video className="w-5 h-5 text-green-400" />;
    return <FileText className="w-5 h-5 text-gray-400" />;
  };

  const approveFile = async (file: PendingFile) => {
    try {
      // Update status to approved
      await db.update('pending_files', { _row_id: `eq.${file._row_id}` }, { 
        status: 'approved',
        reviewed_at: Date.now()
      });

      // Add to uploaded_files so it shows in chat
      await db.insert('uploaded_files', {
        filename: file.filename,
        original_name: file.original_name,
        file_size: file.file_size,
        file_type: file.file_type,
        room_id: file.room_id,
        uploaded_by: file.uploaded_by,
        device_id: file.device_id
      });

      // Send message about the approved file
      await db.insert('messages', {
        room_id: file.room_id,
        sender_name: file.uploaded_by,
        content: `📎 Shared a file: ${file.original_name} (${formatFileSize(file.file_size)})`,
        is_ai: 0,
        device_id: file.device_id
      });

      toast({ title: '✅ File Approved', description: file.original_name });
      loadData();
    } catch (error) {
      console.error('Error approving file:', error);
      toast({ title: 'Error', description: 'Failed to approve file', variant: 'destructive' });
    }
  };

  const rejectFile = async (file: PendingFile, reason?: string) => {
    try {
      await db.update('pending_files', { _row_id: `eq.${file._row_id}` }, { 
        status: 'rejected',
        reviewed_at: Date.now(),
        review_note: reason || 'Rejected by admin'
      });

      toast({ title: '❌ File Rejected', description: file.original_name });
      loadData();
    } catch (error) {
      console.error('Error rejecting file:', error);
      toast({ title: 'Error', description: 'Failed to reject file', variant: 'destructive' });
    }
  };

  const deleteFile = async (file: PendingFile) => {
    try {
      await db.delete('pending_files', { _row_id: `eq.${file._row_id}` });
      toast({ title: '🗑️ File Deleted', description: file.original_name });
      loadData();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const approveAll = async () => {
    const pending = pendingFiles.filter(f => f.status === 'pending');
    for (const file of pending) {
      await approveFile(file);
    }
    toast({ title: 'All Approved', description: `${pending.length} files approved` });
  };

  const rejectAll = async () => {
    const pending = pendingFiles.filter(f => f.status === 'pending');
    for (const file of pending) {
      await rejectFile(file, 'Bulk rejection');
    }
    toast({ title: 'All Rejected', description: `${pending.length} files rejected` });
  };

  const pendingCount = pendingFiles.filter(f => f.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/20">
            <Shield className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              File Approval Queue
              {pendingCount > 0 && (
                <Badge className="bg-red-500/20 text-red-300 animate-pulse">
                  {pendingCount} Pending
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">Review files before they appear in public rooms</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {pendingCount > 0 && (
            <>
              <Button onClick={approveAll} className="bg-green-600 hover:bg-green-700" size="sm">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve All ({pendingCount})
              </Button>
              <Button onClick={rejectAll} variant="destructive" size="sm">
                <XCircle className="w-4 h-4 mr-2" />
                Reject All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? 'bg-purple-600' : ''}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">{pendingCount}</Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Files Grid */}
      <ScrollArea className="h-[500px]">
        {pendingFiles.length === 0 ? (
          <Card className="glass-morphism border-white/10">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No {filter === 'all' ? '' : filter} files</h3>
              <p className="text-muted-foreground">
                {filter === 'pending' ? 'All files have been reviewed!' : 'No files to show.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingFiles.map((file) => (
              <Card 
                key={file._row_id} 
                className={`glass-morphism transition-all hover:scale-[1.02] ${
                  file.status === 'pending' ? 'border-yellow-500/30' :
                  file.status === 'approved' ? 'border-green-500/30' :
                  'border-red-500/30'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Preview */}
                  <div 
                    className="relative h-32 bg-black/20 rounded-lg overflow-hidden cursor-pointer group"
                    onClick={() => setPreviewFile(file)}
                  >
                    {file.file_type.startsWith('image/') ? (
                      <img 
                        src={`/content/chat_files/${file.filename}`}
                        alt={file.original_name}
                        className="w-full h-full object-contain"
                      />
                    ) : file.file_type.startsWith('video/') ? (
                      <video 
                        src={`/content/chat_files/${file.filename}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        {getFileIcon(file.file_type)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                    {/* Status Badge */}
                    <Badge className={`absolute top-2 right-2 ${
                      file.status === 'pending' ? 'bg-yellow-500/80' :
                      file.status === 'approved' ? 'bg-green-500/80' :
                      'bg-red-500/80'
                    }`}>
                      {file.status}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file.file_type)}
                      <span className="font-medium text-sm truncate">{file.original_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {file.uploaded_by}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Home className="w-3 h-3" />
                        {getRoomName(file.room_id)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(file._created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {file.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => approveFile(file)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        onClick={() => rejectFile(file)}
                        variant="destructive"
                        className="flex-1"
                        size="sm"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => window.open(`/content/chat_files/${file.filename}`, '_blank')}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button 
                        onClick={() => deleteFile(file)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Preview Modal */}
      {previewFile && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div className="max-w-4xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            {previewFile.file_type.startsWith('image/') ? (
              <img 
                src={`/content/chat_files/${previewFile.filename}`}
                alt={previewFile.original_name}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            ) : previewFile.file_type.startsWith('video/') ? (
              <video 
                src={`/content/chat_files/${previewFile.filename}`}
                controls
                className="max-w-full max-h-[80vh] rounded-lg"
              />
            ) : (
              <div className="bg-gray-900 p-8 rounded-lg text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold">{previewFile.original_name}</p>
                <p className="text-muted-foreground">{formatFileSize(previewFile.file_size)}</p>
              </div>
            )}
            <div className="mt-4 flex gap-2 justify-center">
              {previewFile.status === 'pending' && (
                <>
                  <Button onClick={() => { approveFile(previewFile); setPreviewFile(null); }} className="bg-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button onClick={() => { rejectFile(previewFile); setPreviewFile(null); }} variant="destructive">
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              <Button onClick={() => setPreviewFile(null)} variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFileApproval;
