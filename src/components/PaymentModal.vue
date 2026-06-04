<template>
  <teleport to="body">
    <div class="pay-overlay" @click.self="$emit('close')">
      <div class="pay-modal">
        <!-- Header -->
        <div class="pay-header">
          <h3>{{ t('payment.title') }}</h3>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <!-- Order Info -->
        <div class="pay-info">
          <p class="pay-package">{{ pkg.label }}</p>
          <p class="pay-amount">¥{{ pkg.price }}</p>
          <p class="pay-credits">{{ pkg.credits }} {{ t('home.credits') }}</p>
        </div>

        <!-- Payment Method Tabs -->
        <div class="pay-tabs">
          <button
            class="tab-btn"
            :class="{ active: method === 'wechat' }"
            @click="method = 'wechat'"
          >
            <span class="tab-icon wc">微</span>
            {{ t('payment.wechat') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: method === 'alipay' }"
            @click="method = 'alipay'"
          >
            <span class="tab-icon ap">付</span>
            {{ t('payment.alipay') }}
          </button>
        </div>

        <!-- QR Code Area -->
        <div class="qr-area">
          <div class="qr-frame">
            <!-- Real QR code image -->
            <img
              v-if="qrUrl"
              :src="qrUrl"
              :alt="method === 'wechat' ? 'WeChat QR' : 'Alipay QR'"
              class="qr-img"
            />
            <!-- Placeholder (shown when no QR image uploaded) -->
            <div v-else class="qr-placeholder">
              <div class="qr-demo">
                <div :class="['qr-demo-icon', method]">{{ method === 'wechat' ? '微' : '付' }}</div>
                <p>{{ method === 'wechat' ? 'WeChat Pay' : 'Alipay' }}</p>
                <p class="qr-demo-name">{{ config[method].payeeName || 'Merchant Name' }}</p>
              </div>
            </div>
          </div>
          <p class="qr-tip">{{ t('payment.scanTip', { method: method === 'wechat' ? 'WeChat' : 'Alipay' }) }}</p>
        </div>

        <!-- Manual Info -->
        <div class="manual-info">
          <p v-if="method === 'wechat' && config.wechat.wechatId">
            {{ t('payment.wechatId') }}：<strong>{{ config.wechat.wechatId }}</strong>
            <button class="copy-btn" @click="copyId(config.wechat.wechatId)">{{ t('payment.copy') }}</button>
          </p>
          <p v-if="method === 'alipay' && config.alipay.alipayId">
            {{ t('payment.alipayId') }}：<strong>{{ config.alipay.alipayId }}</strong>
            <button class="copy-btn" @click="copyId(config.alipay.alipayId)">{{ t('payment.copy') }}</button>
          </p>
        </div>

        <!-- Confirm Button -->
        <button
          class="confirm-pay-btn"
          :disabled="isConfirming"
          @click="handleConfirm"
        >
          <template v-if="isConfirming">
            {{ t('payment.confirming') }}...
          </template>
          <template v-else>
            {{ t('payment.iHavePaid') }}
          </template>
        </button>

        <p v-if="!config.requireApproval" class="trust-tip">{{ t('payment.trustTip') }}</p>
        <p v-else class="approval-tip">{{ t('payment.approvalTip') }}</p>

        <!-- Error -->
        <p v-if="errorMsg" class="pay-error">{{ errorMsg }}</p>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPaymentConfig, confirmPayment, createPaymentOrder } from '../services/payment-wechat-ali'
import { useCreditsStore } from '../stores/credits'

const { t } = useI18n()
const credits = useCreditsStore()

const props = defineProps({
  pkg: { type: Object, required: true },
  packageKey: { type: String, required: true },
})

const emit = defineEmits(['close', 'success'])

const method = ref('wechat')
const isConfirming = ref(false)
const errorMsg = ref('')
const config = ref({ wechat: {}, alipay: {} })

const qrUrl = computed(() => {
  const cfg = config.value[method.value]
  if (cfg && cfg.qrImageUrl && cfg.qrImageUrl !== '/wechat-qr.png' && cfg.qrImageUrl !== '/alipay-qr.png') {
    return cfg.qrImageUrl
  }
  return null
})

onMounted(() => {
  config.value = getPaymentConfig()
})

