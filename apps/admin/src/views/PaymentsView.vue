<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Select from "primevue/select";
import Tag from "primevue/tag";
import { apiFetch } from "../api/client";
import {
  PAGE_SIZE_OPTIONS,
  useServerPagination,
} from "../composables/use-server-pagination";
import { useAuthStore } from "../stores/auth";

interface PaymentRow {
  id: string;
  agent_id: string;
  amount: number | string;
  asset: string;
  chain: string;
  recipient: string;
  merchant: string | null;
  resource: string | null;
  status: string;
  provider: string;
  failure_reason: string | null;
  created_at: string;
}

const auth = useAuthStore();
const agentId = ref("");
const status = ref<string | null>(null);
const statusOptions = [
  { label: "全部状态", value: null },
  { label: "confirmed", value: "confirmed" },
  { label: "failed", value: "failed" },
  { label: "submitted", value: "submitted" },
  { label: "created", value: "created" },
];

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<PaymentRow[]>([]);
const { first, rows, total, offset, limit, resetPage, onPage } = useServerPagination();

/**
 * Loads payment records with pagination.
 */
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams({
      limit: String(limit()),
      offset: String(offset()),
    });
    if (agentId.value.trim()) params.set("agent_id", agentId.value.trim());
    if (status.value) params.set("status", status.value);
    const res = await apiFetch<{ items: PaymentRow[]; total: number }>(
      `/api/payments?${params}`,
      { token: auth.token },
    );
    items.value = res.items;
    total.value = res.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

/**
 * Resets to page 1 then searches.
 */
function search() {
  resetPage();
  void load();
}

/**
 * @param statusValue - Payment status
 * @returns PrimeVue Tag severity
 */
function severityFor(
  statusValue: string,
): "success" | "danger" | "warn" | "secondary" | "info" {
  if (statusValue === "confirmed") return "success";
  if (statusValue === "failed" || statusValue === "rejected") return "danger";
  if (statusValue === "expired" || statusValue === "cancelled") return "secondary";
  if (statusValue.includes("submit") || statusValue.includes("confirm")) return "info";
  return "warn";
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>支付</h1>
        <p>Agent 支付流水 · 共 {{ total }} 条</p>
      </div>
      <div class="toolbar">
        <InputText v-model="agentId" placeholder="Agent ID" @keyup.enter="search" />
        <Select
          v-model="status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          class="status-select"
        />
        <Button label="搜索" icon="pi pi-search" :loading="loading" @click="search" />
      </div>
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <DataTable
      v-model:first="first"
      v-model:rows="rows"
      show-gridlines
      striped-rows
      lazy
      paginator
      :value="items"
      :loading="loading"
      :total-records="total"
      :rows-per-page-options="[...PAGE_SIZE_OPTIONS]"
      paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
      current-page-report-template="第 {first}-{last} 条，共 {totalRecords} 条"
      @page="onPage($event, load)"
    >
      <Column field="created_at" header="时间" />
      <Column field="status" header="状态">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="severityFor(data.status)" />
        </template>
      </Column>
      <Column field="amount" header="金额" />
      <Column field="asset" header="资产" />
      <Column field="chain" header="链" />
      <Column field="merchant" header="商户" />
      <Column field="recipient" header="收款地址">
        <template #body="{ data }">
          <span class="mono">{{ data.recipient }}</span>
        </template>
      </Column>
      <Column field="agent_id" header="Agent">
        <template #body="{ data }">
          <span class="mono">{{ data.agent_id }}</span>
        </template>
      </Column>
      <Column field="failure_reason" header="失败原因" />
    </DataTable>
  </div>
</template>

<style scoped>
.status-select {
  min-width: 140px;
}
</style>
