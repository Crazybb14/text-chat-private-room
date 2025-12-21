import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, Ban, Check, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

const BanWordManager = () => {
  const { toast } = useToast();
  const [banWords, setBanWords] = useState<string[]>([]);
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [newBanWord, setNewBanWord] = useState("");
  const [newCustomWord, setNewCustomWord] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWordLists();
  }, []);

  const loadWordLists = async () => {
    try {
      const banned = await db.query("admin_settings", { setting_key: "eq.banned_words" });
      const custom = await db.query("admin_settings", { setting_key: "eq.custom_allowed_words" });
      
      const bannedWordsList = banned.length > 0 ? banned[0].setting_value.split(",").filter((w: string) => w.trim()) : [];
      const customWordsList = custom.length > 0 ? custom[0].setting_value.split(",").filter((w: string) => w.trim()) : [];
      
      setBanWords(bannedWordsList);
      setCustomWords(customWordsList);
    } catch (error) {
      console.log("Error loading word lists:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveBanWords = async (words: string[]) => {
    try {
      const existing = await db.query("admin_settings", { setting_key: "eq.banned_words" });
      const value = words.join(",");
      
      if (existing.length > 0) {
        await db.update("admin_settings", { setting_key: "eq.banned_words" }, { setting_value: value });
      } else {
        await db.insert("admin_settings", { setting_key: "banned_words", setting_value: value });
      }
      
      setBanWords(words);
      toast({
        title: "Banned words updated",
        description: `${words.length} words are now banned`,
      });
    } catch (error) {
      console.log("Error saving banned words:", error);
      toast({
        title: "Error",
        description: "Failed to update banned words",
        variant: "destructive",
      });
    }
  };

  const saveCustomWords = async (words: string[]) => {
    try {
      const existing = await db.query("admin_settings", { setting_key: "eq.custom_allowed_words" });
      const value = words.join(",");
      
      if (existing.length > 0) {
        await db.update("admin_settings", { setting_key: "eq.custom_allowed_words" }, { setting_value: value });
      } else {
        await db.insert("admin_settings", { setting_key: "custom_allowed_words", setting_value: value });
      }
      
      setCustomWords(words);
      toast({
        title: "Custom words updated",
        description: `${words.length} custom words saved`,
      });
    } catch (error) {
      console.log("Error saving custom words:", error);
      toast({
        title: "Error",
        description: "Failed to update custom words",
        variant: "destructive",
      });
    }
  };

  const addBanWord = async () => {
    if (!newBanWord.trim()) return;
    
    const word = newBanWord.toLowerCase().trim();
    if (banWords.includes(word)) {
      toast({
        title: "Already exists",
        description: "This word is already in the banned list",
        variant: "destructive",
      });
      return;
    }
    
    await saveBanWords([...banWords, word]);
    setNewBanWord("");
  };

  const removeBanWord = async (wordToRemove: string) => {
    await saveBanWords(banWords.filter(w => w !== wordToRemove));
  };

  const addCustomWord = async () => {
    if (!newCustomWord.trim()) return;
    
    const word = newCustomWord.toLowerCase().trim();
    if (customWords.includes(word)) {
      toast({
        title: "Already exists",
        description: "This word is already in the custom list",
        variant: "destructive",
      });
      return;
    }
    
    await saveCustomWords([...customWords, word]);
    setNewCustomWord("");
  };

  const removeCustomWord = async (wordToRemove: string) => {
    await saveCustomWords(customWords.filter(w => w !== wordToRemove));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banned Words Section */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-400" />
            Banned Words ({banWords.length})
          </CardTitle>
          <CardDescription>
            Words that will immediately ban users when typed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add banned word..."
              value={newBanWord}
              onChange={(e) => setNewBanWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBanWord()}
              className="bg-secondary/50 border-white/10"
            />
            <Button onClick={addBanWord} className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          
          <ScrollArea className="h-64 border border-white/10 rounded-md p-3 bg-secondary/30">
            {banWords.length === 0 ? (
              <p className="text-center text-gray-400 italic">No banned words configured</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {banWords.map((word, index) => (
                  <Badge key={index} variant="destructive" className="flex items-center gap-1">
                    {word}
                    <button
                      onClick={() => removeBanWord(word)}
                      className="ml-1 hover:bg-red-600/80 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="flex items-center gap-2 text-sm text-yellow-400">
            <AlertTriangle className="w-4 h-4" />
            Users will be immediately banned for these words
          </div>
        </CardContent>
      </Card>

      {/* Custom Allowed Words Section */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-400" />
            Custom Allowed Words ({customWords.length})
          </CardTitle>
          <CardDescription>
            Words that override the default profanity filter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add custom allowed word..."
              value={newCustomWord}
              onChange={(e) => setNewCustomWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomWord()}
              className="bg-secondary/50 border-white/10"
            />
            <Button onClick={addCustomWord} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          
          <ScrollArea className="h-64 border border-white/10 rounded-md p-3 bg-secondary/30">
            {customWords.length === 0 ? (
              <p className="text-center text-gray-400 italic">No custom words configured</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {customWords.map((word, index) => (
                  <Badge key={index} variant="default" className="flex items-center gap-1 bg-green-500/20 text-green-300 border-green-500/30">
                    {word}
                    <button
                      onClick={() => removeCustomWord(word)}
                      className="ml-1 hover:bg-green-600/80 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="flex items-center gap-2 text-sm text-green-400">
            <Check className="w-4 h-4" />
            These words are allowed even if they match profanity patterns
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BanWordManager;