async function handleConfirm() {
  isConfirming.value = true
  errorMsg.value = ''
  try {
    const user = JSON.parse(localStorage.getItem('claw_local_user') || 'null')
    const { orderId } = createPaymentOrder(props.packageKey, props.pkg, method.value, user)
    const result = confirmPayment(orderId, credits)
    if (result.success) {
      if (result.requireApproval) {
        alert(t('payment.waitingApproval'))
      } else {
        alert(t('payment.success', { credits: result.credits }))
      }
      emit('success', result)
      emit('close')
    } else {
      errorMsg.value = result.error || t('payment.error')
    }
  } catch (err) {
    errorMsg.value = err.message || t('payment.error')
  }
  isConfirming.value = false
}

function copyId(id) {
  navigator.clipboard.writeText(id).then(() => {
    alert(t('payment.copied'))
  }).catch(() => {
    const input = document.createElement('input')
    input.value = id
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    alert(t('payment.copied'))
  })
}
</script>

<style scoped>
.pay-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 16px;
}
.pay-modal {
  background: white; border-radius: 16px; width: 100%; max-width: 380px;
  max-height: 90vh; overflow-y: auto; padding: 20px; position: relative;
}
.pay-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.pay-header h3 { font-size: 17px; color: #1f2937; margin: 0; }
.close-btn {
  background: #f3f4f6; border: none; width: 28px; height: 28px;
  border-radius: 50%; font-size: 14px; cursor: pointer; color: #6b7280;
}
/* Package Info */
.pay-info { text-align: center; margin-bottom: 16px; }
.pay-package { font-size: 14px; color: #6b7280; margin: 0 0 4px; }
.pay-amount { font-size: 32px; font-weight: 800; color: #1f2937; margin: 0 0 2px; }
.pay-credits { font-size: 13px; color: #1a56db; margin: 0; }
/* Tabs */
.pay-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab-btn {
  flex: 1; padding: 10px 8px; border: 2px solid #e5e7eb;
  border-radius: 10px; background: white; cursor: pointer;
  font-size: 14px; font-weight: 600; display: flex;
  align-items: center; justify-content: center; gap: 6px;
  transition: all 0.2s;
}
.tab-btn.active { border-color: #1a56db; background: #eff6ff; }
.tab-icon {
  width: 22px; height: 22px; border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  color: white; font-size: 12px; font-weight: 700;
}
.tab-icon.wc { background: #07c160; }
.tab-icon.ap { background: #1677ff; }
/* QR */
.qr-area { text-align: center; margin-bottom: 12px; }
.qr-frame {
  width: 200px; height: 200px; margin: 0 auto 8px;
  border: 2px dashed #d1d5db; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: #f9fafb; overflow: hidden;
}
.qr-img { width: 100%; height: 100%; object-fit: contain; }
.qr-placeholder { color: #9ca3af; }
.qr-demo-icon {
  width: 48px; height: 48px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  color: white; font-size: 20px; font-weight: 700; margin-bottom: 6px;
}
.qr-demo-icon.wechat { background: #07c160; }
.qr-demo-icon.alipay { background: #1677ff; }
.qr-placeholder .qr-demo p { font-size: 12px; margin: 2px 0; color: #6b7280; }
.qr-demo-name { font-weight: 600; color: #374151 !important; }
.qr-tip { font-size: 12px; color: #9ca3af; margin: 0; }
/* Manual */
.manual-info {
  background: #f9fafb; border-radius: 8px; padding: 8px 12px;
  margin-bottom: 12px; font-size: 13px; color: #374151;
}
.manual-info strong { color: #1f2937; }
.copy-btn {
  background: none; border: 1px solid #d1d5db; border-radius: 4px;
  padding: 1px 8px; font-size: 11px; cursor: pointer; color: #6b7280;
  margin-left: 4px;
}
/* Confirm */
.confirm-pay-btn {
  width: 100%; padding: 12px; border: none; border-radius: 10px;
  font-size: 15px; font-weight: 700; cursor: pointer; color: white;
  background: linear-gradient(135deg, #07c160, #06ad56);
  transition: opacity 0.2s;
}
.confirm-pay-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.confirm-pay-btn:not(:disabled):hover { opacity: 0.9; }
.trust-tip { font-size: 11px; color: #22c55e; margin: 6px 0 0; text-align: center; }
.approval-tip { font-size: 11px; color: #f59e0b; margin: 6px 0 0; text-align: center; }
.pay-error { font-size: 12px; color: #ef4444; margin: 6px 0 0; text-align: center; }
</style>
