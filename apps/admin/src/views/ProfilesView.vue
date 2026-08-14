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

interface ProfileRow {
  wallet_address: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

const auth = useAuthStore();
const q = ref("");
const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<ProfileRow[]>([]);
const { first, rows, total, offset, limit, resetPage, onPage } = useServerPagination();

/**
 * Fetches profile list with optional search and pagination.
 */
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams({
      limit: String(limit()),
      offset: String(offset()),
    });
    if (q.value.trim()) params.set("q", q.value.trim());
    const res = await apiFetch<{ items: ProfileRow[]; total: number }>(
      `/api/profiles?${params}`,
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
        <h1>用户</h1>
        <p>钱包 Profiles · 共 {{ total }} 条</p>
      </div>
      <div class="toolbar">
        <InputText v-model="q" placeholder="搜索地址 / 名称" @keyup.enter="search" />
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
      <Column field="display_name" header="显示名" />
      <Column field="wallet_address" header="钱包地址">
        <template #body="{ data }">
          <span class="mono">{{ data.wallet_address }}</span>
        </template>
      </Column>
      <Column field="created_at" header="创建时间" />
      <Column field="updated_at" header="更新时间" />
    </DataTable>
  </div>
</template>
