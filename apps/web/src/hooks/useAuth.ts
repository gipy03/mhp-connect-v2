import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  role: "member" | "admin";
  emailVerified: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  features: string[];
}

export const AUTH_QUERY_KEY = ["auth"] as const;

// Unauthenticated sentinel — returned when /me returns 401
const UNAUTHENTICATED: AuthState = { user: null, features: [] };

async function fetchMe(): Promise<AuthState> {
  try {
    return await api.get<AuthState>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return UNAUTHENTICATED;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// useAuth
// ---------------------------------------------------------------------------

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AuthState>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000, // 5 min — features change rarely
    retry: false,
  });

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  const loginMutation = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      api.post<{ user: AuthUser }>("/auth/login", creds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  });

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------

  const registerMutation = useMutation({
    mutationFn: (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => api.post<{ user: AuthUser }>("/auth/register", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  const logoutMutation = useMutation({
    mutationFn: () => api.post<{ success: true }>("/auth/logout", {}),
    onSuccess: () => {
      // Immediately clear the cache — no re-fetch needed
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, UNAUTHENTICATED);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    },
  });

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const user = data?.user ?? null;
  const features = data?.features ?? [];
  const isAdmin = user?.role === "admin";

  /**
   * True if the user has access to the given feature.
   * Admins always have all features without DB check.
   */
  const hasFeature = (key: string): boolean =>
    isAdmin || features.includes(key);

  return {
    user,
    features,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    hasFeature,
    error,
    login: loginMutation,
    logout: logoutMutation,
    register: registerMutation,
  };
}

// ---------------------------------------------------------------------------
// Pre-fetch helper (called from router context before guard evaluation)
// ---------------------------------------------------------------------------

export { fetchMe };
