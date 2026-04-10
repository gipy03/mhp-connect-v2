import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ForumChannel {
  id: string;
  name: string;
  description: string | null;
  programCode: string | null;
  sessionId: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string | null;
  postCount: number;
}

export interface PostAuthor {
  firstName: string | null;
  lastName: string | null;
}

export interface ForumPost {
  id: string;
  channelId: string;
  authorId: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  author: PostAuthor;
  commentCount: number;
  reactions: Record<string, number>;
  myReactions: string[];
}

export interface ForumPostDetail extends ForumPost {}

export interface ForumComment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string | null;
  author: PostAuthor;
  reactions: Record<string, number>;
  myReactions: string[];
}

export interface PostListResponse {
  items: ForumPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const CHANNELS_KEY = ["forum", "channels"] as const;
export const channelPostsKey = (channelId: string, page: number) =>
  ["forum", "posts", channelId, page] as const;
export const postDetailKey = (postId: string) =>
  ["forum", "post", postId] as const;
export const postCommentsKey = (postId: string) =>
  ["forum", "comments", postId] as const;

export function useChannels(includeArchived = false) {
  return useQuery<ForumChannel[]>({
    queryKey: [...CHANNELS_KEY, includeArchived],
    queryFn: () =>
      api.get<ForumChannel[]>(
        `/forum/channels${includeArchived ? "?includeArchived=true" : ""}`
      ),
    staleTime: 2 * 60 * 1000,
  });
}

export function useChannel(channelId: string | undefined) {
  return useQuery<ForumChannel>({
    queryKey: ["forum", "channel", channelId],
    queryFn: () => api.get<ForumChannel>(`/forum/channels/${channelId}`),
    enabled: !!channelId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useChannelPosts(channelId: string | undefined, page = 1) {
  return useQuery<PostListResponse>({
    queryKey: channelPostsKey(channelId ?? "", page),
    queryFn: () =>
      api.get<PostListResponse>(
        `/forum/channels/${channelId}/posts?page=${page}&limit=20`
      ),
    enabled: !!channelId,
    staleTime: 30 * 1000,
  });
}

export function usePostDetail(postId: string | undefined) {
  return useQuery<ForumPostDetail>({
    queryKey: postDetailKey(postId ?? ""),
    queryFn: () => api.get<ForumPostDetail>(`/forum/posts/${postId}`),
    enabled: !!postId,
    staleTime: 30 * 1000,
  });
}

export function usePostComments(postId: string | undefined) {
  return useQuery<ForumComment[]>({
    queryKey: postCommentsKey(postId ?? ""),
    queryFn: () => api.get<ForumComment[]>(`/forum/posts/${postId}/comments`),
    enabled: !!postId,
    staleTime: 30 * 1000,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { channelId: string; title: string; body: string }) =>
      api.post<ForumPost>(`/forum/channels/${data.channelId}/posts`, {
        title: data.title,
        body: data.body,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["forum", "posts", vars.channelId] });
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
    },
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      postId: string;
      title?: string;
      body?: string;
    }) =>
      api.patch<ForumPost>(`/forum/posts/${data.postId}`, {
        title: data.title,
        body: data.body,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: postDetailKey(data.id) });
      qc.invalidateQueries({ queryKey: ["forum", "posts"] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) =>
      api.delete<void>(`/forum/posts/${postId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum", "posts"] });
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
    },
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) =>
      api.post<ForumPost>(`/forum/posts/${postId}/pin`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: postDetailKey(data.id) });
      qc.invalidateQueries({ queryKey: ["forum", "posts"] });
    },
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { postId: string; body: string }) =>
      api.post<ForumComment>(`/forum/posts/${data.postId}/comments`, {
        body: data.body,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: postCommentsKey(vars.postId) });
      qc.invalidateQueries({ queryKey: ["forum", "posts"] });
    },
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { commentId: string; postId: string; body: string }) =>
      api.patch<ForumComment>(`/forum/comments/${data.commentId}`, { body: data.body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: postCommentsKey(vars.postId) });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { commentId: string; postId: string }) =>
      api.delete<void>(`/forum/comments/${data.commentId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: postCommentsKey(vars.postId) });
      qc.invalidateQueries({ queryKey: ["forum", "posts"] });
    },
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      postId?: string;
      commentId?: string;
      type: string;
    }) => api.post<{ action: "added" | "removed"; type: string }>("/forum/reactions", data),
    onSuccess: (_data, vars) => {
      if (vars.postId) {
        qc.invalidateQueries({ queryKey: postDetailKey(vars.postId) });
        qc.invalidateQueries({ queryKey: ["forum", "posts"] });
      }
      if (vars.commentId) {
        qc.invalidateQueries({ queryKey: ["forum", "comments"] });
      }
    },
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      programCode?: string;
      sortOrder?: number;
    }) => api.post<ForumChannel>("/forum/admin/channels", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
    },
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      channelId: string;
      name?: string;
      description?: string | null;
      programCode?: string | null;
      sortOrder?: number;
      archived?: boolean;
    }) => {
      const { channelId, ...body } = data;
      return api.patch<ForumChannel>(`/forum/admin/channels/${channelId}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
    },
  });
}

export function useReorderChannels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.post<{ ok: boolean }>("/forum/admin/channels/reorder", { orderedIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
    },
  });
}

export function useGetOrCreateProgramChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { programCode: string }) =>
      api.post<ForumChannel>("/forum/program-channel", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
    },
  });
}
