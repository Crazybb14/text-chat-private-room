import type { ReactNode } from "react";
import {
  Hash,
  Headphones,
  Home,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  Shield,
  Users,
  Volume2,
  X,
} from "lucide-react";

/** Discord-style palette. Kept explicit so every page matches exactly. */
export const DC = {
  rail: "bg-[#1e1f22]",
  side: "bg-[#2b2d31]",
  chat: "bg-[#313338]",
  input: "bg-[#383a40]",
  text: "text-[#dbdee1]",
  heading: "text-[#f2f3f5]",
  muted: "text-[#949ba4]",
  line: "border-[#1e1f22]",
  hover: "hover:bg-[#35373c]",
  active: "bg-[#404249] text-white",
  blurple: "bg-[#5865f2] hover:bg-[#4752c4]",
};

const NAME_COLORS = ["#f23f43", "#f2782c", "#f7b427", "#3ba55c", "#21a3a3", "#3e7ff3", "#a855f7", "#eb459e"];

export function nameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

export function Avatar({ name, size = 40, className = "" }: { name: string; size?: number; className?: string }) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-flex select-none items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${nameColor(name)}, ${nameColor(name + "x")})`,
      }}
    >
      {initial}
    </span>
  );
}

export interface ShellRoom {
  id: number;
  name: string;
  is_private: number | 1 | 0 | boolean | null;
  is_voice: number | 1 | 0 | boolean | null;
}

export interface RoomSidebarProps {
  siteName: string;
  rooms: ShellRoom[];
  activeRoomId?: number | null;
  voiceCounts?: Record<number, number>;
  memberCounts?: Record<number, number>;
  username: string | null;
  canCreateRooms: boolean;
  isStaff?: boolean;
  onOpenRoom: (room: ShellRoom) => void;
  onHome: () => void;
  onCreateRoom: () => void;
  onDirectMessages: () => void;
  onFriends: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onAdmin?: () => void;
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-2 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">{children}</div>
);

export function RoomSidebar(props: RoomSidebarProps) {
  const textRooms = props.rooms.filter((r) => !r.is_voice);
  const voiceRooms = props.rooms.filter((r) => Boolean(r.is_voice));

  const roomRow = (room: ShellRoom, voice: boolean) => {
    const active = props.activeRoomId === room.id;
    const Icon = voice ? Volume2 : room.is_private ? Lock : Hash;
    const count = voice ? props.voiceCounts?.[room.id] : props.memberCounts?.[room.id];
    return (
      <button
        key={room.id}
        type="button"
        onClick={() => props.onOpenRoom(room)}
        className={`group flex w-full items-center gap-1.5 rounded-[4px] px-2 py-1.5 text-left text-[15px] ${
          active ? "bg-[#404249] text-white" : `text-[#949ba4] ${DC.hover} hover:text-[#dbdee1]`
        }`}
      >
        <Icon className="h-5 w-5 shrink-0 text-[#80848e]" aria-hidden />
        <span className="truncate font-medium">{room.name}</span>
        {count && count > 0 ? (
          <span className="ml-auto shrink-0 rounded-full bg-[#5865f2] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className={`flex h-full w-full flex-col ${DC.side} ${DC.text}`}>
      {/* brand */}
      <div className={`flex h-12 shrink-0 items-center gap-2 px-4 shadow-[0_1px_0_rgba(0,0,0,0.25)]`}>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${DC.blurple}`}>
          <MessageCircle className="h-4 w-4 text-white" aria-hidden />
        </span>
        <span className={`truncate text-[15px] font-bold ${DC.heading}`}>{props.siteName}</span>
      </div>

      {/* main nav */}
      <nav className="px-2" aria-label="Main">
        <button
          type="button"
          onClick={props.onHome}
          className={`mt-2 flex w-full items-center gap-3 rounded-[4px] px-2 py-1.5 text-left text-[15px] font-medium ${
            props.activeRoomId === null || props.activeRoomId === undefined
              ? "bg-[#404249] text-white"
              : `text-[#949ba4] ${DC.hover} hover:text-[#dbdee1]`
          }`}
        >
          <Home className="h-5 w-5 text-[#80848e]" aria-hidden />
          Home
        </button>
        <button
          type="button"
          onClick={props.onDirectMessages}
          className={`flex w-full items-center gap-3 rounded-[4px] px-2 py-1.5 text-left text-[15px] font-medium text-[#949ba4] ${DC.hover} hover:text-[#dbdee1]`}
        >
          <Users className="h-5 w-5 text-[#80848e]" aria-hidden />
          Friends &amp; DMs
        </button>
      </nav>

      <div className="mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <SectionLabel>Text rooms</SectionLabel>
        {textRooms.length === 0 ? (
          <p className="px-2 text-[13px] text-[#80848e]">No text rooms yet.</p>
        ) : (
          textRooms.map((r) => roomRow(r, false))
        )}

        <SectionLabel>Voice rooms</SectionLabel>
        {voiceRooms.length === 0 ? (
          <p className="px-2 text-[13px] text-[#80848e]">No voice rooms yet.</p>
        ) : (
          voiceRooms.map((r) => roomRow(r, true))
        )}

        {props.canCreateRooms ? (
          <button
            type="button"
            onClick={props.onCreateRoom}
            className={`mt-3 flex w-full items-center gap-1.5 rounded-[4px] border border-dashed border-[#4e5058] px-2 py-2 text-left text-sm text-[#949ba4] ${DC.hover}`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create a room
          </button>
        ) : null}
      </div>

      {/* user panel */}
      <div className={`flex shrink-0 items-center gap-2 ${DC.rail} px-2 py-2`}>
        <Avatar name={props.username ?? "?"} size={32} />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[13px] font-semibold ${DC.heading}`}>
            {props.username ? `@${props.username}` : "Guest"}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {props.isStaff && props.onAdmin ? (
            <button
              type="button"
              onClick={props.onAdmin}
              title="Admin panel"
              aria-label="Admin panel"
              className={`rounded p-1.5 ${DC.muted} ${DC.hover} hover:text-white`}
            >
              <Shield className="h-[18px] w-[18px]" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={props.onSettings}
            title="Settings"
            aria-label="Settings"
            className={`rounded p-1.5 ${DC.muted} ${DC.hover} hover:text-white`}
          >
            <Settings className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            onClick={props.onLogout}
            title="Log out"
            aria-label="Log out"
            className={`rounded p-1.5 ${DC.muted} ${DC.hover} hover:text-[#f23f43]`}
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mobile drawer wrapper — same sidebar, slides over the page. */
export function MobileSidebar({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Rooms">
      <button
        type="button"
        aria-label="Close rooms"
        className="absolute inset-0 h-full w-full bg-black/60"
        onClick={onClose}
      />
      <div className={`absolute bottom-0 left-0 top-0 flex w-[260px] flex-col ${DC.side} shadow-2xl`}>
        <div className={`flex h-12 shrink-0 items-center justify-between px-4 ${DC.side}`}>
          <span className={`text-[15px] font-bold ${DC.heading}`}>Rooms</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`rounded p-1 ${DC.muted} ${DC.hover}`}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export const MenuButton = ({ onClick, label = "Open rooms" }: { onClick: () => void; label?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`rounded p-2 md:hidden ${DC.muted} ${DC.hover} hover:text-white`}
  >
    <Menu className="h-5 w-5" aria-hidden />
  </button>
);

export const HeadphonesBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-[#23a559]/15 px-2 py-0.5 text-[11px] font-semibold text-[#23a559]">
    <Headphones className="h-3 w-3" aria-hidden />
    Voice room
  </span>
);
