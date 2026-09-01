import { useMemo, useState } from "react";
import { FlaskConical, Search, ShieldCheck, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WORD_TIERS, findViolation } from "@/lib/moderation";

const BYPASS_EXAMPLES = [
  "f u c k", "sh1t", "f*ck", "fuuuck", "n1 gg er", "b@stard", "cu nt", "5hit",
];

/** Admin view of every bannable word, grouped by severity, with a live tester. */
const AdminWordList = () => {
  const [search, setSearch] = useState("");
  const [testText, setTestText] = useState("");

  const q = search.trim().toLowerCase();
  const tiers = useMemo(
    () =>
      WORD_TIERS.map((tier) => ({
        ...tier,
        shown: q ? tier.words.filter((w) => w.includes(q)) : tier.words,
      })),
    [q]
  );

  const testResult = useMemo(
    () => (testText.trim() ? findViolation(testText) : null),
    [testText]
  );
  const totalWords = WORD_TIERS.reduce((sum, t) => sum + t.words.length, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3 flex items-center justify-between gap-4 flex-wrap text-xs text-muted-foreground">
          <span>
            {totalWords} base words across {WORD_TIERS.length} severity tiers. Bypass spellings
            are matched automatically — no need to list every variant.
          </span>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search words…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-56 h-8"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" /> Try it yourself
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Type a message the way a user would (try normal words too — they should pass)…"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="min-h-[70px]"
          />
          {testText.trim() === "" ? (
            <p className="text-xs text-muted-foreground">
              This uses the exact same matching the live chat uses.
            </p>
          ) : testResult ? (
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <ShieldX className="w-4 h-4 text-destructive" />
              <span className="font-semibold">Blocked</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  WORD_TIERS.find((t) => t.tier === testResult.tier)?.color ?? ""
                }`}
              >
                {WORD_TIERS.find((t) => t.tier === testResult.tier)?.label}
              </span>
              <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
                {testResult.word}
              </code>
              {testResult.flags.map((flag) => (
                <span key={flag} className="text-xs text-muted-foreground">
                  #{flag}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold">Allowed</span>
              <span className="text-xs text-muted-foreground">— nothing bannable found</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bypass tricks that are already covered</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {BYPASS_EXAMPLES.map((example) => (
              <code
                key={example}
                className="font-mono text-xs bg-secondary px-2 py-1 rounded"
              >
                {example}
              </code>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Spelled-out letters, symbols between letters, number swaps (1→i, 3→e, 4→a, 5→s,
            7→t), stretched letters, and mixed forms are all caught — while ordinary words like
            “class”, “assassin”, or “gas hit” are left alone.
          </p>
        </CardContent>
      </Card>

      {tiers.map((tier) => (
        <Card key={tier.tier}>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className={`text-sm px-2.5 py-1 rounded-full border ${tier.color}`}>
                {tier.label}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {tier.shown.length} word{tier.shown.length === 1 ? "" : "s"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{tier.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {tier.shown.map((word) => (
                <code
                  key={word}
                  className="font-mono text-xs bg-secondary/70 px-2 py-1 rounded"
                >
                  {word}
                </code>
              ))}
              {tier.shown.length === 0 && (
                <p className="text-xs text-muted-foreground">No words match that search.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminWordList;
