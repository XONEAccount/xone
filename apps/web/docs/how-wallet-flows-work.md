# X-ONE 消费钱包：登录、子钱包、代付 Gas、AI 对话与 x402

本文说明 `apps/web` + `apps/web-api` 里几条核心链路，并挂上**文件 / 函数 / 行号**，方便对照代码。

---

## 总览

```
登录 (Privy)
  → 自动创建主钱包 (Embedded EOA)
  → 链接到后端 profiles

创建子钱包 (Developer Agent)
  → 服务端生成并密封私钥
  → 返回一次性 API Key

充 USDC 到子钱包
  → 用户签 EIP-3009（不花 ETH）
  → Relayer 代付 gas 上链

AI 对话付费
  → 从前端目录找服务
  → x402：商家返回 402 报价 → Agent 钱包结算
  → 超限额 → 聊天里「仍然支付」确认（仍是 Agent 钱包付，不是主钱包）
```

两个钱包角色：

| 钱包 | 谁创建 | 干什么 |
| --- | --- | --- |
| **主钱包** | Privy Embedded | 登录身份、持有 USDC、给子钱包充值 |
| **子钱包 / Agent** | `web-api` 密封 EOA | AI / MCP / x402 按策略自动花 USDC |

---

## 1. 登录时如何自动生成主钱包

### 1.1 配置：登录时给没有钱包的用户建 Embedded Wallet

入口：`WalletPrivyProvider` 包住整个 App（`App.tsx` 第 36–40 行挂载 `EnsureEmbeddedWallet`）。

```11:39:apps/web/src/web3/privy-provider.tsx
export function WalletPrivyProvider({ children }: { children: ReactNode }) {
  const env = getWebEnv();

  return (
    <PrivyProvider
      appId={env.privyAppId || "missing-privy-app-id"}
      {...(env.privyClientId ? { clientId: env.privyClientId } : {})}
      config={{
        // ...
        loginMethods: ["email", "google", "github", "twitter", "telegram", "wallet"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

含义：邮箱 / Google 等登录后，Privy 尽量自动创建以太坊 Embedded Wallet。

### 1.2 兜底：Headless 登录有时不触发 createOnLogin

邮箱 OTP / OAuth 在部分路径不会自动建钱包，所以有 `EnsureEmbeddedWallet`：认证成功且仍无钱包时，主动调 Privy `createWallet()`。

```14:46:apps/web/src/components/auth/ensure-embedded-wallet.tsx
export function EnsureEmbeddedWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  // ...
  useEffect(() => {
    if (!ready || !authenticated || !user || !walletsReady) return;
    // ...
    if (hasUserWallet || hasConnector) return;

    creatingRef.current = true;
    void createWallet()
      .catch((error) => { /* ignore "already" */ })
      .finally(() => { creatingRef.current = false; });
  }, [ready, authenticated, user, wallets, walletsReady, createWallet]);
```

相关：

| 文件 | 函数 | 作用 |
| --- | --- | --- |
| `apps/web/src/features/auth/sign-in-page.tsx` | `SignInPage` | 登录 UI；有地址后进 `/app` |
| `apps/web/src/hooks/use-wallet-account.ts` | `useWalletAccount` | 选出当前主钱包地址 |
| `apps/web/src/hooks/use-ensure-embedded-wallet.ts` | `ensureEmbeddedWalletAddress` | 创建 Agent 前再确保一次主钱包 |
| `apps/web/src/components/auth/require-wallet.tsx` | `RequireWallet` | 无钱包不能进业务页 |

### 1.3 把地址登记到后端（Supabase profiles）

主钱包**不是**服务端生成的；API 只做「地址 → 应用身份」绑定。

前端 `WalletSessionSync`（有地址后 POST）：

```30:48:apps/web/src/components/auth/wallet-session-sync.tsx
  useEffect(() => {
    if (!authenticated || !address) return;
    // ...
    void apiFetch("/api/auth/link-wallet", {
      method: "POST",
      body: {
        address,
        provider: wallet?.walletClientType ?? "privy",
        chainType: "evm",
      },
    }).catch(/* ... */);
  }, [authenticated, address, userId, wallet?.walletClientType]);
