"use client";

import { useState, useEffect } from "react";
import {
  generateChatKeypair,
  saveLocalAnonIdentity,
  loadLocalAnonIdentity,
  removeLocalAnonIdentity,
  importPeerPublicKey,
  deriveSharedChatKey,
  encryptChatMessage,
  decryptChatMessage,
} from "@/lib/crypto/community";
import { CRISIS_RESOURCES, detectCrisisSignals } from "@/lib/moderation/crisis";
import { AVATARS } from "@/lib/avatars";
import {
  Users,
  MessageSquare,
  Send,
  Lock,
  HeartHandshake,
  Trash2,
  Flag,
  MessageCircle,
  X,
  Check,
  AlertCircle,
  Loader2,
  Info,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  EyeOff,
  Eye,
  FileText,
  Sparkles,
  Droplets,
  Pill,
  Smile,
  Leaf,
  HelpCircle,
  Heart,
  Lightbulb,
  Shield,
} from "lucide-react";

interface PostItem {
  id: string;
  author_anon_id: string;
  author_handle: string;
  author_avatar: string;
  category: string;
  mood_tag: string | null;
  reactions: { hug: number; relate: number; helpful: number; strength: number };
  body: string;
  created_at: string;
  reply_count: number;
}

interface ReplyItem {
  id: string;
  author_anon_id: string;
  author_handle: string;
  author_avatar?: string;
  body: string;
  created_at: string;
}

interface ChatMsgItem {
  id: string;
  sender_anon_id: string;
  recipient_anon_id: string;
  ciphertext: string;
  nonce: string;
  created_at: string;
  plaintext?: string;
}

const CATEGORIES = [
  { id: "all", label: "All Posts", icon: Sparkles },
  { id: "general", label: "General", icon: MessageSquare },
  { id: "cycle", label: "Cycle & Period", icon: Droplets },
  { id: "pcos", label: "PCOS & Endo", icon: Pill },
  { id: "mood", label: "Mood & Mind", icon: Smile },
  { id: "wellness", label: "Wellness", icon: Leaf },
];

const MOOD_TAGS = [
  { id: "advice", label: "Seeking Advice", icon: HelpCircle },
  { id: "vent", label: "Venting / Hugs", icon: Heart },
  { id: "tip", label: "Sharing Tip", icon: Lightbulb },
  { id: "celebrate", label: "Celebrating Win", icon: Sparkles },
];

export default function CommunityPage() {
  // Identity State
  const [anonId, setAnonId] = useState<string | null>(null);
  const [anonHandle, setAnonHandle] = useState<string | null>(null);
  const [anonAvatar, setAnonAvatar] = useState<string>("bloom");
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null);
  const [joining, setJoining] = useState(false);
  const [selectedJoinAvatar, setSelectedJoinAvatar] = useState("bloom");

  // Feed State
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [newPostBody, setNewPostBody] = useState("");
  const [newPostCategory, setNewPostCategory] = useState("general");
  const [newPostMood, setNewPostMood] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [reactedMap, setReactedMap] = useState<Record<string, Record<string, boolean>>>({});

  // Replies State
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [newReplyBody, setNewReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  // 1:1 Chat State
  const [chatPeer, setChatPeer] = useState<{ id: string; handle: string; avatar?: string; publicKey?: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsgItem[]>([]);
  const [newChatText, setNewChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Modals State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [crisisAlert, setCrisisAlert] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "reply" | "chat_message"; id: string; content?: string } | null>(null);
  const [reportReason, setReportReason] = useState("Inappropriate content");
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    loadIdentityAndFeed();
  }, []);

  async function loadIdentityAndFeed() {
    setLoadingPosts(true);
    const stored = await loadLocalAnonIdentity();
    if (stored) {
      setAnonId(stored.anonId);
      setAnonHandle(stored.anonHandle);
      setMyPrivateKey(stored.privateKey);
      const localAv = localStorage.getItem("sz_anon_avatar") || "bloom";
      setAnonAvatar(localAv);
    } else {
      const vaultAv = localStorage.getItem("sz_avatar") || "bloom";
      setSelectedJoinAvatar(vaultAv);
    }
    await fetchPosts();
    setLoadingPosts(false);
  }

  async function fetchPosts() {
    try {
      const res = await fetch("/api/community/posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function getAvatarSvg(avatarId?: string) {
    const av = AVATARS.find((a) => a.id === avatarId) || AVATARS[0];
    return av.svg;
  }

  // ─── Join / Leave Community ───────────────────────────────────────────────

  async function handleJoinCommunity() {
    setJoining(true);
    try {
      const keypair = await generateChatKeypair();
      const vaultName = localStorage.getItem("sz_name") || undefined;

      const res = await fetch("/api/community/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_key: keypair.publicKeyBase64,
          avatar: selectedJoinAvatar,
          anon_handle: vaultName,
        }),
      });

      if (!res.ok) throw new Error("Failed to join community");

      const data = await res.json();
      await saveLocalAnonIdentity(data.anon_id, data.anon_handle, keypair);
      localStorage.setItem("sz_anon_avatar", data.avatar || selectedJoinAvatar);

      setAnonId(data.anon_id);
      setAnonHandle(data.anon_handle);
      setAnonAvatar(data.avatar || selectedJoinAvatar);
      setMyPrivateKey(keypair.privateKey);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Could not join community.");
    } finally {
      setJoining(false);
    }
  }

  function handleLeaveCommunity() {
    if (confirm("Leave the community? Your anonymous handle and 1:1 chat keys will be removed from this device.")) {
      removeLocalAnonIdentity();
      localStorage.removeItem("sz_anon_avatar");
      setAnonId(null);
      setAnonHandle(null);
      setMyPrivateKey(null);
      setChatPeer(null);
      setActivePostId(null);
    }
  }

  // ─── Create Post ──────────────────────────────────────────────────────────

  async function handleCreatePost() {
    if (!anonId || !newPostBody.trim() || posting) return;

    const { isCrisis } = detectCrisisSignals(newPostBody);
    if (isCrisis) {
      setCrisisAlert(true);
    }

    setPosting(true);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_anon_id: anonId,
          body: newPostBody.trim(),
          category: newPostCategory,
          mood_tag: newPostMood,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPosts([data.post, ...posts]);
        setNewPostBody("");
        setNewPostMood(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  }

  async function handleDeletePost(postId: string) {
    if (!anonId) return;
    try {
      const res = await fetch("/api/community/posts/" + postId, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author_anon_id: anonId }),
      });

      if (res.ok) {
        setPosts(posts.filter((p) => p.id !== postId));
        if (activePostId === postId) setActivePostId(null);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ─── 1-Tap Empathy Reactions ──────────────────────────────────────────────

  async function handleReact(postId: string, reactionType: "hug" | "relate" | "helpful" | "strength") {
    setPosts(posts.map((p) => {
      if (p.id !== postId) return p;
      return {
        ...p,
        reactions: {
          ...p.reactions,
          [reactionType]: (p.reactions[reactionType] || 0) + 1,
        },
      };
    }));

    setReactedMap((prev) => ({
      ...prev,
      [postId]: { ...(prev[postId] || {}), [reactionType]: true },
    }));

    try {
      await fetch("/api/community/posts/" + postId + "/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: reactionType }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  // ─── Replies Thread ───────────────────────────────────────────────────────

  async function handleOpenReplies(postId: string) {
    if (activePostId === postId) {
      setActivePostId(null);
      return;
    }
    setActivePostId(postId);
    setLoadingReplies(true);
    try {
      const res = await fetch("/api/community/posts/" + postId + "/replies");
      if (res.ok) {
        const data = await res.json();
        setReplies(data.replies || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReplies(false);
    }
  }

  async function handleCreateReply() {
    if (!anonId || !activePostId || !newReplyBody.trim() || replying) return;

    const { isCrisis } = detectCrisisSignals(newReplyBody);
    if (isCrisis) {
      setCrisisAlert(true);
    }

    setReplying(true);
    try {
      const res = await fetch("/api/community/posts/" + activePostId + "/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_anon_id: anonId,
          body: newReplyBody.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReplies([...replies, data.reply]);
        setNewReplyBody("");
        setPosts(posts.map((p) => p.id === activePostId ? { ...p, reply_count: p.reply_count + 1 } : p));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReplying(false);
    }
  }

  // ─── 1:1 E2E Encrypted Chat ───────────────────────────────────────────────

  async function handleStartChat(peerAnonId: string, peerHandle: string, peerAvatar?: string) {
    if (!anonId || !myPrivateKey) {
      alert("Please join the community first to start private 1:1 chats.");
      return;
    }
    if (peerAnonId === anonId) {
      alert("You cannot start a 1:1 chat with yourself.");
      return;
    }

    setChatPeer({ id: peerAnonId, handle: peerHandle, avatar: peerAvatar });
    setLoadingChat(true);
    try {
      const res = await fetch("/api/community/chat/" + peerAnonId + "/messages?my_anon_id=" + anonId);
      if (res.ok) {
        const data = await res.json();
        const peerPub = await importPeerPublicKey(data.peer.public_key);
        const sharedKey = await deriveSharedChatKey(myPrivateKey, peerPub);

        const decryptedList = await Promise.all(
          data.messages.map(async (m: ChatMsgItem) => {
            try {
              const plain = await decryptChatMessage(
                { ciphertext: m.ciphertext, nonce: m.nonce },
                sharedKey
              );
              return { ...m, plaintext: plain };
            } catch {
              return { ...m, plaintext: "[Undecryptable message]" };
            }
          })
        );

        setChatMessages(decryptedList);
        setChatPeer({ id: peerAnonId, handle: peerHandle, avatar: peerAvatar, publicKey: data.peer.public_key });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChat(false);
    }
  }

  async function handleSendChatMessage() {
    if (!anonId || !chatPeer || !chatPeer.publicKey || !myPrivateKey || !newChatText.trim() || sendingChat) return;

    setSendingChat(true);
    try {
      const peerPub = await importPeerPublicKey(chatPeer.publicKey);
      const sharedKey = await deriveSharedChatKey(myPrivateKey, peerPub);
      const payload = await encryptChatMessage(newChatText.trim(), sharedKey);

      const res = await fetch("/api/community/chat/" + chatPeer.id + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_anon_id: anonId,
          ciphertext: payload.ciphertext,
          nonce: payload.nonce,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages([
          ...chatMessages,
          {
            ...data.message,
            plaintext: newChatText.trim(),
          },
        ]);
        setNewChatText("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingChat(false);
    }
  }

  // ─── Reporting ────────────────────────────────────────────────────────────

  async function handleSubmitReport() {
    if (!anonId || !reportTarget || reporting) return;

    setReporting(true);
    try {
      const res = await fetch("/api/community/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporter_anon_id: anonId,
          target_type: reportTarget.type,
          target_id: reportTarget.id,
          reason: reportReason,
          reported_content: reportTarget.content,
        }),
      });

      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setReportTarget(null);
          setReportSuccess(false);
        }, 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReporting(false);
    }
  }

  const filteredPosts = selectedCategory === "all"
    ? posts
    : posts.filter((p) => p.category === selectedCategory);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 80px" }}>
      
      {/* ─── Header & Action Buttons ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 26, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
            Community
          </h1>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            Anonymous support & 1:1 private encrypted messaging.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Privacy & Trust Shield — icon only */}
          <button
            onClick={() => setShowPrivacyModal(true)}
            title="Privacy & Trust — how data is handled here"
            style={{ width: 36, height: 36, borderRadius: "50%", border: "0.5px solid var(--color-border)", background: "var(--color-surface-raised)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-brand)", flexShrink: 0 }}
          >
            <ShieldCheck size={18} />
          </button>

          {/* Crisis Hotline — icon only */}
          <button
            onClick={() => setShowCrisisModal(true)}
            title="Need Help? Crisis & support resources"
            style={{ width: 36, height: 36, borderRadius: "50%", border: "0.5px solid var(--color-border)", background: "var(--color-surface-raised)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)", flexShrink: 0 }}
          >
            <HeartHandshake size={18} />
          </button>
        </div>
      </div>

      {/* ─── Crisis Warning Banner (if triggered) ─── */}
      {crisisAlert && (
        <div style={{ background: "color-mix(in srgb, var(--color-brand) 12%, transparent)", border: "1px solid var(--color-brand)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <HeartHandshake size={18} color="var(--color-brand)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>You are not alone</span>
            </div>
            <button onClick={() => setCrisisAlert(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
              <X size={16} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.4 }}>
            If you or someone you know is going through a tough time, free confidential support is available 24/7.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <a href="tel:988" className="btn btn-primary" style={{ fontSize: 11, padding: "4px 10px", textDecoration: "none" }}>
              Call / Text 988
            </a>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setShowCrisisModal(true)}>
              View All Hotlines
            </button>
          </div>
        </div>
      )}

      {/* ─── Anonymous Identity Status / Join Banner ─── */}
      {!anonId ? (
        <div className="card" style={{ padding: 20, marginBottom: 16, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-voice)", fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
            Join the Anonymous Community
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", maxWidth: 420, margin: "0 auto 16px", lineHeight: 1.4 }}>
            Choose an avatar to join the safe space. An on-device E2E keypair will be generated for private 1:1 chat.
          </p>

          {/* Avatar Picker */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            {AVATARS.map((av) => {
              const isSelected = selectedJoinAvatar === av.id;
              return (
                <button
                  key={av.id}
                  onClick={() => setSelectedJoinAvatar(av.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: isSelected ? "2.5px solid var(--color-brand)" : "2px solid transparent",
                      boxShadow: isSelected ? "0 0 0 3px var(--color-brand-light)" : "none",
                      transform: isSelected ? "scale(1.1)" : "scale(1)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {av.svg}
                  </div>
                  <span style={{ fontSize: 10, color: isSelected ? "var(--color-brand)" : "var(--color-text-muted)", fontWeight: isSelected ? 600 : 400 }}>
                    {av.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            className="btn btn-primary"
            style={{ fontSize: 13, padding: "10px 24px" }}
            onClick={handleJoinCommunity}
            disabled={joining}
          >
            {joining ? "Generating Keys…" : "Join Anonymously"}
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--color-brand)", flexShrink: 0 }}>
              {getAvatarSvg(anonAvatar)}
            </div>
            <div>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block" }}>Active Member</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-brand)" }}>@{anonHandle}</span>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: "4px 10px" }}
            onClick={handleLeaveCommunity}
            title="Leave community and scrub local keys"
          >
            Leave
          </button>
        </div>
      )}

      {/* ─── Category Filter Pills (Icons Only) ─── */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12, scrollbarWidth: "none" }}>
        {CATEGORIES.map((c) => {
          const active = selectedCategory === c.id;
          const IconComponent = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              style={{
                background: active ? "var(--color-brand)" : "var(--color-surface)",
                color: active ? "#fff" : "var(--color-text-secondary)",
                border: active ? "1px solid var(--color-brand)" : "0.5px solid var(--color-border)",
                borderRadius: 20,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                whiteSpace: "nowrap",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
            >
              <IconComponent size={13} /> {c.label}
            </button>
          );
        })}
      </div>

      {/* ─── Create Rich Post Card ─── */}
      {anonId && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "1.5px solid var(--color-brand)", flexShrink: 0 }}>
              {getAvatarSvg(anonAvatar)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
              Post as @{anonHandle}
            </span>
          </div>

          <textarea
            className="input"
            rows={3}
            placeholder="Share an anonymous question, feeling, or story with the community…"
            value={newPostBody}
            onChange={(e) => setNewPostBody(e.target.value)}
            style={{ width: "100%", fontSize: 13, resize: "none", marginBottom: 10 }}
            maxLength={1000}
          />

          {/* Topic & Mood Selectors */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <select
              className="input"
              value={newPostCategory}
              onChange={(e) => setNewPostCategory(e.target.value)}
              style={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, cursor: "pointer" }}
            >
              <option value="general">General Discussion</option>
              <option value="cycle">Cycle & Period</option>
              <option value="pcos">PCOS & Endo</option>
              <option value="mood">Mood & Mind</option>
              <option value="wellness">Wellness & Tips</option>
            </select>

            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {MOOD_TAGS.map((m) => {
                const isSelected = newPostMood === m.id;
                const MoodIcon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setNewPostMood(isSelected ? null : m.id)}
                    style={{
                      background: isSelected ? "var(--color-surface-raised)" : "transparent",
                      border: isSelected ? "1px solid var(--color-brand)" : "1px solid var(--color-border)",
                      color: isSelected ? "var(--color-brand)" : "var(--color-text-muted)",
                      borderRadius: 14,
                      padding: "3px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: isSelected ? 600 : 400,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <MoodIcon size={12} /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "0.5px solid var(--color-border)", paddingTop: 10 }}>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {newPostBody.length}/1000
            </span>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: "6px 16px", gap: 6 }}
              onClick={handleCreatePost}
              disabled={posting || !newPostBody.trim()}
            >
              {posting ? <Loader2 size={14} className="spinner" /> : <Send size={14} />} Post
            </button>
          </div>
        </div>
      )}

      {/* ─── Discussion Feed ─── */}
      {loadingPosts ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--color-text-muted)" }}>
          <Loader2 size={24} className="spinner" style={{ margin: "0 auto 8px" }} />
          <p style={{ fontSize: 13 }}>Loading community posts…</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)" }}>
          <MessageSquare size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>No posts in this topic</p>
          <p style={{ fontSize: 12 }}>Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredPosts.map((post) => {
            const mood = MOOD_TAGS.find((m) => m.id === post.mood_tag);
            const categoryObj = CATEGORIES.find((c) => c.id === post.category);
            const CatIcon = categoryObj?.icon;
            const MoodIcon = mood?.icon;

            return (
              <div key={post.id} className="card" style={{ padding: 16 }}>
                {/* Post Header with rich avatar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--color-brand-light)", flexShrink: 0, boxShadow: "0 2px 8px rgba(var(--color-brand-rgb, 168 64 96) / 0.15)" }}>
                      {getAvatarSvg(post.author_avatar)}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                          @{post.author_handle}
                        </span>
                        {categoryObj && CatIcon && (
                          <span style={{ fontSize: 10, background: "var(--color-surface-raised)", border: "0.5px solid var(--color-border)", borderRadius: 10, padding: "2px 6px", color: "var(--color-text-secondary)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <CatIcon size={10} /> {categoryObj.label}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)", display: "block" }}>
                        {new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {anonId && post.author_anon_id !== anonId && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: 11, gap: 4 }}
                        onClick={() => handleStartChat(post.author_anon_id, post.author_handle, post.author_avatar)}
                        title="Direct 1:1 E2E encrypted chat"
                      >
                        <Lock size={11} color="var(--color-brand)" /> Chat
                      </button>
                    )}
                    {post.author_anon_id === anonId ? (
                      <button
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-danger)", padding: 4 }}
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete post"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}
                        onClick={() => setReportTarget({ type: "post", id: post.id, content: post.body })}
                        title="Report post"
                      >
                        <Flag size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mood Badge (if present) */}
                {mood && MoodIcon && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--color-surface-raised)", border: "0.5px solid var(--color-brand-light)", borderRadius: 12, padding: "2px 8px", marginBottom: 8, fontSize: 11, color: "var(--color-brand)", fontWeight: 500 }}>
                    <MoodIcon size={12} /> {mood.label}
                  </div>
                )}

                {/* Post Body */}
                <p style={{ fontSize: 13.5, color: "var(--color-text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: "0 0 12px" }}>
                  {post.body}
                </p>

                {/* Empathy Reactions Row (Lucide Icons Only) */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <button
                    onClick={() => handleReact(post.id, "hug")}
                    style={{
                      background: reactedMap[post.id]?.hug ? "var(--color-brand-light)" : "var(--color-surface-raised)",
                      border: reactedMap[post.id]?.hug ? "1px solid var(--color-brand)" : "0.5px solid var(--color-border)",
                      borderRadius: 14,
                      padding: "3px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <Heart size={12} color="var(--color-brand)" fill={reactedMap[post.id]?.hug ? "var(--color-brand)" : "none"} />
                    <span>Hug</span> {post.reactions.hug > 0 && <span style={{ fontWeight: 600 }}>{post.reactions.hug}</span>}
                  </button>

                  <button
                    onClick={() => handleReact(post.id, "relate")}
                    style={{
                      background: reactedMap[post.id]?.relate ? "var(--color-brand-light)" : "var(--color-surface-raised)",
                      border: reactedMap[post.id]?.relate ? "1px solid var(--color-brand)" : "0.5px solid var(--color-border)",
                      borderRadius: 14,
                      padding: "3px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <Users size={12} color="var(--color-text-secondary)" />
                    <span>Relate</span> {post.reactions.relate > 0 && <span style={{ fontWeight: 600 }}>{post.reactions.relate}</span>}
                  </button>

                  <button
                    onClick={() => handleReact(post.id, "helpful")}
                    style={{
                      background: reactedMap[post.id]?.helpful ? "var(--color-brand-light)" : "var(--color-surface-raised)",
                      border: reactedMap[post.id]?.helpful ? "1px solid var(--color-brand)" : "0.5px solid var(--color-border)",
                      borderRadius: 14,
                      padding: "3px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <Sparkles size={12} color="var(--color-brand)" />
                    <span>Helpful</span> {post.reactions.helpful > 0 && <span style={{ fontWeight: 600 }}>{post.reactions.helpful}</span>}
                  </button>

                  <button
                    onClick={() => handleReact(post.id, "strength")}
                    style={{
                      background: reactedMap[post.id]?.strength ? "var(--color-brand-light)" : "var(--color-surface-raised)",
                      border: reactedMap[post.id]?.strength ? "1px solid var(--color-brand)" : "0.5px solid var(--color-border)",
                      borderRadius: 14,
                      padding: "3px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <Shield size={12} color="var(--color-text-secondary)" />
                    <span>Strength</span> {post.reactions.strength > 0 && <span style={{ fontWeight: 600 }}>{post.reactions.strength}</span>}
                  </button>
                </div>

                {/* Post Actions: Replies button */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "0.5px solid var(--color-border)", paddingTop: 8 }}>
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-secondary)" }}
                    onClick={() => handleOpenReplies(post.id)}
                  >
                    <MessageCircle size={14} />
                    <span>{post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}</span>
                  </button>
                </div>

                {/* ─── Expandable Replies Thread ─── */}
                {activePostId === post.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--color-border)" }}>
                    {loadingReplies ? (
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Loading replies…</p>
                    ) : replies.length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No replies yet. Share your thoughts!</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                        {replies.map((reply) => (
                          <div key={reply.id} style={{ background: "var(--color-surface-raised)", borderRadius: 10, padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "1px solid var(--color-brand)" }}>
                                {getAvatarSvg(reply.author_avatar)}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-brand)" }}>
                                @{reply.author_handle}
                              </span>
                              <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: "auto" }}>
                                {new Date(reply.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p style={{ fontSize: 12.5, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.4 }}>
                              {reply.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Reply Input */}
                    {anonId && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          className="input"
                          type="text"
                          placeholder="Write an anonymous reply…"
                          value={newReplyBody}
                          onChange={(e) => setNewReplyBody(e.target.value)}
                          style={{ flex: 1, fontSize: 12 }}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateReply()}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 12, padding: "6px 12px" }}
                          onClick={handleCreateReply}
                          disabled={replying || !newReplyBody.trim()}
                        >
                          {replying ? "…" : "Reply"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 1:1 E2E Encrypted Chat Modal ─── */}
      {chatPeer && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 440, width: "100%", height: "80dvh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", borderRadius: 16 }}>
            {/* Chat Header with Peer Avatar */}
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-surface-raised)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "1.5px solid var(--color-brand)" }}>
                  {getAvatarSvg(chatPeer.avatar)}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                    @{chatPeer.handle}
                  </p>
                  <span style={{ fontSize: 11, color: "var(--color-brand)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Lock size={10} /> End-to-End Encrypted
                  </span>
                </div>
              </div>
              <button onClick={() => setChatPeer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Chat Message List */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {loadingChat ? (
                <div style={{ textAlign: "center", margin: "auto", color: "var(--color-text-muted)" }}>
                  <Loader2 size={20} className="spinner" style={{ margin: "0 auto 6px" }} />
                  <span style={{ fontSize: 12 }}>Deriving E2E session keys…</span>
                </div>
              ) : chatMessages.length === 0 ? (
                <div style={{ textAlign: "center", margin: "auto", color: "var(--color-text-muted)" }}>
                  <Lock size={24} style={{ margin: "0 auto 6px", opacity: 0.5 }} />
                  <p style={{ fontSize: 13, fontWeight: 500 }}>No messages yet</p>
                  <p style={{ fontSize: 11 }}>Messages are encrypted on your device and can only be read by @{chatPeer.handle}.</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.sender_anon_id === anonId;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isMe ? "flex-end" : "flex-start",
                        maxWidth: "80%",
                        padding: "8px 12px",
                        borderRadius: 12,
                        background: isMe ? "var(--color-brand)" : "var(--color-surface-raised)",
                        color: isMe ? "#fff" : "var(--color-text-primary)",
                      }}
                    >
                      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.4 }}>{msg.plaintext}</p>
                      <span style={{ fontSize: 9, opacity: 0.7, display: "block", textAlign: "right", marginTop: 2 }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input */}
            <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--color-border)", display: "flex", gap: 8, background: "var(--color-surface)" }}>
              <input
                className="input"
                type="text"
                placeholder="Type an encrypted message…"
                value={newChatText}
                onChange={(e) => setNewChatText(e.target.value)}
                style={{ flex: 1, fontSize: 13 }}
                onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                autoFocus
              />
              <button
                className="btn btn-primary"
                style={{ padding: "8px 14px" }}
                onClick={handleSendChatMessage}
                disabled={sendingChat || !newChatText.trim()}
              >
                {sendingChat ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Privacy & Trust Transparency Modal ─── */}
      {showPrivacyModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 420, width: "100%", borderRadius: 20, padding: 22, background: "var(--color-surface)", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
            
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={20} color="var(--color-brand)" />
                </div>
                <div>
                  <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                    Privacy & Trust
                  </h3>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
                    How your data is protected in SheZen
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPrivacyModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* 3 Compact Comparison Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              
              {/* Card 1: Private Health Logs */}
              <div style={{ background: "var(--color-surface-raised)", border: "0.5px solid var(--color-border)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Lock size={14} color="var(--color-brand)" /> Private Health & Cycle Logs
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, background: "color-mix(in srgb, var(--color-brand) 15%, transparent)", color: "var(--color-brand)", padding: "2px 8px", borderRadius: 10 }}>
                    Zero-Knowledge
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>
                  Encrypted on your device. We can never see or decrypt your cycles, journals, or health logs.
                </p>
              </div>

              {/* Card 2: Public Forum */}
              <div style={{ background: "var(--color-surface-raised)", border: "0.5px solid var(--color-border)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={14} color="var(--color-text-secondary)" /> Public Forum
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, background: "var(--color-border-strong)", color: "var(--color-text-secondary)", padding: "2px 8px", borderRadius: 10 }}>
                    Moderated & Safe
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>
                  Encrypted at rest, but scanned for spam and safety. 100% disconnected from your private SheZen profile.
                </p>
              </div>

              {/* Card 3: 1:1 Chat */}
              <div style={{ background: "var(--color-surface-raised)", border: "0.5px solid var(--color-border)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                    <KeyRound size={14} color="var(--color-brand)" /> 1:1 Direct Chat
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, background: "color-mix(in srgb, var(--color-brand) 15%, transparent)", color: "var(--color-brand)", padding: "2px 8px", borderRadius: 10 }}>
                    End-to-End Encrypted
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>
                  Direct device-to-device encryption (Signal model). Only you and your peer can read messages.
                </p>
              </div>

            </div>

            <button className="btn btn-primary" style={{ width: "100%", fontSize: 13, padding: "10px" }} onClick={() => setShowPrivacyModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ─── Crisis Resources Modal ─── */}
      {showCrisisModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 440, width: "100%", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <HeartHandshake size={20} color="var(--color-brand)" />
                <h3 style={{ fontFamily: "var(--font-voice)", fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                  Crisis & Support Resources
                </h3>
              </div>
              <button onClick={() => setShowCrisisModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.4 }}>
              If you or someone you care about is experiencing distress or self-harm thoughts, free confidential support is available 24/7:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {CRISIS_RESOURCES.map((r, i) => (
                <div key={i} style={{ background: "var(--color-surface-raised)", border: "0.5px solid var(--color-border)", borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>{r.name}</p>
                  <p style={{ fontSize: 12, color: "var(--color-brand)", fontWeight: 500, margin: "2px 0 4px" }}>{r.contact}</p>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>{r.description}</p>
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ width: "100%", fontSize: 13 }} onClick={() => setShowCrisisModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ─── Report Modal ─── */}
      {reportTarget && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 380, width: "100%", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Flag size={18} color="var(--color-danger)" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>Report Content</h3>
              </div>
              <button onClick={() => setReportTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            {reportSuccess ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <Check size={28} color="var(--color-brand)" style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Thank you for reporting.</p>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Our moderation team will review this promptly.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
                  Help keep this community supportive and safe. Select a reason for reporting:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {[
                    "Inappropriate or abusive content",
                    "Medical misinformation or dangerous advice",
                    "Self-harm or crisis disclosure",
                    "Spam or commercial promotion",
                  ].map((r, i) => (
                    <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-primary)", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="report_reason"
                        value={r}
                        checked={reportReason === r}
                        onChange={(e) => setReportReason(e.target.value)}
                      />
                      {r}
                    </label>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => setReportTarget(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: 12 }} onClick={handleSubmitReport} disabled={reporting}>
                    {reporting ? "Submitting…" : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
