import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export type PortalType = "member" | "trainer" | "admin";

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
  adminUser?: { id: string; email: string; displayName: string | null; isSuperAdmin: boolean } | null;
  availablePortals?: PortalType[];
  activePortal?: PortalType;
  isTrainer?: boolean;
}

export const AUTH_QUERY_KEY = ["auth"] as const;

const UNAUTHENTICATED: AuthState = { user: null, features: [] };

async function fetchMe(): Promise<AuthState> {
  try {
    return await api.get<AuthState>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return UNAUTHENTICATED;
    throw err;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AuthState>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      api.post<{ user: AuthUser }>("/auth/login", creds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  });

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

  const logoutMutation = useMutation({
    mutationFn: () => api.post<{ success: true }>("/auth/logout", {}),
    onSuccess: () => {
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, UNAUTHENTICATED);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    },
  });

  const stopImpersonatingMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/admin/stop-impersonating", {}),
    onSuccess: () => {
      window.location.href = "/admin";
    },
  });

  const switchPortalMutation = useMutation({
    mutationFn: (portal: PortalType) =>
      api.post("/auth/switch-portal", { portal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });

  const user = data?.user ?? null;
  const features = data?.features ?? [];
  const isAdmin = user?.role === "admin" || !!data?.adminUser;
  const isTrainer = data?.isTrainer ?? false;
  const impersonating = data?.impersonating ?? false;
  const firstName = data?.firstName ?? null;
  const adminUser = data?.adminUser ?? null;
  const availablePortals = data?.availablePortals ?? ["member"];
  const activePortal = data?.activePortal ?? "member";

  const hasFeature = (key: string): boolean =>
    isAdmin || features.includes(key);

  return {
    user,
    features,
    firstName,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    isTrainer,
    adminUser,
    impersonating,
    hasFeature,
    error,
    availablePortals,
    activePortal,
    login: loginMutation,
    logout: logoutMutation,
    register: registerMutation,
    stopImpersonating: stopImpersonatingMutation,
    switchPortal: switchPortalMutation,
  };
}

export { fetchMe };
