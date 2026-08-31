import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb, ArrowLeft, Send, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";
import UserManager from "@/lib/userManagement";

const Suggestions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [suggestion, setSuggestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [session, setSession] = useState<Awaited<ReturnType<typeof UserManager.getSession>> | null>(null);

  useEffect(() => {
    UserManager.getSession().then(setSession);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!session?.username) {
      toast({ title: "Not signed in", description: "Please sign in to submit a suggestion.", variant: "destructive" });
      return;
    }

    if (!suggestion.trim()) {
      toast({ title: "Empty suggestion", description: "Please enter your suggestion.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceId = getDeviceId();

      await db.insert("suggestions", {
        username: session.username,
        content: suggestion.trim(),
        device_id: deviceId,
      });

      toast({
        title: "Suggestion submitted!",
        description: "Thank you for your feedback",
      });

      setSuggestion("");
    } catch (error) {
      console.log("Error submitting suggestion:", error);
      toast({
        title: "Error",
        description: "Failed to submit suggestion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-yellow-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl" />

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
            <div className="mx-auto w-16 h-16 rounded-2xl bg-yellow-500/20 flex items-center justify-center mb-4">
              <Lightbulb className="w-8 h-8 text-yellow-400" />
            </div>
            <CardTitle className="text-2xl">Suggestions</CardTitle>
            <CardDescription>Have an idea to make the chat better? Let us know!</CardDescription>
          </CardHeader>
          <CardContent>
            {session?.username ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-secondary/50 rounded-lg p-3 mb-2 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-primary" />
                  <span className="text-sm">Submitting as @{session.username}</span>
                </div>
                <Textarea
                  placeholder="Your suggestion..."
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  className="bg-secondary/50 border-white/10 min-h-[150px] resize-none"
                />
                <Button type="submit" disabled={isSubmitting} className="w-full bg-yellow-600 hover:bg-yellow-700">
                  {isSubmitting ? "Submitting..." : <><Send className="w-4 h-4 mr-2" />Submit Suggestion</>}
                </Button>
              </form>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You need to be signed in to submit a suggestion.</p>
                <Button onClick={() => navigate("/login")} className="bg-yellow-600 hover:bg-yellow-700">
                  Go to sign-in
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Suggestions;
