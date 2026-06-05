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
          <button class="tab-btn" :class="{ active: method === 'wechat' }" @click="method = 'wechat'">
            <span class="tab-icon wc">微</span>{{ t('payment.wechat') }}
          </button>
          <button class="tab-btn" :class="{ active: method === 'alipay' }" @click="method = 'alipay'">
            <span class="tab-icon ap">付</span>{{ t('payment.alipay') }}
          </button>
        </div>

        <!-- QR Code Area -->
        <div class="qr-area">
          <div class="qr-frame">
            <img v-if="qrUrl" :src="qrUrl" class="qr-img" />
            <div v-else class="qr-placeholder">
              <div :class="['qr-demo-icon', method]">{{ method === 'wechat' ? '微' : '付' }}</div>
              <p>{{ method === 'wechat' ? 'WeChat Pay' : 'Alipay' }}</p>
              <p class="qr-demo-name">{{ config[method].payeeName || 'Merchant Name' }}</p>
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

        <!-- 支付凭证上传 -->
        <div class="proof-section">
          <p class="proof-label">{{ t('payment.proofLabel') || 'Upload Payment Screenshot' }}</p>
          <div class="proof-upload" @click="triggerFileInput">
            <input ref="fileInputRef" type="file" accept="image/*" style="display:none" @change="handleFileChange" />
            <div v-if="proofPreview" class="proof-preview">
              <img :src="proofPreview" alt="proof" />
              <button class="proof-remove" @click.stop="removeProof">✕</button>
            </div>
            <div v-else class="proof-placeholder">
              <span style="font-size:28px">📷</span>
              <span>{{ t('payment.tapToUpload') || 'Tap to upload' }}</span>
            </div>
          </div>
        </div>

        <!-- Confirm Button -->
        <button class="confirm-pay-btn" :disabled="isConfirming || !proofPreview" @click="handleConfirm">
          <template v-if="isConfirming">{{ t('payment.confirming') }}...</template>
          <template v-else>{{ t('payment.iHavePaid') }}</template>
        </button>
        <p v-if="!proofPreview" class="proof-hint">{{ t('payment.proofHint') || 'Upload proof before confirming' }}</p>

        <!-- Messages -->
        <p v-if="successMsg" class="pay-success">{{ successMsg }}</p>
        <p v-if="errorMsg" class="pay-error">{{ errorMsg }}</p>
        <p v-if="!successMsg && !config.autoApprove" class="approval-tip">{{ t('payment.approvalTip') || 'Admin will review within 24h' }}</p>

      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPaymentConfig, createPaymentOrder, uploadProof } from '../services/payment-wechat-ali'
import { useCreditsStore } from '../stores/credits'

const { t } = useI18n()
const credits = useCreditsStore()

const props = defineProps({
  pkg:        { type: Object, required: true },
  packageKey: { type: String, required: true },
})
const emit = defineEmits(['close', 'success'])

const method       = ref('wechat')
const isConfirming = ref(false)
const errorMsg     = ref('')
const successMsg   = ref('')
const config       = ref({ wechat: {}, alipay: {} })
const proofPreview = ref(null)
const proofB64     = ref('')
const fileInputRef = ref(null)
const currentOrderId = ref('')

const qrUrl = computed(() => {
  const cfg = config.value[method.value]
  if (cfg && cfg.qrImageUrl && cfg.qrImageUrl !== '/wechat-qr.png' && cfg.qrImageUrl !== '/alipay-qr.png') {
    return cfg.qrImageUrl
  }
  return null
})

onMounted(() => {
  config.value = getPaymentConfig()
  // 打开弹窗时立即创建订单
  const user = JSON.parse(localStorage.getItem('claw_local_user') || 'null')
  const { orderId } = createPaymentOrder(props.packageKey, props.pkg, method.value, user)
  currentOrderId.value = orderId
})

function triggerFileInput() { fileInputRef.value?.click() }

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    errorMsg.value = 'File too large (max 5MB)'
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    proofPreview.value = ev.target.result
    // 压缩图片避免 localStorage 爆掉
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width, h = img.height
      const MAX = 800
      if (w > MAX) { h = h * MAX / w; w = MAX }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      proofB64.value = canvas.toDataURL('image/jpeg', 0.6)
    }
    img.src = ev.target.result
    proofB64.value = ev.target.result
  }
  reader.readAsDataURL(file)
}

