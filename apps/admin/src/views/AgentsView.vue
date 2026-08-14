<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { apiFetch } from "../api/client";
import {
  PAGE_SIZE_OPTIONS,
  useServerPagination,
} from "../composables/use-server-pagination";
import { useAuthStore } from "../stores/auth";

interface AgentRow {
  id: string;
  owner_wallet: string;
  name: string;
  description: string;
  api_key_prefix: string;
  wallet_address: string;
  max_amount: number | string;
  max_single_payment: number | string;
  spent_amount: number | string;
  allowance_eth: number | string;
  asset: string;
  chain: string;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
}

const auth = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const q = ref("");
const status = ref<string | null>(null);
const statusOptions = [
  { label: "全部状态", value: null },
  { label: "active", value: "active" },
  { label: "disabled", value: "disabled" },
];

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<AgentRow[]>([]);
const { first, rows, total, offset, limit, resetPage, onPage } = useServerPagination();

const editVisible = ref(false);
const saving = ref(false);
const editing = ref<AgentRow | null>(null);
const form = ref({
  name: "",
  description: "",
  status: "active" as "active" | "disabled",
  maxAmount: 0,
  maxSinglePayment: 0,
});

/**
 * Loads agents with filters and pagination.
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
    if (status.value) params.set("status", status.value);
    const res = await apiFetch<{ items: AgentRow[]; total: number }>(
      `/api/agents?${params}`,
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
 * Opens the edit dialog for an agent.
 * @param row - Agent row
 */
function openEdit(row: AgentRow) {
  editing.value = row;
  form.value = {
    name: row.name,
    description: row.description ?? "",
    status: row.status,
    maxAmount: Number(row.max_amount),
    maxSinglePayment: Number(row.max_single_payment),
  };
  editVisible.value = true;
}

/**
 * Saves agent policy updates.
 */
async function saveEdit() {
  if (!editing.value) return;
  saving.value = true;
  try {
    await apiFetch(`/api/agents/${editing.value.id}`, {
      method: "PATCH",
      token: auth.token,
      body: JSON.stringify({
        name: form.value.name,
        description: form.value.description,
        status: form.value.status,
        maxAmount: form.value.maxAmount,
        maxSinglePayment: form.value.maxSinglePayment,
      }),
    });
    toast.add({ severity: "success", summary: "已保存", life: 2000 });
    editVisible.value = false;
    await load();
  } catch (e) {
    toast.add({
      severity: "error",
      summary: e instanceof Error ? e.message : "保存失败",
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
}

/**
 * Disables an agent.
 * @param row - Agent row
 */
function disableAgent(row: AgentRow) {
  confirm.require({
    message: `确认禁用 Agent「${row.name}」？`,
    header: "禁用 Agent",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "禁用",
    rejectLabel: "取消",
    acceptClass: "p-button-danger",
    accept: () => {
      void (async () => {
        try {
          await apiFetch(`/api/agents/${row.id}`, {
            method: "PATCH",
            token: auth.token,
            body: JSON.stringify({ status: "disabled" }),
          });
          toast.add({ severity: "success", summary: "已禁用", life: 2000 });
          await load();
        } catch (e) {
          toast.add({
            severity: "error",
            summary: e instanceof Error ? e.message : "操作失败",
            life: 3000,
          });
        }
      })();
    },
  });
}

/**
 * Revokes API key and disables the agent. Never shows a private key.
 * @param row - Agent row
 */
function revokeKey(row: AgentRow) {
  confirm.require({
    message: `将作废当前 API Key 并禁用「${row.name}」。私钥不会在后台展示。`,
    header: "吊销 API Key",
    icon: "pi pi-ban",
    acceptLabel: "吊销",
    rejectLabel: "取消",
    acceptClass: "p-button-danger",
    accept: () => {
      void (async () => {
        try {
          await apiFetch(`/api/agents/${row.id}/revoke-key`, {
            method: "POST",
            token: auth.token,
          });
          toast.add({ severity: "success", summary: "API Key 已吊销", life: 2500 });
          await load();
        } catch (e) {
          toast.add({
            severity: "error",
            summary: e instanceof Error ? e.message : "操作失败",
            life: 3000,
          });
        }
      })();
    },
  });
}

/**
 * Shortens an address for table display.
 * @param address - Wallet address
 * @returns Short label
 */
function shortAddr(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Agents</h1>
        <p>全站 Agent · 共 {{ total }} 条 · 不展示私钥 / 完整 API Key</p>
      </div>
      <div class="toolbar">
        <InputText v-model="q" placeholder="名称 / 地址 / key prefix" @keyup.enter="search" />
        <Select
          v-model="status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          placeholder="状态"
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
      <Column field="name" header="名称" />
      <Column field="status" header="状态">
        <template #body="{ data }">
          <Tag
            :value="data.status"
            :severity="data.status === 'active' ? 'success' : 'secondary'"
          />
        </template>
      </Column>
      <Column field="owner_wallet" header="Owner">
        <template #body="{ data }">
          <span class="mono" :title="data.owner_wallet">{{ shortAddr(data.owner_wallet) }}</span>
        </template>
      </Column>
      <Column field="wallet_address" header="Agent 钱包">
        <template #body="{ data }">
          <span class="mono" :title="data.wallet_address">{{ shortAddr(data.wallet_address) }}</span>
        </template>
      </Column>
      <Column field="api_key_prefix" header="Key 前缀">
        <template #body="{ data }">
          <span class="mono">{{ data.api_key_prefix }}</span>
        </template>
      </Column>
      <Column field="max_single_payment" header="单笔上限" />
      <Column field="max_amount" header="总额度" />
      <Column field="spent_amount" header="已花费" />
      <Column field="asset" header="资产" />
      <Column field="chain" header="链" />
      <Column header="操作" style="min-width: 220px">
        <template #body="{ data }">
          <div class="actions">
            <Button label="修改" size="small" text @click="openEdit(data)" />
            <Button
              label="禁用"
              size="small"
              text
              severity="warn"
              :disabled="data.status === 'disabled'"
              @click="disableAgent(data)"
            />
            <Button
              label="吊销 Key"
              size="small"
              text
              severity="danger"
              @click="revokeKey(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="editVisible"
      modal
      header="修改 Agent"
      :style="{ width: 'min(100%, 480px)' }"
    >
      <div class="form">
        <label>
          <span>名称</span>
          <InputText v-model="form.name" class="w-full" />
        </label>
        <label>
          <span>描述</span>
          <Textarea v-model="form.description" rows="3" class="w-full" auto-resize />
        </label>
        <label>
          <span>状态</span>
          <Select
            v-model="form.status"
            :options="[
              { label: 'active', value: 'active' },
              { label: 'disabled', value: 'disabled' },
            ]"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </label>
        <label>
          <span>总额度</span>
          <InputNumber v-model="form.maxAmount" class="w-full" :min-fraction-digits="0" :max-fraction-digits="8" />
        </label>
        <label>
          <span>单笔上限</span>
          <InputNumber
            v-model="form.maxSinglePayment"
            class="w-full"
            :min-fraction-digits="0"
            :max-fraction-digits="8"
          />
        </label>
      </div>
      <template #footer>
        <Button label="取消" text severity="secondary" @click="editVisible = false" />
        <Button label="保存" :loading="saving" @click="saveEdit" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.surface {
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  overflow: hidden;
}

.status-select {
  min-width: 140px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #52525b;
}

.w-full {
  width: 100%;
}
</style>
