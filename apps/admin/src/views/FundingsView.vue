<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import { apiFetch } from "../api/client";
import {
  PAGE_SIZE_OPTIONS,
  useServerPagination,
} from "../composables/use-server-pagination";
import { useAuthStore } from "../stores/auth";

interface FundingRow {
  id: string;
  agent_id: string;
  tx_hash: string;
  from_address: string;
  amount: number | string;
  created_at: string;
}

const auth = useAuthStore();
const agentId = ref("");
const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<FundingRow[]>([]);
const { first, rows, total, offset, limit, resetPage, onPage } = useServerPagination();

/**
 * Loads funding records with pagination.
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
    const res = await apiFetch<{ items: FundingRow[]; total: number }>(
      `/api/fundings?${params}`,
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

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>充值</h1>
        <p>Agent 钱包入金 · 共 {{ total }} 条</p>
      </div>
      <div class="toolbar">
        <InputText v-model="agentId" placeholder="Agent ID" @keyup.enter="search" />
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
      <Column field="amount" header="金额" />
      <Column field="from_address" header="来源">
        <template #body="{ data }">
          <span class="mono">{{ data.from_address }}</span>
        </template>
      </Column>
      <Column field="tx_hash" header="Tx">
        <template #body="{ data }">
          <span class="mono">{{ data.tx_hash }}</span>
        </template>
      </Column>
      <Column field="agent_id" header="Agent">
        <template #body="{ data }">
          <span class="mono">{{ data.agent_id }}</span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
