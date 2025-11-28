import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Scale, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

const Appeal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [realName, setRealName] = useState("");
  const [bannedUsername, setBannedUsername] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [hasAppealed, setHasAppealed] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const deviceId = getDeviceId();
      
      try {
        // Check if banned
        const bans = await db.query("bans", { device_id: `eq.${deviceId}` });
        if (bans.length > 0) {
          setIsBanned(true);
          setBannedUsername(bans[0].username || "");
        }
        
        // Check if already appealed
        const appeals = await db.query("appeals", { device_id: `eq.${deviceId}` });
        if (appeals.length > 0) {
          setHasAppealed(true);
        }
      } catch (error) {
        console.log("Error checking status:", error);
      }
    };
    
    checkStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!realName.trim() || !bannedUsername.trim() || !reason.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceId = getDeviceId();
      
      await db.insert("appeals", {
        real_name: realName.trim(),
        banned_username: bannedUsername.trim(),
        reason: reason.trim(),
        device_id: deviceId,
        status: "pending",
      });

      toast({
        title: "Appeal submitted!",
        description: "Your appeal will be reviewed by an admin",
      });
      
      setHasAppealed(true);
    } catch (error) {
      console.log("Error submitting appeal:", error);
      toast({
        title: "Error",
        description: "Failed to submit appeal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-blue-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-lg">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <Card className="glass-morphism border-white/10">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4">
              <Scale className="w-8 h-8 text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Ban Appeal</CardTitle>
            <CardDescription>
              Think you were banned unfairly? Submit an appeal below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasAppealed ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Scale className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">Appeal Submitted</h3>
                <p className="text-muted-foreground">
                  Your appeal is under review. Please wait for an admin to respond.
                </p>
              </div>
            ) : (
              <>
                {!isBanned && (
                  <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-center">
                    <p className="text-green-400 text-sm">
                      Your device is not currently banned. This form is for banned users only.
                    </p>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Your Real Name *
                    </label>
                    <Input
                      placeholder="Enter your real name"
                      value={realName}
                      onChange={(e) => setRealName(e.target.value)}
                      className="bg-secondary/50 border-white/10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Required for verification purposes
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Banned Username *
                    </label>
                    <Input
                      placeholder="Username you were banned on"
                      value={bannedUsername}
                      onChange={(e) => setBannedUsername(e.target.value)}
                      className="bg-secondary/50 border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Why should you be unbanned? *
                    </label>
                    <Textarea
                      placeholder="Explain why you believe your ban should be lifted..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="bg-secondary/50 border-white/10 min-h-[120px] resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Appeal
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Appeal;
