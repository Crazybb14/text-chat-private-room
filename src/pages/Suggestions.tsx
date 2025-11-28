import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

const Suggestions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!username.trim() || !suggestion.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in both your username and suggestion",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceId = getDeviceId();
      
      await db.insert("suggestions", {
        username: username.trim(),
        content: suggestion.trim(),
        device_id: deviceId,
      });

      toast({
        title: "Suggestion submitted!",
        description: "Thank you for your feedback",
      });
      
      setUsername("");
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
            <CardDescription>
              Have an idea to make the chat better? Let us know!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-secondary/50 border-white/10"
                />
              </div>
              <div>
                <Textarea
                  placeholder="Your suggestion..."
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  className="bg-secondary/50 border-white/10 min-h-[150px] resize-none"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-yellow-600 hover:bg-yellow-700"
              >
                {isSubmitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Suggestion
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Suggestions;
