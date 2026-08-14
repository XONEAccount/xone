import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
      meta: { public: true },
    },
    {
      path: "/",
      component: () => import("../layouts/AdminLayout.vue"),
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import("../views/DashboardView.vue"),
        },
        {
          path: "profiles",
          name: "profiles",
          component: () => import("../views/ProfilesView.vue"),
        },
        {
          path: "agents",
          name: "agents",
          component: () => import("../views/AgentsView.vue"),
        },
        {
          path: "payments",
          name: "payments",
          component: () => import("../views/PaymentsView.vue"),
        },
        {
          path: "fundings",
          name: "fundings",
          component: () => import("../views/FundingsView.vue"),
        },
        {
          path: "audit",
          name: "audit",
          component: () => import("../views/AuditView.vue"),
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === "login") return { name: "dashboard" };
    return true;
  }

  if (!auth.isAuthenticated) {
    const ok = await auth.hydrate();
    if (!ok) return { name: "login", query: { redirect: to.fullPath } };
  }

  return true;
});