```

后端 `POST /api/auth/link-wallet` → upsert `profiles`：

```11:41:apps/web-api/src/routes/auth.ts
auth.post("/link-wallet", async (c) => {
  // ...
  const address = input.address.toLowerCase();
  const admin = getSupabaseAdmin();
  // ...
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        wallet_address: address,
        display_name: displayName,
        updated_at: now,
      },
      { onConflict: "wallet_address" },
    )
```

```
用户登录
  → Privy createOnLogin / EnsureEmbeddedWallet.createWallet()
  → 得到主钱包 0x…
  → link-wallet → profiles.wallet_address
```

---

## 2. 子钱包（Developer Agent）怎么创建

子钱包 = 给 AI / MCP / x402 用的**受限 USDC 钱包**：私钥只在服务端密封存储，浏览器拿不到。

### 2.1 前端：确保主钱包 → POST 创建

`CreateAgentPage.onCreate`（约 130–172 行）：

```130:166:apps/web/src/features/developers/create-agent-page.tsx
  async function onCreate(event: FormEvent) {
    event.preventDefault();
    // 校验名称、dailyLimit、perTransaction ...
    try {
      const ownerAddress = await ensureEmbeddedWalletAddress();
      const result = await createDeveloperAgent({
        ownerAddress,
        name: trimmed,
        description: "Restricted USDC wallet for MCP / x402 (SDK-aligned)",
        dailyLimit: daily,
        perTransaction: perTx,
        chain,
        currency: "USDC",
        allowedHosts: parseList(allowedHostsText),
        allowedPayees: parseList(allowedPayeesText),
        initialAllowance: 0,
      });
      setAgent(result.agent);
      setStep(2);
```

客户端封装：`apps/web/src/lib/developer-api.ts` → `createDeveloperAgent` → `POST /api/developer/agents`。

### 2.2 后端：生成 EOA、加密私钥、发一次性 API Key

核心：`createDeveloperAgent`（`developer-agent.ts`）：

```247:275:apps/web-api/src/services/agent/developer-agent.ts
  const sealSecret = env.jwtSecret || env.supabaseServiceRoleKey;

  // Always create a dedicated EOA; private key is sealed server-side and never returned.
  <!-- 长度为 32 的 Uint8Array，其中每个元素都是一个 0~255 之间的随机整数 -->
  const privateKey = generatePrivateKeyHex();
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletAddress = account.address.toLowerCase();
  await ensureProfile(admin, walletAddress);

  const apiKey = generateAgentApiKey();
  const apiKeyHash = await hashApiKey(apiKey);
  
  const encryptedPrivateKey = await encryptSecret(privateKey, sealSecret);
  // insert developer_agents { wallet_address, encrypted_private_key, api_key_hash, limits... }
```

| 文件 | 函数 | 作用 |
| --- | --- | --- |
| `apps/web-api/src/lib/crypto.ts` | `generatePrivateKeyHex` / `encryptSecret` / `generateAgentApiKey` | 密钥与加密 |
| `apps/web-api/src/lib/agent-seal.ts` | `unsealAgentPrivateKey` | 支付时临时解密 |
| `apps/web-api/src/routes/developer.ts` | `POST /agents` | HTTP 入口 |
| `packages/schemas` | `createDeveloperAgentSchema` | 入参校验 |

要点：

- 私钥写入 `encrypted_private_key`，**永不返回前端**
- `apiKey`（`xone_…`）只在创建响应里出现一次
- 当前钱包侧 x402 结算限定 **Base Sepolia + USDC**

```
主钱包 owner
  → POST /api/developer/agents
  → 服务端 new EOA + 密封
  → 返回 agent 元数据 + 一次性 apiKey
```

---

## 3. 没有 ETH 也能充 USDC：Relayer 代付 Gas

这里**不是** Privy Smart Account / ERC-4337 Paymaster。  
用的是 Circle USDC 的 **EIP-3009 `TransferWithAuthorization`**：用户只签名，服务器热钱包代付 ETH gas。

### 3.1 用户侧：签授权，不发交易

`buildUsdcTransferTypedData` 构造 EIP-712 消息：

```32:55:apps/web/src/web3/usdc-authorization.ts
export function buildUsdcTransferTypedData(input: {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  // ...
}) {
  const message: UsdcTransferAuthorizationMessage = {
    from: input.from,
    to: input.to,
    value: parseUnits(input.amount.trim(), USDC_DECIMALS),
    // validAfter / validBefore / nonce ...
  };
  return {
    domain: usdcTransferAuthorizationDomain(),
    types: USDC_TRANSFER_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization" as const,
    message,
  };
}
```

充值确认：`onConfirmFundSend`（约 208–268 行）—— Privy `signTypedData` → `fundDeveloperAgentRelay`：

```208:247:apps/web/src/features/developers/create-agent-page.tsx
  async function onConfirmFundSend() {
    // ...
      const typedData = buildUsdcTransferTypedData({
        from: address,
        to: agent.walletAddress as `0x${string}`,
        amount: fundAmount.trim(),
      });
      const { signature } = await signTypedData({ /* EIP-712 */ }, { address, uiOptions: { showWalletUIs: true } });
      const authorization = serializeUsdcAuthorizationMessage(typedData.message);
      const { agent: updated, txHash } = await fundDeveloperAgentRelay(
        agent.id, owner, amount, authorization, signature,
      );
```

用户需要：主钱包里有 **USDC**。  
用户不需要：主钱包里有 **ETH**（gas 由 Relayer 出）。

### 3.2 服务端：Relayer 调 `transferWithAuthorization`

开关：`RELAYER_PRIVATE_KEY` → `isFundRelayEnabled()`（`fund-relay.ts` 第 31–33 行）。

`relayFundDeveloperAgent`：校验签名 / 余额 / 收款地址 → Relayer `writeContract` → 再 `fundDeveloperAgent` 记政策额度：

```160:177:apps/web-api/src/services/agent/fund-relay.ts
  const { v, r, s } = parseSignature(input.signature as Hex);
  const walletClient = getRelayerWalletClient();
  const hash = await walletClient.writeContract({
    address: USDC_CONTRACT_ADDRESS,
    abi: usdcAuthorizationAbi,
    functionName: "transferWithAuthorization",
    args: [from, to, value, validAfter, validBefore, nonce, vByte, r, s],
    chain: baseSepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  // ...
  const updated = await fundDeveloperAgent(admin, agentId, owner, input.amount, hash);
  return { agent: updated, txHash: hash };
```

```
主钱包 USDC
  → 用户签名「允许把 N USDC 转到 Agent」(EIP-3009)
  → POST .../fund/relay
  → Relayer 付 ETH gas，USDC 上链到 Agent
  → 数据库 allowance_eth 增加（策略可用额度）
```

转出同理：`relayWithdrawDeveloperAgent` —— Agent 私钥在服务端签授权，Relayer 仍代付 gas。

列表页「转入 / 转出」同一套：`apps/web/src/features/developers/agents-list-page.tsx`。

---

## 4. AI 对话怎么找到对应服务

对话**不会**在链上或公网爬商家。服务来自前端两个目录（可开关），合并后随消息发给助手。

### 4.1 目录来源

| Store / API | 文件 | 说明 |
| --- | --- | --- |
| X402 List | `apps/web/src/stores/x402-agents.ts` | `fetchServiceCatalog("x402")` |
| Agent List | `apps/web/src/stores/agent-list.ts` | `fetchServiceCatalog("agent")`（如 Bocha） |
| 后端 | `apps/web-api/src/routes/service-catalog.ts` | `GET /api/service-catalog?kind=` |

`ChatPage` 合并已启用项：

```149:157:apps/web/src/features/chat/chat-page.tsx
  const enabledX402 = useMemo(() => {
    const fromX402 = x402Agents.filter((a) => a.enabled);
    const fromAgents = catalogAgents.filter((a) => a.enabled);
    const byId = new Map<string, (typeof fromX402)[number]>();
    for (const row of [...fromX402, ...fromAgents]) {
      byId.set(row.id, row);
    }
    return [...byId.values()];
  }, [x402Agents, catalogAgents]);
```

发消息时塞进 body：

```359:379:apps/web/src/features/chat/chat-page.tsx
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${apiUrl}/api/agents/assistant/chat`,
        // ...
        prepareSendMessagesRequest: ({ id, messages, body, headers, credentials, api }) => ({
          // ...
          body: {
            ...(body ?? {}),
            id,
            messages,
            ownerAddress,
            locale: localeRef.current,
            x402Services: x402Ref.current,
          },
        }),
      }),
```

### 4.2 助手如何选型

`createAssistantChatResponse`（`assistant-chat.ts`）把目录和钱包快照写进 system prompt，并注册工具：

| 工具 | 约行 | 作用 |
| --- | --- | --- |
| `list_context` | 231–243 | 刷新服务 + Agent 余额 / 是否可付 |
| `request_x402_choice` | 248–266 | 多个服务匹配 → 前端点选（HITL） |
| `request_wallet_choice` | 271–288 | 多个可付钱包 → 前端点选 |
| `pay_x402` | 290+ | 对选定服务报价并结算 |

选型规则写在 `buildSystemPrompt`（约 36–66 行）：先 `list_context`；唯一服务可直付；多个必须 `request_x402_choice`；Bocha 必须带 `query`。

```
用户：「世界上有多少人？」
  → 目录里启用了 Bocha Search
  → list_context
  →（必要时）选服务 / 选钱包
  → pay_x402({ x402Id, agentId, query })
```

说明：当前聊天路径**没有**走 A2A 发现商家；A2A 是另一套路由（`/api/a2a`）。

---

## 5. x402 是什么（在本仓库里）

**x402** ≈「HTTP 402 Payment Required」的支付协议：访问付费资源时，商家先回 **402 + 报价**，客户端（这里是 Agent 密封钱包）按报价付款后再拿内容。

### 5.1 报价：只探、不付

`quoteX402Merchant`：

```80:111:apps/web-api/src/services/agent/x402-merchant-pay.ts
export async function quoteX402Merchant(
  merchantUrl: string,
): Promise<X402Quote | null> {
  // GET merchantUrl ...
  if (response.ok) {
    return { amount: 0, /* 免费 */ };
  }
  if (response.status !== 402) return null;
  // 解析 PAYMENT-REQUIRED / accepts[] → 人类可读 USDC 金额
```

### 5.2 结算：Agent 私钥 + x402 SDK

`payX402Merchant`（约 236 行起）：

1. `unsealAgentPrivateKey` 得到签名账户  
2. `x402Client` + `wrapFetchWithPayment` 自动应付 402  
3. 策略：日限额 / allowance / 网络（Base Sepolia）  
4. 成功后写 `agent_payments`，扣 `allowance_eth` / 累加 `spent_amount`

商家示例：`apps/XPayLabs-x402-seller`（`/weather`、`/bocha/search` 等挂 payment middleware）。

```
GET 商家 URL
  → 402 + accepts（金额、收款方、网络）
  → Agent 签支付凭证 / 链上结算
  → 再请求 → 200 + 内容（搜索结果等）
```

另有一条「机器支付」挑战（Agent API Key → `buildX402Challenge` / `executeMachinePayment`），偏内部额度扣减，和聊天里的「外部商家 x402」不同。

---

## 6. 超限额后为何要手动确认（仍不是主钱包付）

### 6.1 什么叫「超限」

`paymentRequiresConfirmation`：报价金额大于 **单笔上限** 或大于 **当日剩余额度** 就需要确认。

```162:175:apps/web-api/src/services/agent/x402-merchant-pay.ts
export function paymentRequiresConfirmation(
  amount: number,
  agent: Pick<
    DeveloperAgent,
    "maxSinglePayment" | "maxAmount" | "spentAmount" | "perTransaction" | "dailyLimit"
  >,
): boolean {
  if (!Number.isFinite(amount) || amount < 0) return true;
  if (amount === 0) return false;
  const perTx = agent.perTransaction ?? agent.maxSinglePayment;
  const daily = agent.dailyLimit ?? agent.maxAmount;
  const remaining = Math.max(0, daily - agent.spentAmount);
  return amount > perTx || amount > remaining;
}
```

挂在 `pay_x402` 的 `needsApproval` 上：

```309:326:apps/web-api/src/services/agent/assistant-chat.ts
      needsApproval: async ({ x402Id, agentId, query }) => {
        const service = enabledServices.find((s) => s.id === x402Id);
        // ...
        const quote = await quoteX402Merchant(merchantUrl);
        if (!quote) return false; // 探价失败不当成「超限」吓用户
        return paymentRequiresConfirmation(quote.amount, agent);
      },
```

### 6.2 聊天里的确认卡

`chat-page.tsx` 约 817–874：工具状态 `approval-requested` 时渲染「确认支付 / 仍然支付 / 取消」。

```817:870:apps/web/src/features/chat/chat-page.tsx
            if (toolName === "pay_x402") {
              // ...
              if (state === "approval-requested" && approval) {
                // 展示钱包名、余额、perTx、当日剩余
                <Button onClick={() => onApprovePay(approval.id, true)}>
                  {t("chat.payAnyway")}
                </Button>
```

用户点「仍然支付」→ `addToolApprovalResponse` → 自动继续 → `pay_x402.execute` → 仍走 **`payX402Merchant`（Agent 密封钱包）**。

### 6.3 容易误解的一点

| 问题 | 答案 |
| --- | --- |
| 超限确认是不是改用主钱包付？ | **不是**。确认后仍是 Agent 钱包结算。 |
| 主钱包在对话里干什么？ | 身份 + 给 Agent 充 USDC；不直接付 x402。 |
| 「仍然支付」能否突破硬上限？ | 不能随意突破。链上/策略里还有 allowance、日总额等硬拦截；`perTransaction` 主要驱动**确认卡**，真正 settle 仍受 `registerPolicy` / 余额约束。 |

```
报价 ≤ perTx 且 ≤ 当日剩余  → 自动 pay_x402
否则                         → 聊天确认卡
用户同意                     → 仍用 Agent EOA 付 x402
```

---

## 7. 关键文件速查

| 主题 | 路径 |
| --- | --- |
| Privy 登录建主钱包 | `apps/web/src/web3/privy-provider.tsx` |
| 兜底 createWallet | `apps/web/src/components/auth/ensure-embedded-wallet.tsx` |
| 链接 profiles | `apps/web/src/components/auth/wallet-session-sync.tsx` + `apps/web-api/src/routes/auth.ts` |
| 创建子钱包 UI | `apps/web/src/features/developers/create-agent-page.tsx` |
| 创建子钱包服务 | `apps/web-api/src/services/agent/developer-agent.ts` → `createDeveloperAgent` |
| EIP-3009 签名 | `apps/web/src/web3/usdc-authorization.ts` |
| Gas Relayer | `apps/web-api/src/services/agent/fund-relay.ts` |
| 聊天页 | `apps/web/src/features/chat/chat-page.tsx` |
| 助手 + tools | `apps/web-api/src/services/agent/assistant-chat.ts` |
| x402 报价/结算 | `apps/web-api/src/services/agent/x402-merchant-pay.ts` |
| 商家 seller | `apps/XPayLabs-x402-seller` |

---

## 8. 一句话记住

1. **登录**：Privy 自动（+ 兜底）建主钱包，再 `link-wallet`。  
2. **子钱包**：服务端密封 EOA + 一次性 API Key。  
3. **无 ETH 充 USDC**：用户签 EIP-3009，Relayer 付 gas。  
4. **找服务**：前端启用目录 → 提示词 + `list_context` / HITL 选择。  
5. **x402**：商家 402 报价 → Agent 钱包结算拿内容。  
6. **超限确认**：人机确认是否继续用 **Agent** 付，不是切到主钱包付。

---

## 9. 深入问答

### 9.1 `embeddedWallets` 是什么？私钥存在哪？

**Embedded Wallet（嵌入式钱包）** 是 Privy 提供的「应用内托管 EOA」：用户用邮箱 / Google 等登录后，Privy 在客户端为其创建一个标准以太坊账户（有地址、能签名），用户不必自己管助记词或装 MetaMask。

配置位置：`WalletPrivyProvider` 里的：

```ts
embeddedWallets: {
  ethereum: {
    createOnLogin: "users-without-wallets", // 登录时若还没有钱包就自动建一个
  },
}
```

和「外部钱包」（用户自己的 MetaMask / WalletConnect）对比：

| | Embedded（本产品默认主钱包） | 外部钱包 |
| --- | --- | --- |
| 谁创建 | Privy 在登录流程里创建 | 用户自己的钱包 |
| UX | 邮箱即可用，几乎无感 | 要连插件 / 扫码 |
| 私钥谁管 | **Privy 托管**（加密分片等，不进我们 DB） | 用户本地 |

**主钱包私钥存放（本仓库不存）：**

- 不在 `apps/web` 的 localStorage 明文里。
- 不在我们的 Supabase `profiles` / `developer_agents` 表里。
- 由 **Privy** 在其基础设施里托管；浏览器通过 Privy SDK（`signTypedData`、发交易等）请求签名。
- 我们只保存 **公开地址**（`link-wallet` → `profiles.wallet_address`）。

**子钱包（Agent）私钥存放（我们服务端密封）：**

- 创建时 `generatePrivateKeyHex()` 在 **web-api 内存里**生成。
- 立刻 `encryptSecret(...)` 后写入 DB 列 `developer_agents.encrypted_private_key`。
- 明文私钥**不返回前端**、不落盘明文；支付时 `unsealAgentPrivateKey` 临时解密 → 签名 → 请求结束后仅留在该次调用的局部变量里（见 §9.1.1）。

```
主钱包私钥  → Privy 托管（我们看不到）
Agent 私钥  → AES-GCM 密文在 Supabase；解密密钥是服务端 JWT_SECRET / SERVICE_ROLE
```

#### 9.1.1 「临时解密」具体怎么做？

「临时」指的是：**不把明文写回数据库 / 不返回给客户端**；只在**单次服务端请求**的内存里解密、用来签名，函数返回后不再持久化。

调用点只有两处：

| 场景 | 文件 | 行为 |
| --- | --- | --- |
| x402 支付 | `x402-merchant-pay.ts` ≈ 319–333 | `unseal` → `privateKeyToAccount` → 交给 x402 `ExactEvmScheme(signer)` 签名结算 |
| 子钱包转出 | `fund-relay.ts` ≈ 222–263 | `unseal` → `signTypedData`（EIP-3009）→ Relayer 广播 |

步骤拆开：

```
1. 从 DB 读出 encrypted_private_key（仍是密文）
2. unsealAgentPrivateKey(密文)
     → agentSealSecrets() 得到 [JWT_SECRET, SERVICE_ROLE…]
     → 对每个 secret 调 decryptSecret（AES-GCM）
     → 成功则返回 0x… 明文私钥字符串
3. privateKeyToAccount(privateKey) 得到可签名的 Account（仍在本请求内存）
4. 用 Account 签名（x402 或 EIP-712）
5. HTTP 响应结束；明文不写盘、不写日志（规范上应避免 console.log 私钥）
```

核心代码（`apps/web-api/src/lib/agent-seal.ts`）：

```23:45:apps/web-api/src/lib/agent-seal.ts
export async function unsealAgentPrivateKey(
  encryptedPrivateKey: string,
): Promise<string> {
  const secrets = agentSealSecrets();
  // ...
  for (const secret of secrets) {
    try {
      return await decryptSecret(encryptedPrivateKey, secret);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(/* 密封密钥不匹配，需重建钱包 */);
}
```

支付路径（`payX402Merchant`）：

```319:336:apps/web-api/src/services/agent/x402-merchant-pay.ts
  let privateKey: `0x${string}`;
  try {
    privateKey = (await unsealAgentPrivateKey(
      agentRow.encrypted_private_key,
    )) as `0x${string}`;
  } catch (err) {
    return { ok: false, status: 400, error: /* ... */ };
  }

  const signer = privateKeyToAccount(privateKey);
  if (signer.address.toLowerCase() !== agent.walletAddress.toLowerCase()) {
    return { ok: false, status: 400, error: "Agent key / address mismatch" };
  }
```

**诚实边界（面试常挖）：**

- 这是 **application-level seal（应用层密封）**，不是 HSM / TEE / MPC。
- JS 字符串无法保证「内存一用完就物理擦除」；「用完即丢」= **无持久化副本 + 作用域随请求结束**，靠 GC，不是 `sodium_memzero` 那种安全清零。
- Worker / 多实例下，每次请求各自解密；`sealSecret` 必须在所有实例一致，否则会 unseal 失败。
- 若进程被 dump、日志误打、或 `JWT_SECRET` 泄露，密文库仍可被解开 —— 安全依赖 **服务端密钥与运行环境**。

---

### 9.1.2 面试可能问什么？（按主题）

**A. 架构与威胁模型**

1. 主钱包和 Agent 钱包私钥分别存在哪？为什么拆开？  
2. 为什么不把 Agent 私钥直接明文存 DB？AES-GCM 防的是什么攻击、防不了什么？  
3. `sealSecret` 用 `JWT_SECRET` 是否合适？轮换密钥后旧钱包怎么办？（本实现：试多个 secret；对不上就重建）  
4. 和 Privy / AWS KMS / 门限签名（MPC）比，这套方案的 trade-off？

**B. 密码学基础**

5. AES-GCM 为什么要随机 IV？IV 复用有什么风险？  
6. 密钥怎么从 passphrase 派生的？（本仓库：`SHA-256(secret)` → AES key，不是 PBKDF2/Argon2）  
7. API Key 为什么存 hash（`hashApiKey`）而私钥存密文？（验证 vs 可逆使用）

**C. 「临时解密」与运行时**

8. 明文私钥生命周期有多长？会不会进日志 / 响应体？  
9. Cloudflare Workers 里解密是否安全？冷启动、多租户内存隔离怎么看？  
10. 如何证明「前端拿不到私钥」？（创建接口不返回 key；支付只在 server 调 unseal）

**D. Relayer / 支付联动**

11. 充值为什么用户不用 ETH？（EIP-3009 + Relayer 付 gas）  
12. Relayer 私钥和 Agent 密封私钥是不是一回事？（不是：Relayer 是热钱包 env；Agent 是每用户密封 EOA）  
13. 转出时为什么要 unseal Agent？（Agent 作为 `from` 签授权；Relayer 只广播）

**E. 产品 / 政策**

14. AI 自动付和超限确认时，签名发生在哪一侧？（始终服务端 Agent 密钥）  
15. 攻击者拿到 spend API Key 能导出私钥吗？（不能导出；最多在策略内发起 pay）

**可用的简洁口述稿：**

> 我们给每个 Agent 在服务端生成 EOA，用 AES-GCM 密封进数据库，密封密钥只在 API 进程环境变量里。需要签名时（x402 或提现），当次请求从 DB 取密文、解密成局部变量、`privateKeyToAccount` 签名，明文不回写、不回传客户端。这不是 HSM，安全边界是服务端密钥与主机；主钱包仍走 Privy，我们碰不到用户主私钥。

---

### 9.2 `encryptSecret(privateKey, sealSecret)` 在干什么？（文档里那一行）

对应实现：`apps/web-api/src/lib/crypto.ts` 的 `encryptSecret` / `decryptSecret` / `deriveAesKey`。

创建 Agent 时关键几步：

```ts
const privateKey = generatePrivateKeyHex();           // 32 字节随机 → 0x… secp256k1 私钥
const account = privateKeyToAccount(privateKey);      // 推出公开地址
const encryptedPrivateKey = await encryptSecret(privateKey, sealSecret);
// 只把 encryptedPrivateKey 写入 developer_agents
```

`encryptSecret` 内部（简化）：

1. **`sealSecret`**：通常是 `JWT_SECRET`，没有则用 `SUPABASE_SERVICE_ROLE_KEY`（见 `createDeveloperAgent` 与 `agentSealSecrets`）。
2. **`deriveAesKey(secret)`**：对 secret 做 SHA-256，得到 32 字节，再 `importKey` 成 **AES-GCM** 密钥。
3. 生成随机 **12 字节 IV**。
4. `crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, privateKey)` 加密明文私钥。
5. 返回字符串：`base64(iv).base64(ciphertext)` —— 这就是 DB 里存的形态。

为什么要这样：

- DB 被拖走时，没有 `sealSecret` 也解不出私钥。
- 前端 / API Key **永远拿不到** Agent 明文私钥；只有持有服务端 secret 的 web-api 在 settle / withdraw 时能 `unsealAgentPrivateKey`。
- `unsealAgentPrivateKey` 会依次尝试 `JWT_SECRET` 和 `SERVICE_ROLE`（兼容历史密封方式）；都失败会提示「换环境重建钱包」。

**注意：** 这是「应用层密封」，不是链上多签。`sealSecret` 泄露 ≈ Agent 私钥可被解出，必须当生产密钥保管。

---

### 9.3 Relayer 原理与怎么用

#### 原理（为什么用户可以没有 ETH）

普通 ERC-20 `transfer`：必须由 **持币地址自己**发交易 → 该地址要有 ETH 付 gas。  
主钱包若只有 USDC、没有 ETH，就转不出去。

Circle USDC 支持 **EIP-3009 `transferWithAuthorization`**：

1. **持币人（主钱包）**只对「允许把 N 枚 USDC 从 from 转到 to」做 **EIP-712 签名**（`signTypedData`），**不上链、不花 gas**。
2. **任何人**（我们的 Relayer）可以拿这份签名，调用 USDC 合约的 `transferWithAuthorization(from, to, value, …, v,r,s)`。
3. **付 gas 的是 Relayer 那个热钱包**（`RELAYER_PRIVATE_KEY` 对应地址），不是用户。
4. 合约校验签名合法 → USDC 从用户主钱包转到 Agent 地址。

所以：用户需要有 **USDC**；**ETH gas 由我们垫**。

```
[用户主钱包] --(只签名 EIP-3009)--> [web-api]
                                       |
                                       v
                              Relayer 发交易 + 付 ETH
                                       |
                                       v
                              USDC 合约 transferWithAuthorization
                                       |
                    主钱包 USDC 减少 ----+----> Agent 地址 USDC 增加
```

代码主路径：`relayFundDeveloperAgent`（`apps/web-api/src/services/agent/fund-relay.ts`）：

1. 校验 `from === owner`、`to === agent.walletAddress`、金额与签名字段一致。  
2. `verifyTypedData` 确认签名确实是主钱包签的。  
3. 查 `authorizationState`（nonce 是否用过）、`balanceOf`（USDC 够不够）。  
4. `getRelayerWalletClient()` → `writeContract(... transferWithAuthorization ...)`。  
5. 等收据成功后 `fundDeveloperAgent(...)`：在 DB 里增加 Agent 的 **政策额度** `allowance_eth`（AI 可花多少还受这个约束）。

转出（Agent → 主钱包）：`relayWithdrawDeveloperAgent` —— 服务端 `unseal` Agent 私钥代签 EIP-3009，仍由 Relayer 广播并付 gas。

#### 使用方式（运维 + 产品）

| 步骤 | 做什么 |
| --- | --- |
| 配置 | `apps/web-api` 环境变量 `RELAYER_PRIVATE_KEY=0x…`（64 hex） |
| 充 ETH | 给该私钥对应地址在 **Base Sepolia** 充测试 ETH（只付 gas，不碰用户 USDC） |
| 开关 | `isFundRelayEnabled()`：key 合法才开放代付；前端会先查 `GET /api/developer/fund-relay/status` |
| 用户操作 | 创建 Agent 后「转入」→ 确认金额 → Privy 弹出签 EIP-712 → 后端 relay |
| 限制 | 当前仅 **base-sepolia + USDC** Agent；额度不能把 `allowance` 推过 `dailyLimit` |

Relayer **不是**：

- 不是 Privy Smart Account / ERC-4337 Paymaster  
- 不会「替用户付 USDC」—— USDC 仍从用户主钱包扣  
- 私钥在服务端 env，属于热钱包，要限额、监控、勿提交到 git

---

### 9.4 `new DefaultChatTransport({...})` 是干什么的？

来自 Vercel AI SDK（`@ai-sdk/react` / `ai`），是 **`useChat` 的传输层**：规定「浏览器怎么把对话消息发到后端流式接口」。

在 `chat-page.tsx` 里大致是：

```ts
const transport = useMemo(
  () =>
    new DefaultChatTransport({
      api: `${apiUrl}/api/agents/assistant/chat`,  // POST 目标
      headers: { Authorization: "Bearer demo" },
      body: { ownerAddress, locale },
      prepareSendMessagesRequest: ({ id, messages, body, ... }) => ({
        // 每次发送前拼装最终 HTTP body
        body: {
          ...body,
          id,
          messages,
          ownerAddress,
          locale: localeRef.current,
          x402Services: x402Ref.current, // 当前启用的服务目录
        },
      }),
    }),
  [apiUrl, ownerAddress, locale],
);

useChat({ transport, messages: initialMessages, ... });
```

它负责的事：

1. **HTTP 通道**：`sendMessage` 时 POST 到 `api`，处理流式响应（SSE / UIMessage stream）。  
2. **把前端状态带给助手**：尤其是 `x402Services`（启用的商家目录）和 `ownerAddress`（查哪些 Agent 钱包）。  
3. **和 `useChat` 解耦**：UI 只管消息列表；「打到哪、带什么头、怎么改 body」都在 Transport 里。

它**不负责**：

- 选哪个 x402 服务、怎么付（那是后端 `assistant-chat` 的 tools）  
- 存私钥、Relayer、链上交易  

一句话：**DefaultChatTransport = 聊天前端 ↔ `/api/agents/assistant/chat` 的默认 HTTP 传输器**，外加我们自定义的「每次请求附带目录与钱包身份」。
