import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Scale, ArrowLeft, Send, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";
import UserManager from "@/lib/userManagement";

const Appeal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [hasAppealed, setHasAppealed] = useState(false);
  const [session, setSession] = useState<Awaited<ReturnType<typeof UserManager.getSession>> | null>(null);

  useEffect(() => {
    UserManager.getSession().then(setSession);
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      const deviceId = getDeviceId();

      try {
        // Check if banned
        const bans = await db.query("bans", { device_id: `eq.${deviceId}` });
        if (bans.length > 0) {
          setIsBanned(true);
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

    if (!session?.username) {
      toast({ title: "Not signed in", description: "Please sign in to submit an appeal.", variant: "destructive" });
      return;
    }

    if (!reason.trim()) {
      toast({ title: "Empty reason", description: "Please explain why you should be unbanned.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceId = getDeviceId();

      await db.insert("appeals", {
        real_name: session.username,
        banned_username: session.username,
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
            <CardDescription>Think you were banned unfairly? Submit an appeal below.</CardDescription>
          </CardHeader>
          <CardContent>
            {hasAppealed ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Scale className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">Appeal Submitted</h3>
                <p className="text-muted-foreground">Your appeal is under review. Please wait for an admin to respond.</p>
              </div>
            ) : (
              <>
                {!isBanned && (
                  <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-center">
                    <p className="text-green-400 text-sm">Your device is not currently banned. This form is for banned users only.</p>
                  </div>
                )}

                {session?.username ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-secondary/50 rounded-lg p-3 mb-2 flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm">Appealing as @{session.username}</span>
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
                    <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700">
                      {isSubmitting ? "Submitting..." : <><Send className="w-4 h-4 mr-2" />Submit Appeal</>}
                    </Button>
                  </form>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">You need to be signed in to submit an appeal.</p>
                    <Button onClick={() => navigate("/login")} className="bg-blue-600 hover:bg-blue-700">
                      Go to sign-in
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Appeal;
