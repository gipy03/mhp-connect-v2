import { useState } from "react";
import {
  Plus,
  Edit,
  Archive,
  ArchiveRestore,
  Hash,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useChannels,
  useCreateChannel,
  useUpdateChannel,
  useReorderChannels,
  type ForumChannel,
} from "@/hooks/useForum";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function ChannelForm({
  open,
  onClose,
  channel,
}: {
  open: boolean;
  onClose: () => void;
  channel?: ForumChannel;
}) {
  const isEdit = !!channel;
  const [name, setName] = useState(channel?.name ?? "");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [programCode, setProgramCode] = useState(channel?.programCode ?? "");
  const [sortOrder, setSortOrder] = useState(channel?.sortOrder ?? 0);

  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis.");
      return;
    }

    try {
      if (isEdit) {
        await updateChannel.mutateAsync({
          channelId: channel.id,
          name: name.trim(),
          description: description.trim() || null,
          programCode: programCode.trim() || null,
          sortOrder,
        });
        toast.success("Canal mis à jour.");
      } else {
        await createChannel.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          programCode: programCode.trim() || undefined,
          sortOrder,
        });
        toast.success("Canal créé.");
      }
      onClose();
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  const isPending = createChannel.isPending || updateChannel.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le canal" : "Nouveau canal"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Nom</Label>
            <Input
              id="ch-name"
              placeholder="Nom du canal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Description</Label>
            <Textarea
              id="ch-desc"
              placeholder="Description (optionnel)"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-prog">Code programme (optionnel)</Label>
            <Input
              id="ch-prog"
              placeholder="ex: OMNI-001"
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-sort">Ordre d'affichage</Label>
            <Input
              id="ch-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" disabled={isPending || !name.trim()} onClick={handleSubmit}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminChannels() {
  const { data: channels, isLoading } = useChannels(true);
  const updateChannel = useUpdateChannel();
  const reorderChannels = useReorderChannels();
  const [formOpen, setFormOpen] = useState(false);
  const [editChannel, setEditChannel] = useState<ForumChannel | undefined>();

  const handleToggleArchive = async (ch: ForumChannel) => {
    try {
      await updateChannel.mutateAsync({
        channelId: ch.id,
        archived: !ch.archived,
      });
      toast.success(ch.archived ? "Canal restauré." : "Canal archivé.");
    } catch {
      toast.error("Erreur.");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (!channels || index <= 0) return;
    const reordered = [...channels];
    const [item] = reordered.splice(index, 1);
    reordered.splice(index - 1, 0, item);
    try {
      await reorderChannels.mutateAsync(reordered.map((ch) => ch.id));
    } catch {
      toast.error("Erreur lors du réordonnancement.");
    }
  };

  const handleMoveDown = async (index: number) => {
    if (!channels || index >= channels.length - 1) return;
    const reordered = [...channels];
    const [item] = reordered.splice(index, 1);
    reordered.splice(index + 1, 0, item);
    try {
      await reorderChannels.mutateAsync(reordered.map((ch) => ch.id));
    } catch {
      toast.error("Erreur lors du réordonnancement.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Canaux de discussion
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les canaux du forum communautaire.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditChannel(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau canal
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : !channels || channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Hash className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucun canal. Créez-en un pour démarrer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {channels.map((ch, index) => (
            <Card
              key={ch.id}
              className={ch.archived ? "opacity-60" : undefined}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col shrink-0">
                    <button
                      className="text-muted-foreground/40 hover:text-foreground disabled:opacity-30 transition-colors p-0.5"
                      disabled={index === 0 || reorderChannels.isPending}
                      onClick={() => handleMoveUp(index)}
                      title="Monter"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="text-muted-foreground/40 hover:text-foreground disabled:opacity-30 transition-colors p-0.5"
                      disabled={index === channels.length - 1 || reorderChannels.isPending}
                      onClick={() => handleMoveDown(index)}
                      title="Descendre"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{ch.name}</span>
                      {ch.programCode && (
                        <Badge variant="secondary" className="text-[10px]">
                          {ch.programCode}
                        </Badge>
                      )}
                      {ch.archived && (
                        <Badge variant="outline" className="text-[10px]">
                          Archivé
                        </Badge>
                      )}
                    </div>
                    {ch.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {ch.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {ch.postCount} discussion{ch.postCount !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditChannel(ch);
                        setFormOpen(true);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleArchive(ch)}
                      title={ch.archived ? "Restaurer" : "Archiver"}
                    >
                      {ch.archived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <ChannelForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditChannel(undefined);
          }}
          channel={editChannel}
        />
      )}
    </div>
  );
}
