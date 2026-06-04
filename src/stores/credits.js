import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCreditsStore = defineStore('credits', () => {
  const balance = ref(500)  // 新用户赠送500积分
  const totalRecharged = ref(0)
  const totalUsed = ref(0)

  // 使用记录
  const usageLogs = ref([
    { id: 1, action: 'New user registration', credits: 500, time: Date.now() - 86400000, type: 'reward' },
    { id: 2, action: 'AI Email - John Smith (ABC Corp)', credits: -5, time: Date.now() - 3600000, type: 'use' },
    { id: 3, action: 'Client Analysis - German Machinery Buyer', credits: -10, time: Date.now() - 1800000, type: 'use' },
  ])

  const formattedBalance = computed(() => balance.value.toLocaleString())

  // 积分价格配置（积分/元）
  function getPricePerCredit() {
    return {
      trial:   { price: 9.9,  credits: 100 },   // 体验包
      basic:   { price: 49,  credits: 600 },     // 标准包
      pro:     { price: 99,  credits: 1500 },    // 专业包
      premium: { price: 199, credits: 3500 },    // 企业包
    }
  }

  // 扣除积分
  function deduct(amount, action) {
    if (balance.value < amount) {
      return { success: false, message: 'Insufficient credits, please recharge' }
    }
    balance.value -= amount
    totalUsed.value += amount
    usageLogs.value.unshift({
      id: Date.now(),
      action,
      credits: -amount,
      time: Date.now(),
      type: 'use'
    })
    return { success: true }
  }

  // 充值（模拟）
  function recharge(pkgKey) {
    const pkg = getPricePerCredit()[pkgKey]
    if (!pkg) return false
    balance.value += pkg.credits
    totalRecharged.value += pkg.credits
    usageLogs.value.unshift({
      id: Date.now(),
      action: `Recharge - ${pkg.credits} credits`,
      credits: pkg.credits,
      time: Date.now(),
      type: 'recharge'
    })
    return true
  }

  // 检查余额是否足够
  function canAfford(amount) {
    return balance.value >= amount
  }

  return {
    balance,
    totalRecharged,
    totalUsed,
    usageLogs,
    formattedBalance,
    getPricePerCredit,
    deduct,
    recharge,
    canAfford,
  }
})
