import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UserManager from "@/lib/userManagement";

interface UsernameSetupProps {
  onUsernameSet: (username: string) => void;
}

const UsernameSetup = ({ onUsernameSet }: UsernameSetupProps) => {
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSetting, setIsSetting] = useState(false);
  const { toast } = useToast();

  // Check for terms acceptance on component mount
  useEffect(() => {
    checkExistingAndTerms();
  }, []);

  const checkExistingAndTerms = async () => {
    try {
      // Check if terms have been accepted
      const termsAccepted = localStorage.getItem('terms_accepted');
      if (!termsAccepted) {
        console.log("Terms not accepted in username setup");
        // Terms check is handled by Index component
        return;
      }
      
      const existingUsername = await UserManager.getUsername();
      if (existingUsername) {
        onUsernameSet(existingUsername);
      }
    } catch (error) {
      console.error("Error checking existing username:", error);
    }
  };

  const checkAvailability = async () => {
    if (username.trim().length < 2) {
      setIsAvailable(false);
      return;
    }

    setIsChecking(true);
    try {
      const available = await UserManager.isUsernameAvailable(username.trim());
      setIsAvailable(available);
    } catch (error) {
      console.error("Error checking availability:", error);
      setIsAvailable(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (username.trim().length >= 2) {
      const timeoutId = setTimeout(checkAvailability, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setIsAvailable(null);
    }
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (username.trim().length < 2) {
      toast({
        title: "Invalid username",
        description: "Username must be at least 2 characters long",
        variant: "destructive",
      });
      return;
    }

    if (isAvailable === false) {
      toast({
        title: "Username taken",
        description: "This username is already taken by another user",
        variant: "destructive",
      });
      return;
    }

    setIsSetting(true);
    try {
      const success = await UserManager.setUsername(username.trim());
      if (success) {
        onUsernameSet(username.trim());
        toast({
          title: "Username set",
          description: `Your username "${username.trim()}" has been saved`,
        });
      } else {
        toast({
          title: "Failed to set username",
          description: "Unable to save your username. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error setting username:", error);
      toast({
        title: "Error",
        description: "An error occurred while setting your username",
        variant: "destructive",
      });
    } finally {
      setIsSetting(false);
    }
  };

  const getStatusColor = () => {
    if (isAvailable === true) return "text-green-500";
    if (isAvailable === false) return "text-red-500";
    if (isChecking) return "text-yellow-500";
    return "text-gray-500";
  };

  const getStatusIcon = () => {
    if (isAvailable === true) return <Check className="w-4 h-4" />;
    if (isAvailable === false) return <X className="w-4 h-4" />;
    return null;
  };

  const getStatusText = () => {
    if (isChecking) return "Checking...";
    if (isAvailable === true) return "Available";
    if (isAvailable === false) return "Taken";
    if (username.trim().length >= 2) return "Checking availability...";
    return "Enter 2+ characters";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg glass-morphism border-white/10">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Choose Your Username
          </CardTitle>
          <CardDescription className="text-gray-400">
            Choose a unique username that will be permanently linked to this device (max 10 characters)
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 10))}
                  placeholder="Choose your username"
                  className="bg-secondary/50 border-white/10 text-white placeholder:text-gray-500 pr-10"
                  disabled={isSetting}
                  minLength={2}
                  maxLength={10}
                />
                {getStatusIcon() && (
                  <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${getStatusColor()}`}>
                    {getStatusIcon()}
                  </div>
                )}
              </div>
              <div className={`text-xs ${getStatusColor()}`}>
                {getStatusText()}
              </div>
            </div>

            <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-300">
              <AlertDescription className="text-sm">
                <strong>Important:</strong> Your username will be permanently associated with this device's unique code. 
                You cannot change it later, and no one else can use the same username. Max 10 characters.
              </AlertDescription>
            </Alert>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 h-12 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              disabled={isSetting || isAvailable === false || username.trim().length < 2}
            >
              {isSetting ? "Setting Username..." : "Set Username Permanently"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsernameSetup;