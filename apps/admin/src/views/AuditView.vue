<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Message from "primevue/message";
import { apiFetch } from "../api/client";
import {
  PAGE_SIZE_OPTIONS,
  useServerPagination,
} from "../composables/use-server-pagination";
import { useAuthStore } from "../stores/auth";

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const auth = useAuthStore();
const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<AuditRow[]>([]);
const { first, rows, total, offset, limit, resetPage, onPage } = useServerPagination();

/**
 * Loads admin audit logs with pagination.
 */
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams({
      limit: String(limit()),
      offset: String(offset()),
    });
    const res = await apiFetch<{ items: AuditRow[]; total: number }>(
      `/api/audit?${params}`,
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
 * Resets to page 1 then reloads.
 */
function refresh() {
  resetPage();
  void load();
}

/**
 * Pretty-prints metadata for the table.
 * @param metadata - Audit metadata object
 * @returns Compact JSON string
 */
function metaText(metadata: Record<string, unknown>): string {
  try {
    return JSON.stringify(metadata);
  } catch {
    return "";
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
        <h1>审计</h1>
        <p>Admin 操作日志 · 共 {{ total }} 条</p>
      </div>
      <div class="toolbar">
        <Button label="刷新" icon="pi pi-refresh" :loading="loading" @click="refresh" />
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
      <Column field="actor" header="操作者" />
      <Column field="action" header="动作" />
      <Column field="target_type" header="目标类型" />
      <Column field="target_id" header="目标 ID">
        <template #body="{ data }">
          <span class="mono">{{ data.target_id }}</span>
        </template>
      </Column>
      <Column header="元数据">
        <template #body="{ data }">
          <span class="mono">{{ metaText(data.metadata) }}</span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
