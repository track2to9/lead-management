import type { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "@/lib/supabase-client";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: { name: "Login Error", message: error.message } };
    return { success: true, redirectTo: "/dashboard" };
  },

  register: async ({ email, password, company_name }) => {
    const { error } = await supabaseClient.auth.signUp({
      email, password,
      options: { data: { company_name } },
    });
    if (error) return { success: false, error: { name: "Register Error", message: error.message } };
    return { success: true, successNotification: { message: "인증 이메일을 확인해주세요." } };
  },

  logout: async () => {
    await supabaseClient.auth.signOut();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) return { authenticated: true };
    return { authenticated: false, redirectTo: "/login" };
  },

  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      name: data.user.user_metadata?.company_name || data.user.email?.split("@")[0],
      email: data.user.email,
    };
  },

  getPermissions: async () => null,

  onError: async (error) => {
    if (error?.status === 401) return { logout: true };
    return { error };
  },
};