function removeProof() {
  proofPreview.value = null
  proofB64.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function handleConfirm() {
  if (!proofPreview.value) {
    errorMsg.value = t('payment.proofRequired') || 'Please upload payment proof'
    return
  }
  isConfirming.value = true
  errorMsg.value = ''
  try {
    const result = uploadProof(currentOrderId.value, proofB64.value || proofPreview.value)
    if (result.success) {
      if (result.credits > 0) {
        successMsg.value = t('payment.success', { credits: result.credits }) || `Success! ${result.credits} credits added.`
      } else {
        successMsg.value = t('payment.waitingApproval') || 'Submitted. Waiting for admin approval.'
      }
      setTimeout(() => { emit('success', result); emit('close') }, 1500)
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
    alert(t('payment.copied') || 'Copied!')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = id
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    alert(t('payment.copied') || 'Copied!')
  })
}
</script>

<style scoped>
.pay-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; }
.pay-modal { background:white; border-radius:16px; width:100%; max-width:380px; max-height:90vh; overflow-y:auto; padding:20px; position:relative; }
.pay-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.pay-header h3 { font-size:17px; color:#1f2937; margin:0; }
.close-btn { background:#f3f4f6; border:none; width:28px; height:28px; border-radius:50%; font-size:14px; cursor:pointer; color:#6b7280; }

.pay-info { text-align:center; margin-bottom:16px; }
.pay-package { font-size:14px; color:#6b7280; margin:0 0 4px; }
.pay-amount { font-size:32px; font-weight:800; color:#1f2937; margin:0 0 2px; }
.pay-credits { font-size:13px; color:#1a56db; margin:0; }

.pay-tabs { display:flex; gap:8px; margin-bottom:16px; }
.tab-btn { flex:1; padding:10px 8px; border:2px solid #e5e7eb; border-radius:10px; background:white; cursor:pointer; font-size:14px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s; }
.tab-btn.active { border-color:#1a56db; background:#eff6ff; }
.tab-icon { width:22px; height:22px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:700; }
.tab-icon.wc { background:#07c160; }
.tab-icon.ap { background:#1677ff; }

.qr-area { text-align:center; margin-bottom:12px; }
.qr-frame { width:200px; height:200px; margin:0 auto 8px; border:2px dashed #d1d5db; border-radius:12px; display:flex; align-items:center; justify-content:center; background:#f9fafb; overflow:hidden; }
.qr-img { width:100%; height:100%; object-fit:contain; }
.qr-placeholder { color:#9ca3af; }
.qr-demo-icon { width:48px; height:48px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; color:white; font-size:20px; font-weight:700; margin-bottom:6px; }
.qr-demo-icon.wechat { background:#07c160; }
.qr-demo-icon.alipay { background:#1677ff; }
.qr-placeholder p { font-size:12px; margin:2px 0; color:#6b7280; }
.qr-demo-name { font-weight:600; color:#374151 !important; }
.qr-tip { font-size:12px; color:#9ca3af; margin:0; }

.manual-info { background:#f9fafb; border-radius:8px; padding:8px 12px; margin-bottom:12px; font-size:13px; color:#374151; }
.manual-info strong { color:#1f2937; }
.copy-btn { background:none; border:1px solid #d1d5db; border-radius:4px; padding:1px 8px; font-size:11px; cursor:pointer; color:#6b7280; margin-left:4px; }

/* 凭证上传 */
.proof-section { margin-bottom:12px; }
.proof-label { font-size:13px; font-weight:600; color:#374151; margin:0 0 6px; }
.proof-upload { border:2px dashed #d1d5db; border-radius:10px; min-height:100px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; background:#f9fafb; transition:border-color 0.2s; }
.proof-upload:hover { border-color:#1a56db; }
.proof-preview { position:relative; width:100%; }
.proof-preview img { width:100%; display:block; border-radius:8px; }
.proof-remove { position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:24px; height:24px; font-size:12px; cursor:pointer; }
.proof-placeholder { color:#9ca3af; font-size:13px; display:flex; flex-direction:column; align-items:center; gap:4px; }

.proof-hint { font-size:11px; color:#f59e0b; margin:4px 0 0; text-align:center; }
.pay-success { font-size:13px; color:#22c55e; margin:8px 0 0; text-align:center; font-weight:600; }
.pay-error { font-size:12px; color:#ef4444; margin:6px 0 0; text-align:center; }
.approval-tip { font-size:11px; color:#f59e0b; margin:6px 0 0; text-align:center; }

.confirm-pay-btn { width:100%; padding:12px; border:none; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; color:white; background:linear-gradient(135deg, #07c160, #06ad56); transition:opacity 0.2s; }
.confirm-pay-btn:disabled { opacity:0.6; cursor:not-allowed; }
.confirm-pay-btn:not(:disabled):hover { opacity:0.9; }
</style>
