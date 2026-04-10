import { useState, useEffect } from "react";
import {
  Users,
  MessageSquare,
  Plus,
  Pin,
  ThumbsUp,
  Heart,
  Smile,
  ArrowLeft,
  Send,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Hash,
  Loader2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { FeatureGate } from "@/components/FeatureGate";
import { useAuth } from "@/hooks/useAuth";
import {
  useChannels,
  useChannelPosts,
  usePostDetail,
  usePostComments,
  useCreatePost,
  useCreateComment,
  useDeletePost,
  useUpdateComment,
  useDeleteComment,
  useToggleReaction,
  useTogglePin,
  type ForumChannel,
  type ForumComment,
  type PostAuthor,
} from "@/hooks/useForum";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const REACTION_TYPES = [
  { type: "like", icon: ThumbsUp, label: "J'aime" },
  { type: "love", icon: Heart, label: "J'adore" },
  { type: "smile", icon: Smile, label: "Sourire" },
];

function authorName(author: PostAuthor) {
  if (author.firstName || author.lastName) {
    return [author.firstName, author.lastName].filter(Boolean).join(" ");
  }
  return "Membre";
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChannelList({
  channels,
  selectedId,
  onSelect,
}: {
  channels: ForumChannel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      {channels.map((ch) => (
        <button
          key={ch.id}
          onClick={() => onSelect(ch.id)}
          className={cn(
            "w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-center gap-2.5",
            selectedId === ch.id
              ? "bg-primary/8 text-foreground font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Hash className="h-4 w-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{ch.name}</p>
          </div>
          {ch.postCount > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {ch.postCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ReactionBar({
  reactions,
  myReactions,
  onToggle,
}: {
  reactions: Record<string, number>;
  myReactions: string[];
  onToggle: (type: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {REACTION_TYPES.map((rt) => {
        const count = reactions[rt.type] ?? 0;
        const active = myReactions.includes(rt.type);
        return (
          <button
            key={rt.type}
            onClick={() => onToggle(rt.type)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors border",
              active
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/40 border-transparent text-muted-foreground hover:bg-accent"
            )}
            title={rt.label}
          >
            <rt.icon className="h-3 w-3" />
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PostListView({
  channelId,
  channel,
  onViewPost,
}: {
  channelId: string;
  channel: ForumChannel;
  onViewPost: (postId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useChannelPosts(channelId, page);

  useEffect(() => {
    setPage(1);
  }, [channelId]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const createPost = useCreatePost();
  const toggleReaction = useToggleReaction();

  const handleCreate = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    try {
      await createPost.mutateAsync({
        channelId,
        title: newTitle.trim(),
        body: newBody.trim(),
      });
      setNewTitle("");
      setNewBody("");
      setShowNewPost(false);
      toast.success("Discussion créée.");
    } catch {
      toast.error("Erreur lors de la création.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight truncate">
            {channel.name}
          </h2>
          {channel.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
              {channel.description}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowNewPost(true)} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Nouvelle discussion
        </Button>
      </div>

      <Dialog open={showNewPost} onOpenChange={setShowNewPost}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle discussion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Titre"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Contenu de votre message..."
              rows={5}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNewPost(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={createPost.isPending || !newTitle.trim() || !newBody.trim()}
              onClick={handleCreate}
            >
              {createPost.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucune discussion dans ce canal.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setShowNewPost(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Démarrer une discussion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.items.map((post) => (
            <Card
              key={post.id}
              className="cursor-pointer hover:border-foreground/20 transition-colors"
              onClick={() => onViewPost(post.id)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {post.pinned && (
                        <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                      <h3 className="text-sm font-medium truncate">
                        {post.title}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {post.body}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{authorName(post.author)}</span>
                      <span>{formatDate(post.createdAt)}</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {post.commentCount}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ReactionBar
                        reactions={post.reactions}
                        myReactions={post.myReactions}
                        onToggle={(type) =>
                          toggleReaction.mutate({ postId: post.id, type })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  userId,
  isAdmin,
  postId,
}: {
  comment: ForumComment;
  userId: string | null;
  isAdmin: boolean;
  postId: string;
}) {
  const deleteComment = useDeleteComment();
  const editComment = useUpdateComment();
  const toggleReaction = useToggleReaction();
  const canModify = userId === comment.authorId || isAdmin;
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  const handleSaveEdit = async () => {
    if (!editBody.trim()) return;
    try {
      await editComment.mutateAsync({
        commentId: comment.id,
        postId,
        body: editBody.trim(),
      });
      setEditing(false);
    } catch {
      toast.error("Erreur lors de la modification.");
    }
  };

  return (
    <div className="py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {authorName(comment.author)}
          </span>
          <span>{formatDate(comment.createdAt)}</span>
        </div>
        {canModify && (
          <div className="flex items-center gap-1">
            <button
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
              onClick={() => {
                setEditBody(comment.body);
                setEditing(!editing);
              }}
              title="Modifier"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              className="text-muted-foreground/50 hover:text-destructive transition-colors"
              onClick={() =>
                deleteComment.mutate({ commentId: comment.id, postId })
              }
              title="Supprimer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={editComment.isPending || !editBody.trim()}
              onClick={handleSaveEdit}
            >
              {editComment.isPending && (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
      )}
      <ReactionBar
        reactions={comment.reactions}
        myReactions={comment.myReactions}
        onToggle={(type) =>
          toggleReaction.mutate({ commentId: comment.id, type })
        }
      />
    </div>
  );
}

function PostDetailView({
  postId,
  onBack,
}: {
  postId: string;
  onBack: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const { data: post, isLoading: postLoading } = usePostDetail(postId);
  const { data: commentsData, isLoading: commentsLoading } =
    usePostComments(postId);
  const [commentBody, setCommentBody] = useState("");
  const createComment = useCreateComment();
  const deletePost = useDeletePost();
  const togglePin = useTogglePin();
  const toggleReaction = useToggleReaction();

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    try {
      await createComment.mutateAsync({ postId, body: commentBody.trim() });
      setCommentBody("");
    } catch {
      toast.error("Erreur lors de l'ajout du commentaire.");
    }
  };

  const handleDelete = async () => {
    try {
      await deletePost.mutateAsync(postId);
      toast.success("Discussion supprimée.");
      onBack();
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  if (postLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">
          Discussion introuvable.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onBack}>
          Retour
        </Button>
      </div>
    );
  }

  const canModify = user?.id === post.authorId || isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {post.pinned && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Pin className="h-3 w-3" />
                    Épinglé
                  </Badge>
                )}
                <CardTitle className="text-base">{post.title}</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{authorName(post.author)}</span>
                <span>{formatDate(post.createdAt)}</span>
                {post.updatedAt !== post.createdAt && (
                  <span className="italic">
                    (modifié {formatDate(post.updatedAt)})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePin.mutate(postId)}
                  title={post.pinned ? "Désépingler" : "Épingler"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </Button>
              )}
              {canModify && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-destructive hover:text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm whitespace-pre-wrap">{post.body}</p>
          <ReactionBar
            reactions={post.reactions}
            myReactions={post.myReactions}
            onToggle={(type) =>
              toggleReaction.mutate({ postId: post.id, type })
            }
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-1">
        <h3 className="text-sm font-medium">
          Commentaires
          {commentsData && commentsData.length > 0 && (
            <span className="text-muted-foreground ml-1.5">
              ({commentsData.length})
            </span>
          )}
        </h3>

        {commentsLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          </div>
        ) : !commentsData || commentsData.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">
            Aucun commentaire pour le moment.
          </p>
        ) : (
          <div className="divide-y">
            {commentsData.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                userId={user?.id ?? null}
                isAdmin={isAdmin}
                postId={postId}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Textarea
          placeholder="Ajouter un commentaire..."
          rows={2}
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleAddComment();
            }
          }}
        />
        <Button
          size="sm"
          disabled={createComment.isPending || !commentBody.trim()}
          onClick={handleAddComment}
          className="self-end"
        >
          {createComment.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

type ChannelFilter = "all" | "general" | "program";

function CommunityContent() {
  const { data: channels, isLoading } = useChannels();

  const urlParams = new URLSearchParams(window.location.search);
  const initialChannelId = urlParams.get("channelId");

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    initialChannelId
  );
  const [viewingPostId, setViewingPostId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");

  const filteredChannels = (channels ?? []).filter((ch) => {
    if (channelFilter === "general") return !ch.programCode;
    if (channelFilter === "program") return !!ch.programCode;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Communauté</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Échangez avec les autres praticiens certifiés MHP.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucun canal de discussion disponible pour le moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeChannelId = selectedChannelId ?? filteredChannels[0]?.id ?? null;
  const activeChannel =
    filteredChannels.find((ch) => ch.id === activeChannelId) ??
    filteredChannels[0] ??
    null;
  const resolvedActiveId = activeChannel?.id ?? null;

  const filterButtons: { value: ChannelFilter; label: string }[] = [
    { value: "all", label: "Tous" },
    { value: "general", label: "Général" },
    { value: "program", label: "Programmes" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Communauté</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Échangez avec les autres praticiens certifiés MHP.
        </p>
      </div>

      <div className="flex gap-6 min-h-[400px]">
        <div className="w-56 shrink-0 hidden md:block">
          <div className="flex items-center gap-1.5 px-3 mb-3">
            <Filter className="h-3 w-3 text-muted-foreground" />
            {filterButtons.map((fb) => (
              <button
                key={fb.value}
                onClick={() => {
                  setChannelFilter(fb.value);
                  setSelectedChannelId(null);
                  setViewingPostId(null);
                }}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full transition-colors",
                  channelFilter === fb.value
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {fb.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">
            Canaux
          </p>
          <ChannelList
            channels={filteredChannels}
            selectedId={resolvedActiveId}
            onSelect={(id) => {
              setSelectedChannelId(id);
              setViewingPostId(null);
            }}
          />
          {filteredChannels.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              Aucun canal dans cette catégorie.
            </p>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="md:hidden mb-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3 w-3 text-muted-foreground" />
              {filterButtons.map((fb) => (
                <button
                  key={fb.value}
                  onClick={() => {
                    setChannelFilter(fb.value);
                    setSelectedChannelId(null);
                    setViewingPostId(null);
                  }}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full transition-colors",
                    channelFilter === fb.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {fb.label}
                </button>
              ))}
            </div>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={resolvedActiveId ?? ""}
              onChange={(e) => {
                setSelectedChannelId(e.target.value);
                setViewingPostId(null);
              }}
            >
              {filteredChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  # {ch.name} ({ch.postCount})
                </option>
              ))}
            </select>
          </div>

          {viewingPostId ? (
            <PostDetailView
              postId={viewingPostId}
              onBack={() => setViewingPostId(null)}
            />
          ) : activeChannel ? (
            <PostListView
              channelId={resolvedActiveId!}
              channel={activeChannel}
              onViewPost={setViewingPostId}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Community() {
  return (
    <FeatureGate
      feature="community"
      message="L'espace communautaire est réservé aux praticiens ayant complété une formation MHP."
    >
      <CommunityContent />
    </FeatureGate>
  );
}
