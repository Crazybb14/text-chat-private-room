import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Palette, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { settingText, useAppSettings } from "@/lib/appSettings";
import {
  DEFAULT_THEME_COLOR,
  THEME_PRESETS,
  dailyThemeColor,
  presetName,
  resolveThemeColor,
  sanitizeHex,
  themeSurfaces,
} from "@/lib/siteTheme";

/**
 * Admin tab for the site's color of the day. Picking a color tints every
 * page (lobby, rooms, private chats) toward it instead of plain gray, and
 * everyone sees it on their next page load.
 */
const AdminTheme = () => {
  const { toast } = useToast();
  const { settings, loaded, update, reload } = useAppSettings();

  const storedMode = settingText(settings, "theme_mode") === "daily" ? "daily" : "manual";
  const storedColor = sanitizeHex(settingText(settings, "theme_color")) ?? DEFAULT_THEME_COLOR;
  const [hexInput, setHexInput] = useState(storedColor);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHexInput(storedColor);
  }, [storedColor]);

  // What the site actually shows right now (manual pick, or today's auto color)
  const activeColor = useMemo(() => resolveThemeColor(settings), [settings]);
  const todayAuto = dailyThemeColor(new Date());
  const preview = themeSurfaces(activeColor);

  const saveColor = async (hex: string) => {
    setBusy(true);
    try {
      await update("theme_color", hex);
      await update("theme_mode", "manual");
      toast({
        title: "Color updated",
        description: `The site now uses ${presetName(hex)}. Everyone sees it on their next page load.`,
      });
    } catch {
      toast({ title: "Couldn't save the color", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveMode = async (daily: boolean) => {
    setBusy(true);
    try {
      await update("theme_mode", daily ? "daily" : "manual");
      toast({
        title: daily ? "Auto-rotate is on" : "Manual color is on",
        description: daily
          ? "A new color is picked automatically every day."
          : "The site keeps the color you picked until you change it.",
      });
    } catch {
      toast({ title: "Couldn't save that", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const applyCustom = async () => {
    const hex = sanitizeHex(hexInput);
    if (!hex) {
      toast({
        title: "That isn't a color code",
        description: "Use a 6-digit hex code like #3e6bd6.",
        variant: "destructive",
      });
      return;
    }
    setHexInput(hex);
    await saveColor(hex);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4" /> Color of the day
            {!loaded && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Badge variant="outline" className="ml-1 font-mono uppercase">{activeColor}</Badge>
            {storedMode === "daily" && <Badge className="ml-1">auto · {presetName(activeColor)}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Pick a color and the whole site — the room list, chat background, and message box —
            tints toward it instead of gray. Everyone sees the new color the next time their page
            loads.
          </p>

          <div className="grid grid-cols-6 gap-2 sm:w-fit">
            {THEME_PRESETS.map((preset) => {
              const selected = storedMode === "manual" && preset.hex === storedColor;
              return (
                <button
                  key={preset.hex}
                  type="button"
                  aria-label={`Use ${preset.name}`}
                  title={preset.name}
                  disabled={busy}
                  onClick={() => {
                    setHexInput(preset.hex);
                    void saveColor(preset.hex);
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 transition-transform hover:scale-105 disabled:opacity-60 ${
                    selected ? "border-white" : "border-transparent"
                  }`}
                  style={{ backgroundColor: preset.hex }}
                >
                  {selected && <Check className="h-5 w-5 text-white drop-shadow" aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 w-44">
              <Label htmlFor="theme-hex">Custom color</Label>
              <Input
                id="theme-hex"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="#3e6bd6"
                className="font-mono"
                maxLength={7}
                onKeyDown={(e) => e.key === "Enter" && void applyCustom()}
              />
            </div>
            <Button variant="outline" onClick={() => void applyCustom()} disabled={busy}>
              Apply color
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void reload()}
              disabled={busy}
              aria-label="Reload theme settings"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New color every day</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Rotate automatically</p>
              <p className="text-xs text-muted-foreground">
                When on, a color from the palette above is picked automatically each day — today's
                would be {presetName(todayAuto)}. When off, the site keeps the color you picked.
              </p>
            </div>
            <Switch checked={storedMode === "daily"} onCheckedChange={(v) => void saveMode(v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            How the site looks with {presetName(activeColor)} — sidebar, chat background, and
            message box.
          </p>
          <div className="flex overflow-hidden rounded-lg border border-white/10" style={{ backgroundColor: preview.chat }}>
            <div className="w-28 p-2 space-y-1.5" style={{ backgroundColor: preview.side }}>
              <div className="h-5 rounded" style={{ backgroundColor: preview.active }} />
              <div className="h-5 rounded opacity-60" style={{ backgroundColor: preview.hover }} />
              <div className="h-5 rounded opacity-40" style={{ backgroundColor: preview.hover }} />
            </div>
            <div className="flex-1 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full" style={{ backgroundColor: preview.accent }} />
                <span className="text-xs font-semibold text-white">@sample</span>
                <span className="text-[10px] text-white/50">Today at 4:20 PM</span>
              </div>
              <p className="text-xs text-white/80">This is what a message looks like.</p>
              <div
                className="rounded-lg px-3 py-2 text-xs text-white/80"
                style={{ backgroundColor: preview.input }}
              >
                Message #room
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTheme;
