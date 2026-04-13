import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  ArrowLeft,
  Users,
  User,
  Loader2,
  LogOut,
  UserPlus,
  UserMinus,
  Search,
  Check,
  X,
  Mail,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureGate } from "@/components/FeatureGate";
import { useAuth } from "@/hooks/useAuth";
import {
  useConversations,
  useMessages,
  useSendMessage,
  useMarkRead,
  useCreateConversation,
  useLeaveConversation,
  useAddParticipants,
  useRemoveParticipant,
  type ConversationListItem,
  type MessageItem,
} from "@/hooks/useMessaging";
import {
  useContacts,
  useContactRequests,
  useSendContactRequest,
  useAcceptContact,
  useRejectContact,
} from "@/hooks/useContacts";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SearchUser {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  contactStatus: string | null;
  contactId: string | null;
}

function participantName(p: { firstName: string | null; lastName: string | null }) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Membre";
}

function conversationDisplayName(
  conv: ConversationListItem,
  currentUserId: string
) {
  if (conv.isGroup && conv.title) return conv.title;
  const others = conv.participants.filter((p) => p.userId !== currentUserId);
  if (others.length === 0) return "Conversation";
  return others.map((p) => participantName(p)).join(", ");
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) {
    return d.toLocaleDateString("fr-CH", { weekday: "short" });
  }
  return d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}

