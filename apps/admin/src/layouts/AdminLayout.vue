<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "primevue/button";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const items = [
  { label: "总览", to: "/", icon: "pi pi-home" },
  { label: "用户", to: "/profiles", icon: "pi pi-users" },
  { label: "Agents", to: "/agents", icon: "pi pi-bolt" },
  { label: "支付", to: "/payments", icon: "pi pi-wallet" },
  { label: "充值", to: "/fundings", icon: "pi pi-arrow-down" },
  { label: "审计", to: "/audit", icon: "pi pi-list" },
];

const activePath = computed(() => route.path);

/**
 * Logs out and returns to the login screen.
 */
function onLogout() {
  auth.logout();
  void router.push({ name: "login" });
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">X</div>
        <div>
          <div class="brand-title">Xone Admin</div>
          <div class="brand-sub">Ops Console</div>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: item.to === '/' ? activePath === '/' : activePath.startsWith(item.to) }"
        >
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <Button
          label="退出登录"
          icon="pi pi-sign-out"
          severity="secondary"
          text
          class="w-full"
          @click="onLogout"
        />
      </div>
    </aside>

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem 1rem;
  background: #111113;
  color: #fafafa;
  border-right: 1px solid #27272a;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.brand-mark {
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #fafafa;
  color: #111113;
  font-weight: 700;
}

.brand-title {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.brand-sub {
  font-size: 0.75rem;
  color: #a1a1aa;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  color: #d4d4d8;
  font-size: 0.92rem;
}

.nav-item:hover {
  background: #1c1c1f;
  color: #fff;
}

.nav-item.active {
  background: #fafafa;
  color: #111113;
  font-weight: 600;
}

.sidebar-footer {
  border-top: 1px solid #27272a;
  padding-top: 0.75rem;
}

.main {
  padding: 1.5rem 1.75rem 2rem;
  min-width: 0;
}

.w-full {
  width: 100%;
}

@media (max-width: 900px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .nav {
    flex-direction: row;
    overflow-x: auto;
  }
}
</style>
