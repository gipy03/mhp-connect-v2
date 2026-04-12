import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export const WISHLIST_QUERY_KEY = ["wishlist"] as const;

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: wishlist = [] } = useQuery<string[]>({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => api.get<string[]>("/wishlist"),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const addMutation = useMutation({
    mutationFn: (code: string) => api.post("/wishlist/" + code, {}),
    onMutate: async (code) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const prev = queryClient.getQueryData<string[]>(WISHLIST_QUERY_KEY);
      queryClient.setQueryData<string[]>(WISHLIST_QUERY_KEY, (old = []) => [...old, code]);
      return { prev };
    },
    onError: (_err, _code, context) => {
      if (context?.prev) queryClient.setQueryData(WISHLIST_QUERY_KEY, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (code: string) => api.delete("/wishlist/" + code),
    onMutate: async (code) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const prev = queryClient.getQueryData<string[]>(WISHLIST_QUERY_KEY);
      queryClient.setQueryData<string[]>(WISHLIST_QUERY_KEY, (old = []) =>
        old.filter((c) => c !== code)
      );
      return { prev };
    },
    onError: (_err, _code, context) => {
      if (context?.prev) queryClient.setQueryData(WISHLIST_QUERY_KEY, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
    },
  });

  const isWishlisted = (code: string) => wishlist.includes(code);

  const toggleWishlist = (code: string) => {
    if (isWishlisted(code)) {
      removeMutation.mutate(code);
    } else {
      addMutation.mutate(code);
    }
  };

  return { wishlist, isWishlisted, toggleWishlist, isLoading: addMutation.isPending || removeMutation.isPending };
}
