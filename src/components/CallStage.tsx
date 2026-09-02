import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Eye,
  Headphones,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Shield,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCallMessages,
  getCallParticipants,
  ICE_SERVERS,
  joinCall,
  participantPresent,
  postSignal,
  removeParticipant,
  sendCallMessage,
  takeSignals,
  updateParticipant,
  type CallMessageRow,
  type CallParticipantRow,
} from "@/lib/calls";

type MediaPhase = "requesting" | "live" | "listen-only";

interface CallStageProps {
  callId: number;
  me: string;
  label: string;
  /** Silent moderation view: watch and listen without being shown to anyone. */
  hidden?: boolean;
  onLeave: (reason?: string) => void;
}

const POLL_MS = 1500;

function initials(name: string): string {
  return (name || "?").charAt(0).toUpperCase();
}

function gridColumns(count: number): string {
  if (count <= 1) return "1fr";
  if (count <= 2) return "repeat(2, minmax(0, 1fr))";
  if (count <= 4) return "repeat(2, minmax(0, 1fr))";
  if (count <= 9) return "repeat(3, minmax(0, 1fr))";
  return "repeat(4, minmax(0, 1fr))";
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

interface ChatPopup {
  id: number;
  from: string;
  text: string;
}

interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  isSelf: boolean;
  muted: boolean;
  connecting: boolean;
  /** Shown on tiles with no video, e.g. "Listening". */
  badge?: string | null;
}

const VideoTile = ({ stream, label, isSelf, muted, connecting, badge }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 min-h-[150px] flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        className={`w-full h-full object-cover ${isSelf ? "scale-x-[-1]" : ""} ${stream ? "" : "opacity-0 absolute"}`}
      />
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {connecting ? (
            <Loader2 className="w-7 h-7 animate-spin text-neutral-500" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex items-center justify-center text-2xl font-bold text-white">
              {initials(label)}
            </div>
          )}
          {badge && !connecting && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 text-neutral-200 text-[11px] font-medium">
              <Headphones className="w-3 h-3" />
              {badge}
            </div>
          )}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/70 text-white text-xs font-medium max-w-[calc(100%-1rem)]">
        <span className="truncate">{isSelf ? "You" : label}</span>
        {muted && <MicOff className="w-3 h-3 text-red-400 shrink-0" />}
      </div>
    </div>
  );
};

/**
 * Full-screen voice + video call. Connects everyone in the call directly to
 * everyone else (browser-to-browser) using the call's shared handshake rows.
 * If the camera/microphone aren't available the user still joins — listening,
 * texting in the call chat, and shown to everyone as being in the meeting.
 */
