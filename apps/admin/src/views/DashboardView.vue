<script setup lang="ts">
import { onMounted, ref } from "vue";
import Message from "primevue/message";
import { apiFetch } from "../api/client";
import { useAuthStore } from "../stores/auth";

interface Stats {
  profiles: number;
  agents: number;
  activeAgents: number;
  payments: number;
  fundings: number;
  failedPayments: number;
}

const auth = useAuthStore();
const loading = ref(true);
const error = ref<string | null>(null);
const stats = ref<Stats | null>(null);

/**
 * Loads dashboard aggregates.
 */
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await apiFetch<{ ok: boolean; stats: Stats }>("/api/dashboard/stats", {
      token: auth.token,
    });
    stats.value = res.stats;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>总览</h1>
        <p>全站用户、Agent 与支付状态</p>
      </div>
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">用户 Profiles</div>
        <div class="value">{{ loading ? "…" : (stats?.profiles ?? 0) }}</div>
      </div>
      <div class="stat-card">
        <div class="label">Agents</div>
        <div class="value">{{ loading ? "…" : (stats?.agents ?? 0) }}</div>
      </div>
      <div class="stat-card">
        <div class="label">活跃 Agents</div>
        <div class="value">{{ loading ? "…" : (stats?.activeAgents ?? 0) }}</div>
      </div>
      <div class="stat-card">
        <div class="label">支付记录</div>
        <div class="value">{{ loading ? "…" : (stats?.payments ?? 0) }}</div>
      </div>
      <div class="stat-card">
        <div class="label">失败支付</div>
        <div class="value">{{ loading ? "…" : (stats?.failedPayments ?? 0) }}</div>
      </div>
      <div class="stat-card">
        <div class="label">充值记录</div>
        <div class="value">{{ loading ? "…" : (stats?.fundings ?? 0) }}</div>
      </div>
    </div>
  </div>
</template>
