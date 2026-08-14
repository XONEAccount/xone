<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Message from "primevue/message";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const localError = ref<string | null>(null);

/**
 * Submits the admin login form.
 */
async function onSubmit() {
  localError.value = null;
  if (!username.value.trim() || !password.value) {
    localError.value = "请输入账号和密码";
    return;
  }
  try {
    await auth.login(username.value.trim(), password.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
    await router.replace(redirect);
  } catch (e) {
    localError.value = e instanceof Error ? e.message : "登录失败";
  }
}
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="onSubmit">
      <div class="brand">Xone Admin</div>
      <p class="hint">运营控制台 · 独立 Admin API</p>

      <label class="field">
        <span>账号</span>
        <InputText
          v-model="username"
          fluid
          autocomplete="username"
          placeholder="管理员账号"
        />
      </label>

      <label class="field">
        <span>密码</span>
        <Password
          v-model="password"
          :feedback="false"
          toggle-mask
          fluid
          autocomplete="current-password"
          placeholder="管理员密码"
          input-class="password-input"
        />
      </label>

      <Message v-if="localError || auth.error" severity="error" :closable="false">
        {{ localError || auth.error }}
      </Message>

      <Button
        type="submit"
        label="登录"
        icon="pi pi-sign-in"
        fluid
        :loading="auth.loading"
      />
    </form>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background:
    radial-gradient(circle at top left, #e4e4e7 0, transparent 40%),
    #f4f4f5;
}

.card {
  width: min(100%, 380px);
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 12px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.brand {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.hint {
  margin: -0.35rem 0 0;
  color: #71717a;
  font-size: 0.9rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #52525b;
}

/* Keep the eye toggle inside the password field */
.field :deep(.p-password) {
  position: relative;
  display: block;
  width: 100%;
}

.field :deep(.p-password-input),
.field :deep(.password-input) {
  width: 100%;
  padding-inline-end: 2.75rem;
}

.field :deep(.p-password-toggle-mask-icon) {
  position: absolute;
  top: 50%;
  inset-inline-end: 0.75rem;
  transform: translateY(-50%);
  margin: 0;
  cursor: pointer;
  z-index: 2;
  color: #71717a;
}

.field :deep(.p-password-toggle-mask-icon:hover) {
  color: #18181b;
}
</style>