const CallStage = ({ callId, me, label, hidden = false, onLeave }: CallStageProps) => {
  const [phase, setPhase] = useState<MediaPhase>(hidden ? "listen-only" : "requesting");
  const [attempt, setAttempt] = useState(0);
  const [participants, setParticipants] = useState<CallParticipantRow[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [connStates, setConnStates] = useState<Record<string, string>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(!hidden);
  const [camOn, setCamOn] = useState(!hidden);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState<string | null>(null);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  // In-call text chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<CallMessageRow[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [popups, setPopups] = useState<ChatPopup[]>([]);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localRef = useRef<MediaStream | null>(null);
  const myRowRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const listenOnlyRef = useRef(hidden);
  const chatRowIdRef = useRef(0);
  const chatListRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const addPopups = useCallback((rows: CallMessageRow[]) => {
    const fromOthers = rows.filter((row) => row.username !== me);
    if (fromOthers.length === 0) return;
    const stamp = Date.now();
    const fresh = fromOthers.map((row, index) => ({
      id: row._row_id * 1000 + index,
      from: row.username,
      text: String(row.text ?? ""),
    }));
    setPopups((prev) => [...prev, ...fresh].slice(-3));
    setUnreadChat((n) => (chatOpenRef.current ? n : n + fresh.length));
    for (const item of fresh) {
      window.setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== item.id && stamp >= 0));
      }, 6000);
    }
  }, [me]);

  // Keeps addPopups' unread logic in sync with the drawer state
  const chatOpenRef = useRef(false);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadChat(0);
  }, [chatOpen]);

  useEffect(() => {
    if (chatOpen && chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  const makeOffer = useCallback(
    async (target: string, conn?: RTCPeerConnection) => {
      const pc = conn ?? peersRef.current.get(target);
      if (!pc) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
          await postSignal(callId, me, target, "offer", JSON.stringify(pc.localDescription));
        }
      } catch {
        // recoverable on the next poll
      }
    },
    [callId, me]
  );

  const createPeer = useCallback(
    (target: string, initiator: boolean): RTCPeerConnection => {
      const existing = peersRef.current.get(target);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const local = localRef.current;
      if (local) {
        for (const track of local.getTracks()) pc.addTrack(track, local);
      } else {
        // listen-only viewers and moderation send nothing
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addTransceiver("video", { direction: "recvonly" });
      }
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void postSignal(callId, me, target, "ice", JSON.stringify(event.candidate.toJSON()));
        }
      };
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) setStreams((prev) => ({ ...prev, [target]: stream }));
      };
      pc.onconnectionstatechange = () => {
        setConnStates((prev) => ({ ...prev, [target]: pc.connectionState }));
        if (pc.connectionState === "failed" && initiator) {
          void makeOffer(target);
        }
      };
      peersRef.current.set(target, pc);
      if (initiator) void makeOffer(target, pc);
      return pc;
    },
    [callId, me, makeOffer]
  );

  const flushIce = useCallback(async (from: string) => {
    const pc = peersRef.current.get(from);
    const queue = iceQueueRef.current.get(from);
    if (!pc || !queue || queue.length === 0) return;
    iceQueueRef.current.set(from, []);
    for (const candidate of queue) {
      await pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }, []);

  const handleSignal = useCallback(
    async (from: string, kind: string, payload: string) => {
      try {
        if (kind === "offer") {
          const pc = createPeer(from, false);
          await pc.setRemoteDescription(JSON.parse(payload) as RTCSessionDescriptionInit);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (pc.localDescription) {
            await postSignal(callId, me, from, "answer", JSON.stringify(pc.localDescription));
          }
          await flushIce(from);
        } else if (kind === "answer") {
          const pc = peersRef.current.get(from);
          if (!pc) return;
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(JSON.parse(payload) as RTCSessionDescriptionInit);
            await flushIce(from);
          }
        } else if (kind === "ice") {
          const pc = peersRef.current.get(from);
          const candidate = JSON.parse(payload) as RTCIceCandidateInit;
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(candidate).catch(() => undefined);
          } else {
            const queue = iceQueueRef.current.get(from) ?? [];
            queue.push(candidate);
            iceQueueRef.current.set(from, queue);
          }
        }
      } catch {
        // handshake races clear themselves on the next poll
      }
    },
    [callId, me, createPeer, flushIce]
  );

  const poll = useCallback(async () => {
    try {
      const rows = await getCallParticipants(callId);
      const mine = rows.find((r) => r.username === me);
      if (!mine) {
        if (!leavingRef.current) setEnded("The call has ended.");
        return;
      }
      myRowRef.current = mine._row_id;
      await updateParticipant(mine._row_id, { last_seen: Date.now() });
      // Listen-only members show up as no-mic / no-camera, not as absent.
      if (listenOnlyRef.current && (Number(mine.video_on) !== 0 || Number(mine.muted) !== 1)) {
        await updateParticipant(mine._row_id, { muted: 1, video_on: 0 });
      }
      setParticipants(rows);

      for (const row of rows) {
        if (row.username !== me) createPeer(row.username, me < row.username);
      }
      const present = new Set(rows.map((r) => r.username));
      for (const [target, pc] of peersRef.current) {
        if (!present.has(target)) {
          pc.close();
          peersRef.current.delete(target);
          setStreams((prev) => {
            const next = { ...prev };
            delete next[target];
            return next;
          });
        }
      }

      const signals = await takeSignals(callId, me);
      for (const signal of signals) {
        await handleSignal(signal.from_user, String(signal.kind), signal.payload);
      }

      const chatRows = await getCallMessages(callId, chatRowIdRef.current);
      if (chatRows.length > 0) {
        chatRowIdRef.current = Number(chatRows[chatRows.length - 1]._row_id);
        setChatMessages((prev) => [...prev, ...chatRows].slice(-200));
        addPopups(chatRows);
      }
    } catch {
      // transient — next poll retries
    }
  }, [callId, me, createPeer, handleSignal, addPopups]);

  pollRef.current = poll;

  // Join the call. Try camera + mic, then mic only, then fall back to
  // listening-only — nobody is blocked out of a call by missing devices.
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    const begin = async () => {
      listenOnlyRef.current = hidden;
      setMediaNotice(null);
      if (!hidden) {
        setPhase("requesting");
        let stream: MediaStream | null = null;
        try {
          if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!stopped) {
              setMediaNotice("Your camera isn't available — you're in with microphone only.");
            }
          } catch {
            stream = null;
            if (!stopped) {
              setMediaNotice(
                "Your camera and microphone aren't available. You're in the meeting — listening and using the chat."
              );
            }
          }
        }
        if (stopped) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        if (stream) {
          localRef.current = stream;
          setLocalStream(stream);
          setMicOn(true);
          setCamOn(stream.getVideoTracks().length > 0);
          listenOnlyRef.current = false;
          setPhase("live");
        } else {
          setMicOn(false);
          setCamOn(false);
          setPhase("listen-only");
        }
      } else {
        setPhase("listen-only");
      }

      const joined = await joinCall(callId, hidden);
      if (stopped) return;
      if (!joined.ok) {
        setEnded(joined.error ?? "Couldn't join the call.");
        return;
      }
      setStartedAt(Date.now());
      await pollRef.current();
      timer = window.setInterval(() => {
        if (!stopped) void pollRef.current();
      }, POLL_MS);
    };
    void begin();

    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
    };
  }, [callId, hidden, attempt]);

  // Elapsed timer
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  // Tear everything down when leaving
  useEffect(() => {
    return () => {
      leavingRef.current = true;
      if (myRowRef.current !== null) void removeParticipant(myRowRef.current);
      for (const pc of peersRef.current.values()) pc.close();
      peersRef.current.clear();
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, []);

  const handleLeave = useCallback(
    async (reason?: string) => {
      leavingRef.current = true;
      if (myRowRef.current !== null) await removeParticipant(myRowRef.current);
      for (const pc of peersRef.current.values()) pc.close();
      peersRef.current.clear();
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      onLeave(reason);
    },
    [onLeave]
  );

  /** Retry camera/mic from inside the call (rebuilds connections with media). */
  const retryDevices = () => {
    for (const pc of peersRef.current.values()) pc.close();
    peersRef.current.clear();
    setStreams({});
    setAttempt((a) => a + 1);
  };

  const toggleMic = async () => {
    const stream = localRef.current;
    if (!stream) return;
    const next = !micOn;
    for (const track of stream.getAudioTracks()) track.enabled = next;
    setMicOn(next);
    if (myRowRef.current !== null) {
      await updateParticipant(myRowRef.current, { muted: next ? 0 : 1 });
    }
  };

  const toggleCam = async () => {
    const stream = localRef.current;
    if (!stream) return;
    const next = !camOn;
    for (const track of stream.getVideoTracks()) track.enabled = next;
    setCamOn(next);
    if (myRowRef.current !== null) {
      await updateParticipant(myRowRef.current, { video_on: next ? 1 : 0 });
    }
  };

  const sendChat = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    try {
      await sendCallMessage(callId, me, text);
      await pollRef.current();
    } catch {
      setChatInput(text);
    }
  };

  if (ended) {
    return (
      <div className="fixed inset-0 z-[70] bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-5 max-w-sm">
          <PhoneOff className="w-14 h-14 text-neutral-500 mx-auto" />
          <h2 className="text-xl font-semibold">{ended}</h2>
          <Button variant="secondary" onClick={() => void handleLeave(ended)}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const tilesForUi = participants.filter((p) => participantPresent(p) && (hidden || Number(p.hidden) !== 1));
  const hasMedia = localStream !== null;

  return (
    <div className="fixed inset-0 z-[70] bg-neutral-950 text-white flex flex-col">
      <header className="shrink-0 px-4 py-3 flex items-center justify-between gap-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
            <VideoIcon className="w-5 h-5 text-indigo-300" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{label}</p>
            <p className="text-xs text-neutral-400">
              {formatElapsed(elapsed)} · {tilesForUi.filter((p) => Number(p.hidden) !== 1).length} in call
              {phase === "listen-only" && " · listening only"}
            </p>
          </div>
        </div>
        {hidden ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium shrink-0">
            <Eye className="w-3.5 h-3.5" />
            Silent moderation view — not shown to participants
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-neutral-400 hover:text-white hover:bg-white/10"
            aria-label="Leave call"
            onClick={() => void handleLeave()}
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        )}
      </header>

      {mediaNotice && (
        <div className="shrink-0 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-xs flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0">
            <Headphones className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{mediaNotice}</span>
          </span>
          {!hasMedia && !hidden && (
            <Button variant="outline" size="sm" className="h-7 shrink-0 border-amber-500/40 text-amber-200 hover:bg-amber-500/20" onClick={retryDevices}>
              Try camera/mic again
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto p-3 sm:p-4">
          <div
            className="grid gap-3 h-full min-h-[300px]"
            style={{
              gridTemplateColumns: window.innerWidth < 640 && tilesForUi.length > 1 ? "1fr" : gridColumns(tilesForUi.length),
              gridAutoRows: "1fr",
            }}
          >
            {tilesForUi.map((p) => {
              const isSelf = p.username === me;
              const stream = isSelf ? localStream : streams[p.username] ?? null;
              const state = isSelf ? "connected" : connStates[p.username] ?? "new";
              const connecting = !isSelf && state !== "connected";
              return (
                <VideoTile
                  key={p.username}
                  stream={stream}
                  label={p.username}
                  isSelf={isSelf}
                  muted={isSelf ? !micOn : Number(p.muted) === 1}
                  connecting={connecting}
                  badge={stream || connecting ? null : isSelf && !hasMedia ? "Listening" : Number(p.video_on) === 1 ? null : "No video"}
                />
              );
            })}
            {tilesForUi.length === 0 && (
              <div className="flex items-center justify-center text-neutral-500 text-sm">
                {phase === "requesting" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Asking for camera and microphone…
                  </span>
                ) : (
                  "Waiting for others to join…"
                )}
              </div>
            )}
          </div>
        </div>

        {/* Meet-style chat bubbles — bottom middle of the call */}
        {popups.length > 0 && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 w-full max-w-md px-4">
            {popups.map((popup) => (
              <div
                key={popup.id}
                className="w-full max-w-sm rounded-2xl bg-black/80 backdrop-blur border border-white/15 shadow-lg px-4 py-2.5 text-sm"
              >
                <span className="font-semibold text-indigo-300">@{popup.from}</span>
                <span className="text-neutral-100"> {popup.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chat drawer */}
        {chatOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-neutral-900/95 backdrop-blur border-l border-white/10 flex flex-col z-30">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> In-call messages
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 h-7"
                onClick={() => setChatOpen(false)}
              >
                Close
              </Button>
            </div>
            <div ref={chatListRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {chatMessages.length === 0 && (
                <p className="text-xs text-neutral-500 text-center pt-6">
                  No messages yet. Everyone in the call can read this chat — handy when someone
                  has no microphone.
                </p>
              )}
              {chatMessages.map((row) => (
                <div key={row._row_id} className="text-sm">
                  <span className={`font-semibold ${row.username === me ? "text-indigo-300" : "text-emerald-300"}`}>
                    {row.username === me ? "You" : `@${row.username}`}
                  </span>
                  <span className="text-neutral-100"> {String(row.text ?? "")}</span>
                </div>
              ))}
            </div>
            {hidden ? (
              <p className="px-4 py-3 border-t border-white/10 text-xs text-neutral-500">
                Silent moderation view — sending messages is disabled.
              </p>
            ) : (
              <form onSubmit={sendChat} className="p-3 border-t border-white/10 flex items-center gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send a message to the call…"
                  maxLength={500}
                  className="bg-neutral-800 border-white/15 text-white placeholder:text-neutral-500"
                />
                <Button type="submit" size="icon" aria-label="Send chat message" className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-white/10 py-4 flex items-center justify-center gap-3 relative">
        {hidden ? (
          <>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 mr-2">
              <Shield className="w-3.5 h-3.5" /> moderation
            </div>
            <Button variant="secondary" className="rounded-full" onClick={() => setChatOpen((o) => !o)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              {chatOpen ? "Hide chat" : "Chat"}
            </Button>
            <Button variant="secondary" className="rounded-full" onClick={() => void handleLeave()}>
              Stop watching
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon"
              aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
              title={hasMedia ? (micOn ? "Mute microphone" : "Unmute microphone") : "No microphone available"}
              disabled={!hasMedia}
              className={`rounded-full w-12 h-12 border-white/20 ${micOn && hasMedia ? "text-white hover:bg-white/10" : "bg-red-500/20 border-red-500/40 text-red-300"}`}
              onClick={() => void toggleMic()}
            >
              {micOn && hasMedia ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={camOn ? "Turn camera off" : "Turn camera on"}
              title={hasMedia ? (camOn ? "Turn camera off" : "Turn camera on") : "No camera available"}
              disabled={!hasMedia}
              className={`rounded-full w-12 h-12 border-white/20 ${camOn && hasMedia ? "text-white hover:bg-white/10" : "bg-red-500/20 border-red-500/40 text-red-300"}`}
              onClick={() => void toggleCam()}
            >
              {camOn && hasMedia ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
            {!hasMedia && (
              <Button
                variant="outline"
                className="rounded-full border-white/20 text-white hover:bg-white/10"
                onClick={retryDevices}
              >
                <VideoIcon className="w-4 h-4 mr-2" />
                Try camera/mic
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label={chatOpen ? "Close in-call chat" : "Open in-call chat"}
              title="In-call chat"
              className={`relative rounded-full w-12 h-12 border-white/20 ${chatOpen ? "bg-white/15 text-white" : "text-white hover:bg-white/10"}`}
              onClick={() => setChatOpen((o) => !o)}
            >
              <MessageSquare className="w-5 h-5" />
              {unreadChat > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {unreadChat > 9 ? "9+" : unreadChat}
                </span>
              )}
            </Button>
            <Button
              size="icon"
              aria-label="Leave call"
              title="Leave call"
              className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => void handleLeave()}
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </>
        )}
      </footer>
    </div>
  );
};

export default CallStage;
