import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Loader2, Send, Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { functions } from "@/lib/shared/kliv-functions.js";

interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

const AdminAI = () => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your AI assistant for the admin panel. I can help with questions about moderation, settings, users, and platform features. How can I help?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: AIMessage = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      // Call the server-side AI function that routes to a free model
      const response = await functions.invoke<{ reply: string }>("ai-assistant", {
        messages: [...messages, userMessage],
      });

      if (response?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: response.reply,
            timestamp: Date.now(),
          },
        ]);
      } else {
        setError("No response from the AI service. Try again.");
      }
    } catch (err) {
      console.error("AI chat error:", err);
      setError("Failed to reach the AI service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        <Bot className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">AI Assistant (beta)</h3>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 mb-3">
        <div className="space-y-3" ref={scrollRef}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs opacity-60 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary/50 rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <p className="text-sm">Thinking...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about moderation, settings, users, or platform features..."
          className="min-h-[60px] resize-none bg-secondary/50"
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()} className="px-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default AdminAI;
