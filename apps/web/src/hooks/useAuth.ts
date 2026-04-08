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
  impersonating?: boolean;
  firstName?: string | null;
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
    }) =>
      api.post<{ user?: AuthUser; activationSent?: boolean }>(
        "/auth/register",
        payload
      ),
    onSuccess: (data) => {
      if (data.user) {
        queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  const logoutMutation = useMutation({
    mutationFn: () => api.post<{ success: true }>("/auth/logout", {}),
    onSuccess: () => {
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, UNAUTHENTICATED);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    },
  });

  // ---------------------------------------------------------------------------
  // Stop impersonation
  // ---------------------------------------------------------------------------

  const stopImpersonatingMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/admin/stop-impersonating", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    },
  });

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const user = data?.user ?? null;
  const features = data?.features ?? [];
  const isAdmin = user?.role === "admin";
  const impersonating = data?.impersonating ?? false;
  const firstName = data?.firstName ?? null;

  const hasFeature = (key: string): boolean =>
    isAdmin || features.includes(key);

  return {
    user,
    features,
    firstName,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    impersonating,
    hasFeature,
    error,
    login: loginMutation,
    logout: logoutMutation,
    register: registerMutation,
    stopImpersonating: stopImpersonatingMutation,
  };
}

// ---------------------------------------------------------------------------
// Pre-fetch helper
// ---------------------------------------------------------------------------

export { fetchMe };