function ConversationListView({
  conversations,
  selectedId,
  onSelect,
  currentUserId,
}: {
  conversations: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId: string;
}) {
  return (
    <div className="space-y-0.5">
      {conversations.map((conv) => {
        const name = conversationDisplayName(conv, currentUserId);
        const active = selectedId === conv.id;
        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
              active
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {conv.isGroup ? (
                  <Users className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("text-sm truncate", active && "font-medium")}>
                    {name}
                  </p>
                  {conv.unreadCount > 0 && (
                    <Badge
                      variant="default"
                      className="text-[10px] h-5 min-w-[20px] flex items-center justify-center shrink-0"
                    >
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.lastMessage.senderName}: {conv.lastMessage.body}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {formatTime(conv.lastMessageAt ?? conv.createdAt)}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: MessageItem;
  isOwn: boolean;
}) {
  const senderName = [message.senderFirstName, message.senderLastName]
    .filter(Boolean)
    .join(" ") || "Membre";

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-xl px-3.5 py-2 space-y-0.5",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {!isOwn && (
          <p className="text-[11px] font-medium opacity-70">{senderName}</p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={cn(
            "text-[10px] text-right",
            isOwn ? "text-primary-foreground/60" : "text-muted-foreground/60"
          )}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function MessageThread({
  conversationId,
  conversation,
  currentUserId,
  onBack,
}: {
  conversationId: string;
  conversation: ConversationListItem;
  currentUserId: string;
  onBack: () => void;
}) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const leaveConv = useLeaveConversation();
  const [body, setBody] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (conversationId) {
      markRead.mutate(conversationId);
    }
  }, [conversationId]);

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    if (allItems.length !== prevLengthRef.current) {
      const isNew = allItems.length > prevLengthRef.current && prevLengthRef.current > 0;
      prevLengthRef.current = allItems.length;
      if (isInitialLoadRef.current || isNew) {
        isInitialLoadRef.current = false;
        messagesEndRef.current?.scrollIntoView({ behavior: isNew ? "smooth" : "auto" });
      }
    }
  }, [allItems.length]);

  const handleSend = async () => {
    if (!body.trim()) return;
    try {
      await sendMessage.mutateAsync({ conversationId, body: body.trim() });
      setBody("");
    } catch {
      toast.error("Erreur lors de l'envoi du message.");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveConv.mutateAsync(conversationId);
      toast.success("Vous avez quitté la conversation.");
      onBack();
    } catch (err: any) {
      toast.error(err?.message || "Erreur.");
    }
  };

  const displayName = conversationDisplayName(conversation, currentUserId);
  const isCreator = conversation.createdBy === currentUserId;

  const messages = [...allItems].reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 border-b shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="md:hidden gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{displayName}</h2>
          <p className="text-xs text-muted-foreground">
            {conversation.participants.length} participant{conversation.participants.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {conversation.isGroup && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMembers(true)}
                title="Membres"
              >
                <Users className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeave}
                title="Quitter"
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-4 space-y-2.5 min-h-0">
        {hasNextPage && (
          <div className="flex justify-center pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs text-muted-foreground"
            >
              {isFetchingNextPage ? "Chargement..." : "Charger les messages précédents"}
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("flex items-start gap-3", i % 2 === 0 ? "" : "justify-end")}>
                {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
                <div className={cn("space-y-1.5", i % 2 === 0 ? "flex-1 max-w-[70%]" : "max-w-[70%]")}>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Aucun message. Envoyez le premier !
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === currentUserId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t shrink-0">
        <Textarea
          placeholder="Votre message..."
          rows={1}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 min-h-[40px] max-h-[120px] resize-none"
        />
        <Button
          size="sm"
          disabled={sendMessage.isPending || !body.trim()}
          onClick={handleSend}
          className="self-end"
        >
          {sendMessage.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {showMembers && (
        <MembersDialog
          conversation={conversation}
          currentUserId={currentUserId}
          isCreator={isCreator}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}

function MembersDialog({
  conversation,
  currentUserId,
  isCreator,
  onClose,
}: {
  conversation: ConversationListItem;
  currentUserId: string;
  isCreator: boolean;
  onClose: () => void;
}) {
  const removeParticipant = useRemoveParticipant();
  const addParticipants = useAddParticipants();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.get<SearchUser[]>(
        `/messages/search-users?q=${encodeURIComponent(q.trim())}`
      );
      const existingIds = new Set(conversation.participants.map((p) => p.userId));
      setSearchResults(results.filter((u) => !existingIds.has(u.userId)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (userId: string) => {
    try {
      await addParticipants.mutateAsync({
        conversationId: conversation.id,
        userIds: [userId],
      });
      toast.success("Participant ajouté.");
      setSearch("");
      setSearchResults([]);
      setShowAdd(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur.");
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeParticipant.mutateAsync({
        conversationId: conversation.id,
        userId,
      });
      toast.success("Participant retiré.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur.");
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Participants</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {conversation.participants.map((p) => (
            <div
              key={p.userId}
              className="flex items-center justify-between gap-2 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-sm truncate">
                  {participantName(p)}
                  {p.userId === conversation.createdBy && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (créateur)
                    </span>
                  )}
                </span>
              </div>
              {isCreator && p.userId !== currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(p.userId)}
                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {isCreator && (
          <>
            <Separator />
            {showAdd ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un membre..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                {searching && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {searchResults.map((u) => (
                  <button
                    key={u.userId}
                    onClick={() => handleAdd(u.userId)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm flex items-center gap-2"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || "Membre"}
                  </button>
                ))}
                {search.trim().length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Aucun résultat
                  </p>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdd(true)}
                className="gap-1.5 w-full"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Ajouter un participant
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddContactDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const sendRequest = useSendContactRequest();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [message, setMessage] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const q = search.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.get<SearchUser[]>(
          `/messages/search-users?q=${encodeURIComponent(q)}`
        );
        if (seq !== searchSeq.current) return;
        setSearchResults(results ?? []);
      } catch (err: any) {
        if (seq !== searchSeq.current) return;
        setSearchResults([]);
        toast.error(err?.message || "Erreur lors de la recherche.");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search]);

  const handleSendRequest = async () => {
    if (!selectedUser) return;
    try {
      await sendRequest.mutateAsync({
        recipientId: selectedUser.userId,
        message: message.trim() || undefined,
      });
      toast.success("Demande de contact envoyée.");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'envoi.");
    }
  };

  const userName = (u: { firstName: string | null; lastName: string | null }) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || "Membre";

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {selectedUser ? (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
              <UserCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium flex-1">{userName(selectedUser)}</span>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un membre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              {searching && (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto space-y-0.5 border rounded-md p-1">
                  {searchResults.map((u) => {
                    const isAccepted = u.contactStatus === "accepted";
                    const isPending = u.contactStatus === "pending";
                    return (
                      <button
                        key={u.userId}
                        onClick={() => {
                          if (!isAccepted && !isPending) {
                            setSelectedUser(u);
                            setSearch("");
                            setSearchResults([]);
                          }
                        }}
                        disabled={isAccepted || isPending}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded text-sm flex items-center gap-2",
                          isAccepted || isPending
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-accent"
                        )}
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{userName(u)}</p>
                        </div>
                        {isAccepted && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Déjà en contact</Badge>
                        )}
                        {isPending && (
                          <Badge variant="outline" className="text-[10px] shrink-0">En attente</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {search.trim().length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Aucun résultat
                </p>
              )}
            </>
          )}

          {selectedUser && (
            <Textarea
              placeholder="Message (optionnel) — ex: Bonjour, j'aimerais échanger sur..."
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          {selectedUser && (
            <Button
              size="sm"
              disabled={sendRequest.isPending}
              onClick={handleSendRequest}
            >
              {sendRequest.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              )}
              Envoyer la demande
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactRequestsSection() {
  const { data: requests, isLoading } = useContactRequests();
  const acceptContact = useAcceptContact();
  const rejectContact = useRejectContact();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Aucune demande en attente.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        const name = [req.requesterFirstName, req.requesterLastName]
          .filter(Boolean)
          .join(" ") || "Membre";

        return (
          <Card key={req.id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium">{name}</p>
                  {req.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {req.message}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60">
                    {req.createdAt ? formatTime(req.createdAt) : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={async () => {
                      try {
                        await acceptContact.mutateAsync(req.id);
                        toast.success("Contact accepté.");
                      } catch {
                        toast.error("Erreur.");
                      }
                    }}
                    disabled={acceptContact.isPending}
                    title="Accepter"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={async () => {
                      try {
                        await rejectContact.mutateAsync(req.id);
                        toast.success("Demande déclinée.");
                      } catch {
                        toast.error("Erreur.");
                      }
                    }}
                    disabled={rejectContact.isPending}
                    title="Décliner"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function NewConversationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createConversation = useCreateConversation();
  const sendContactRequest = useSendContactRequest();
  const { data: contacts } = useContacts();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [title, setTitle] = useState("");
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const q = search.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.get<SearchUser[]>(`/messages/search-users?q=${encodeURIComponent(q)}`);
        setSearchResults(results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]);

  const contactList = (contacts ?? []).map((c) => ({
    userId: c.userId,
    firstName: c.firstName,
    lastName: c.lastName,
    contactStatus: "accepted" as const,
    contactId: c.id,
  }));

  const displayUsers: SearchUser[] = search.trim().length >= 2 ? searchResults : contactList;

  const addSelected = (user: SearchUser) => {
    if (user.contactStatus !== "accepted") return;
    if (selected.some((s) => s.userId === user.userId)) return;
    setSelected((prev) => [...prev, user]);
    setSearch("");
  };

  const handleSendRequest = async (user: SearchUser) => {
    try {
      await sendContactRequest.mutateAsync({ recipientId: user.userId });
      setSentRequests((prev) => new Set(prev).add(user.userId));
      toast.success("Demande de contact envoyée");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast.error(message);
    }
  };

  const removeSelected = (userId: string) => {
    setSelected((prev) => prev.filter((u) => u.userId !== userId));
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    try {
      const result = await createConversation.mutateAsync({
        participantIds: selected.map((s) => s.userId),
        title: selected.length > 1 ? title.trim() || undefined : undefined,
      });
      onCreated(result.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création.";
      toast.error(message);
    }
  };

  const isGroup = selected.length > 1;
  const selectedIds = new Set(selected.map((s) => s.userId));
  const availableUsers = displayUsers.filter((u) => !selectedIds.has(u.userId));

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <Badge
                  key={u.userId}
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => removeSelected(u.userId)}
                >
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || "Membre"}
                  <span className="text-[10px]">&times;</span>
                </Badge>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un membre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {searching && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && availableUsers.length > 0 ? (
            <div className="max-h-[200px] overflow-y-auto space-y-0.5 border rounded-md p-1">
              {availableUsers.map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Membre";
                const isAccepted = u.contactStatus === "accepted";
                const isPending = u.contactStatus === "pending" || sentRequests.has(u.userId);

                return (
                  <div
                    key={u.userId}
                    className="w-full px-2.5 py-2 rounded hover:bg-accent text-sm flex items-center gap-2"
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{name}</p>
                    </div>
                    {isAccepted ? (
                      <button
                        onClick={() => addSelected(u)}
                        className="text-xs text-primary hover:underline shrink-0 flex items-center gap-1"
                      >
                        <UserCheck className="h-3 w-3" />
                        Sélectionner
                      </button>
                    ) : isPending ? (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Demande envoyée
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(u)}
                        disabled={sendContactRequest.isPending}
                        className="text-xs text-blue-600 hover:underline shrink-0 flex items-center gap-1"
                      >
                        <UserPlus className="h-3 w-3" />
                        Demander le contact
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !searching ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {search.trim().length >= 2
                ? "Aucun membre trouvé."
                : contacts && contacts.length === 0
                  ? "Aucun contact. Recherchez des membres pour envoyer des demandes de contact."
                  : "Tapez pour rechercher des membres ou parcourez vos contacts ci-dessous."}
            </p>
          ) : null}

          {isGroup && (
            <Input
              placeholder="Nom du groupe (optionnel)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={createConversation.isPending || selected.length === 0}
            onClick={handleCreate}
          >
            {createConversation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isGroup ? "Créer le groupe" : "Envoyer un message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessagesContent() {
  const { user } = useAuth();
  const { data: conversations, isLoading } = useConversations();
  const { data: contactRequests } = useContactRequests();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [activeTab, setActiveTab] = useState<"conversations" | "contacts" | "requests">("conversations");

  const selectedConv = conversations?.find((c) => c.id === selectedConvId) ?? null;

  const pendingCount = contactRequests?.length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-page-enter">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-page-enter">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conversations privées et de groupe
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setShowAddContact(true)} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Contact</span>
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nouveau</span>
          </Button>
        </div>
      </div>

      {showNew && (
        <NewConversationDialog
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            setSelectedConvId(id);
          }}
        />
      )}

      {showAddContact && (
        <AddContactDialog onClose={() => setShowAddContact(false)} />
      )}

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("conversations")}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "conversations"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Conversations
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "contacts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Contacts
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5",
            activeTab === "requests"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Demandes
          {pendingCount > 0 && (
            <Badge variant="default" className="text-[10px] h-5 min-w-[20px] flex items-center justify-center">
              {pendingCount}
            </Badge>
          )}
        </button>
      </div>

      {activeTab === "requests" && (
        <ContactRequestsSection />
      )}

      {activeTab === "contacts" && (
        <ContactsListSection onStartConversation={(userId) => {
          setShowNew(true);
        }} />
      )}

      {activeTab === "conversations" && (
        <div className="flex gap-4 min-h-[500px]">
          <div
            className={cn(
              "w-full md:w-80 shrink-0 space-y-2",
              selectedConvId ? "hidden md:block" : "block"
            )}
          >
            {!conversations || conversations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Aucune conversation pour le moment.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={() => setShowNew(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Démarrer une conversation
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ConversationListView
                conversations={conversations}
                selectedId={selectedConvId}
                onSelect={setSelectedConvId}
                currentUserId={user!.id}
              />
            )}
          </div>

          <div
            className={cn(
              "flex-1 min-w-0",
              !selectedConvId ? "hidden md:flex" : "flex"
            )}
          >
            {selectedConvId && selectedConv ? (
              <div className="w-full">
                <MessageThread
                  conversationId={selectedConvId}
                  conversation={selectedConv}
                  currentUserId={user!.id}
                  onBack={() => setSelectedConvId(null)}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center w-full">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez une conversation
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactsListSection({ onStartConversation }: { onStartConversation: (userId: string) => void }) {
  const { data: contacts, isLoading } = useContacts();
  const [showAddContact, setShowAddContact] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <UserCheck className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Aucun contact pour le moment.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowAddContact(true)}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Ajouter un contact
        </Button>
        {showAddContact && (
          <AddContactDialog onClose={() => setShowAddContact(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {contacts.map((c) => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Membre";
        return (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors"
          >
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm flex-1 min-w-0 truncate">{name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => onStartConversation(c.userId)}
              title="Envoyer un message"
            >
              <Mail className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export default function Messages() {
  return (
    <FeatureGate feature="community">
      <MessagesContent />
    </FeatureGate>
  );
}
