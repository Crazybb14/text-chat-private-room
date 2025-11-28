import { Lightbulb, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Suggestion {
  _row_id: number;
  username: string;
  content: string;
  device_id: string | null;
  _created_at: number;
}

interface AdminSuggestionsListProps {
  suggestions: Suggestion[];
  onDelete: (id: number) => void;
}

const AdminSuggestionsList = ({ suggestions, onDelete }: AdminSuggestionsListProps) => {
  return (
    <Card className="glass-morphism border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          Suggestions ({suggestions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {suggestions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 px-4">
              No suggestions yet
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {suggestions.map((suggestion) => {
                const date = new Date(suggestion._created_at * 1000).toLocaleString();
                
                return (
                  <div
                    key={suggestion._row_id}
                    className="p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-yellow-400">
                            {suggestion.username}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {date}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground break-words">
                          {suggestion.content}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(suggestion._row_id)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        title="Delete suggestion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AdminSuggestionsList;
