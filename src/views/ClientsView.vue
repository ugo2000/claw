<template>
  <div class="clients-page">
    <!-- Header -->
    <div class="page-header">
      <h1>{{ $t('clients.title') }}</h1>
      <div class="header-actions">
        <button class="import-btn" @click="showImport = true">{{ $t('clients.importBtn') }}</button>
        <button class="add-btn" @click="showAdd = true">{{ $t('clients.addClient') }}</button>
      </div>
    </div>

    <!-- Stats -->
    <p class="total-count">{{ $t('clients.totalClients', { count: clients.length }) }}</p>

    <!-- Filters -->
    <div class="filters">
      <button
        v-for="f in filterOptions"
        :key="f.value"
        class="filter-chip"
        :class="{ active: activeFilter === f.value }"
        @click="activeFilter = f.value"
      >{{ f.label }}</button>
    </div>

    <!-- Client List -->
    <div v-if="filteredClients.length" class="client-list">
      <div v-for="(client, index) in filteredClients" :key="index" class="client-card">
        <div class="client-top">
          <h3>{{ client.company || client.name || 'Unnamed' }}</h3>
          <span :class="['status-badge', `status-${client.status || 'new'}`]">{{ statusLabel(client.status) }}</span>
        </div>
        <div class="client-info">
          <p v-if="client.contactName"><strong>Contact:</strong> {{ client.contactName }}</p>
          <p v-if="client.email">
            <strong>Email:</strong>
            <template v-if="isClientEmailValid(client.email)">
              <a :href="'mailto:' + encodeURIComponent(client.email)">{{ client.email }}</a>
            </template>
            <template v-else>
              <span class="invalid-email">{{ client.email }} <small>(invalid)</small></span>
            </template>
          </p>
          <p v-if="client.website">
            <strong>Website:</strong>
            <a
              v-if="isClientWebsiteValid(client.website)"
              :href="normalizeClientUrl(client.website)"
              target="_blank"
              rel="noopener noreferrer"
              class="website-link"
            >{{ client.website }}</a>
            <span v-else class="invalid-url">{{ client.website }} <small>(invalid)</small></span>
          </p>
          <p v-if="client.phone"><strong>Phone:</strong> {{ client.phone }}</p>
          <p v-if="client.country"><strong>Country:</strong> {{ client.country }}</p>
          <p v-if="client.notes" class="notes">{{ client.notes }}</p>
        </div>
        <div class="client-actions">
          <router-link
            :to="{ path: '/email', query: { company: client.company || client.name } }"
            custom
            v-slot="{ navigate }"
          >
            <button @click="navigate" class="email-action">{{ $t('clients.sendEmail') }}</button>
          </router-link>
          <button class="delete-action" @click="deleteClient(index)">&#128465;</button>
        </div>
      </div>
    </div>
    <div v-else class="empty-state">
      <p>{{ $t('clients.emptyState') }}</p>
    </div>

    <!-- Import Modal -->
    <div v-if="showImport" class="modal-overlay" @click="showImport = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('clients.importModalTitle') }}</h3>
          <button class="close-btn" @click="showImport = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="dropzone" @dragover.prevent @drop.prevent="handleFileDrop" @click="$refs.fileInput.click()">
            <input ref="fileInput" type="file" accept=".csv,.xlsx,.xls" hidden @change="handleFileSelect" />
            <p>{{ $t('clients.dragDrop') }}</p>
            <p class="hint">{{ $t('clients.supportedFormats') }}</p>
          </div>
          <button
            class="upload-btn"
            :disabled="!selectedFile || isImporting"
            @click="doImport"
          >{{ isImporting ? $t('clients.importing') + '...' : $t('clients.selectFile') }}</button>
          <p v-if="importResult" class="import-result">{{ importResult }}</p>
        </div>
        <div class="modal-footer">
          <button class="action-sm primary" @click="showImport = false">{{ $t('clients.close') }}</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAdd" class="modal-overlay" @click="closeAdd">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingIndex >= 0 ? $t('clients.editClient') : $t('clients.newClientTitle') }}</h3>
          <button class="close-btn" @click="closeAdd">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ $t('clients.clientCompany') }}</label>
            <input v-model="editForm.company" type="text" :placeholder="$t('clients.clientCompany')" />
          </div>
          <div class="form-group">
            <label>{{ $t('clients.clientContact') }}</label>
            <input v-model="editForm.contactName" type="text" :placeholder="$t('clients.clientContact')" />
          </div>
          <div class="form-group">
            <label>{{ $t('clients.clientEmail') }}</label>
            <input
              v-model="editForm.email"
              type="email"
              :placeholder="$t('clients.clientEmail')"
              @blur="validateEmailInput"
            />
            <span v-if="emailError" class="field-error">{{ emailError }}</span>
          </div>
          <div class="form-group">
            <label>{{ $t('clients.clientPhone') }}</label>
            <input v-model="editForm.phone" type="tel" :placeholder="$t('clients.clientPhone')" />
          </div>
          <div class="form-group">
            <label>{{ $t('clients.clientCountry') }}</label>
            <input v-model="editForm.country" type="text" :placeholder="$t('clients.clientCountry')" />
          </div>
          <div class="form-group">
            <label>Website</label>
            <input
              v-model="editForm.website"
              type="url"
              placeholder="https://www.example.com"
              @blur="validateWebsiteInput"
            />
            <span v-if="websiteError" class="field-error">{{ websiteError }}</span>
          </div>
          <div class="form-group">
            <label>{{ $t('clients.clientNotes') }}</label>
            <textarea v-model="editForm.notes" rows="2" :placeholder="$t('clients.clientNotes')"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-sm" @click="closeAdd">{{ $t('clients.cancelBtn') }}</button>
          <button class="action-sm primary" @click="saveClient">{{ $t('clients.saveBtn') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import Papa from 'papaparse'
import { isValidUrl, isValidEmail, normalizeUrl } from '../utils/validators'

const showImport = ref(false)
const showAdd = ref(false)
const editingIndex = ref(-1)
const selectedFile = ref(null)
const isImporting = ref(false)
const importResult = ref('')
const activeFilter = ref('all')
const clients = ref([])

const editForm = reactive({
  company: '', contactName: '', email: '', phone: '', country: '', website: '', notes: '',
})

const emailError = ref('')
const websiteError = ref('')

const { t } = { t: (k) => k }

const filterOptions = computed(() => [
  { label: t('clients.filterAll'), value: 'all' },
  { label: t('clients.filterNew'), value: 'new' },
  { label: t('clients.filterContacted'), value: 'contacted' },
  { label: t('clients.filterReplied'), value: 'replied' },
  { label: t('clients.filterDeal'), value: 'deal' },
])

const filteredClients = computed(() => {
  if (activeFilter.value === 'all') return clients.value
  return clients.value.filter(c => c.status === activeFilter.value)
})

function statusLabel(status) {
  const map = { new: 'New', contacted: 'Contacted', replied: 'Replied', deal: 'Deal Closed' }
  return map[status] || status
}

function loadClients() {
  try { clients.value = JSON.parse(localStorage.getItem('claw_clients') || '[]') } catch {}
}
onMounted(loadClients)

function handleFileDrop(e) { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }
function handleFileSelect(e) { if (e.target.files[0]) handleFile(e.target.files[0]) }
async function handleFile(file) {
  selectedFile.value = file; importResult.value = ''
}
async function doImport() {
  if (!selectedFile.value) return
  isImporting.value = true; importResult.value = ''
  let success = 0, failed = 0
  try {
    let rows = []
    if (selectedFile.value.name.endsWith('.csv')) {
      rows = await new Promise((resolve, reject) => {
        Papa.parse(selectedFile.value, { header: true, complete: r => resolve(r.data), error: e => reject(e), skipEmptyLines: true })
      })
    } else if (selectedFile.value.name.match(/\.xlsx?$/i)) {
      alert('Excel (.xlsx/.xls) support requires xlsx library. For now, please export as .csv.')
      failed = 9999
    }
    for (const row of rows) {
      const mapped = mapRow(row); if (!mapped) continue
      clients.value.unshift(mapped); success++
    }
    localStorage.setItem('claw_clients', JSON.stringify(clients.value.slice(0, 500)))
    importResult.value = t('clients.importResult', { success, failed })
  } catch (err) { importResult.value = 'Error: ' + err.message; failed++ }
  isImporting.value = false
}

function mapRow(row) {
  const keys = Object.keys(row).map(k => k.trim().toLowerCase())
  function find(...names) { return names.find(n => keys.includes(n.toLowerCase())) }
  const nameKey = find('company', 'name', 'company name', 'company_name', '客户公司', '公司名称')
  const emailKey = find('email', 'mail', 'email address', '邮箱', '电子邮件')
  const phoneKey = find('phone', 'telephone', 'mobile', 'tel', '电话', '手机')
  const contactKey = find('contact', 'contact person', 'contact_name', '联系人')
  const countryKey = find('country', 'nation', '国家', '地区')
  const noteKey = find('notes', 'note', 'remark', 'comment', '备注')
  const websiteKey = find('website', 'web', 'site', 'url', '网址', '网站')
  if (!nameKey && !row[keys[0]]) return null
  return {
    company: row[nameKey] || row[keys[0]] || '',
    contactName: row[contactKey] || '',
    email: row[emailKey] || '',
    phone: row[phoneKey] || '',
    country: row[countryKey] || '',
    website: row[websiteKey] || '',
    notes: row[noteKey] || '',
    status: 'new',
  }
}

// URL / Email 校验辅助函数（用于模板显示）
function isClientEmailValid(email) {
  if (!email) return false
  return isValidEmail(email)
}

function isClientWebsiteValid(website) {
  if (!website) return false
  return isValidUrl(website)
}

function normalizeClientUrl(url) {
  if (!url) return '#'
  const result = normalizeUrl(url)
  return result.valid ? result.url : '#'
}

// 表单输入校验
function validateEmailInput() {
  if (editForm.email && !isValidEmail(editForm.email)) {
    emailError.value = 'Invalid email format'
  } else {
    emailError.value = ''
  }
}

function validateWebsiteInput() {
  if (editForm.website && !isValidUrl(editForm.website)) {
    websiteError.value = 'Invalid URL format (e.g. https://www.example.com)'
  } else {
    websiteError.value = ''
  }
}

function deleteClient(index) {
  if (!confirm(t('clients.deleteConfirm'))) return
  const realIndex = clients.value.indexOf(filteredClients.value[index])
  if (realIndex >= 0) clients.value.splice(realIndex, 1)
  localStorage.setItem('claw_clients', JSON.stringify(clients.value))
}

function closeAdd() {
  showAdd.value = false; editingIndex.value = -1
  Object.assign(editForm, { company: '', contactName: '', email: '', phone: '', country: '', website: '', notes: '' })
  emailError.value = ''
  websiteError.value = ''
}

function saveClient() {
  if (!editForm.company) return
  // Email format warning (not blocking)
  if (editForm.email && !isValidEmail(editForm.email)) {
    if (!confirm('Email format may be invalid. Save anyway?')) return
  }
  // Website format warning (not blocking)
  if (editForm.website && !isValidUrl(editForm.website)) {
    if (!confirm('Website URL format may be invalid. Save anyway?')) return
  }
  if (editingIndex.value >= 0) {
    Object.assign(clients.value[editingIndex.value], { ...editForm })
  } else {
    clients.value.unshift({ ...editForm, status: 'new' })
  }
  localStorage.setItem('claw_clients', JSON.stringify(clients.value.slice(0, 500)))
  closeAdd()
}
</script>

<style scoped>
.clients-page { padding: 20px 16px; padding-bottom: 30px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.page-header h1 { font-size: 22px; color: #1f2937; margin: 0; }
.header-actions { display: flex; gap: 6px; }
.import-btn, .add-btn {
  border: none; border-radius: 8px;
  padding: 7px 14px; font-size: 12px; cursor: pointer; font-weight: 600;
}
.import-btn { background: #dbeafe; color: #1d4ed8; }
.add-btn { background: #1a56db; color: white; }
.total-count { font-size: 13px; color: #6b7280; margin-bottom: 10px; }
.filters { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; }
.filter-chip {
  padding: 5px 12px; border-radius: 20px; font-size: 12px;
  background: white; border: 1px solid #e5e7eb; color: #6b7280; cursor: pointer; white-space: nowrap;
}
.filter-chip.active { background: #1a56db; color: white; border-color: #1a56db; }
.client-list { display: flex; flex-direction: column; gap: 10px; }
.client-card {
  background: white; border-radius: 12px; padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.client-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.client-top h3 { font-size: 15px; color: #1f2937; margin: 0; }
.status-badge { font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 500; }
.status-new { background: #dbeafe; color: #1d4ed8; }
.status-contacted { background: #fef3c7; color: #b45309; }
.status-replied { background: #dcfce7; color: #15803d; }
.status-deal { background: #ede9fe; color: #6d28d9; }
.client-info p { font-size: 13px; color: #4b5563; margin: 2px 0; word-break: break-all; }
.client-info a { color: #1a56db; text-decoration: none; }
.client-info a:hover { text-decoration: underline; }
.website-link { color: #059669; }
.website-link:hover { text-decoration: underline; }
.invalid-email, .invalid-url {
  color: #dc2626;
  font-size: 12px;
  word-break: break-all;
}
.invalid-email small, .invalid-url small {
  color: #9ca3af;
  font-weight: normal;
}
.field-error {
  display: block;
  font-size: 11px;
  color: #dc2626;
  margin-top: 2px;
}
.client-info .notes { color: #6b7280; font-style: italic; margin-top: 4px; }
.client-actions { display: flex; gap: 8px; margin-top: 10px; justify-content: flex-end; }
.email-action {
  background: #1a56db; color: white; border: none; border-radius: 6px;
  padding: 5px 16px; font-size: 12px; cursor: pointer;
}
.delete-action {
  background: transparent; border: 1px solid #fecaca; color: #dc2626; border-radius: 6px;
  padding: 5px 10px; font-size: 14px; cursor: pointer;
}
.empty-state { text-align: center; padding: 40px 20px; color: #9ca3af; }

/* Modal */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal-content { background: #fff; border-radius: 14px; width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #f3f4f6; }
.modal-header h3 { margin: 0; font-size: 17px; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; line-height: 1; }
.modal-body { padding: 16px 18px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
.form-group input, .form-group textarea {
  width: 100%; border: 1.5px solid #e5e7eb; border-radius: 8px;
  padding: 8px 10px; font-size: 13px; outline: none;
  box-sizing: border-box; font-family: inherit;
}
.form-group input:focus, .form-group textarea:focus { border-color: #1a56db; }
.dropzone {
  border: 2px dashed #d1d5db; border-radius: 10px; padding: 24px;
  text-align: center; cursor: pointer; margin-bottom: 12px;
  transition: border-color 0.2s;
}
.dropzone:hover { border-color: #1a56db; }
.dropzone p { margin: 4px 0; font-size: 13px; color: #6b7280; }
.dropzone .hint { font-size: 11px !important; color: #9ca3af; }
.upload-btn {
  width: 100%; height: 40px; background: linear-gradient(135deg,#1a56db,#2563eb);
  color: white; border: none; border-radius: 8px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.import-result { font-size: 13px; text-align: center; margin-top: 10px; color: #15803d; }
.modal-footer { display: flex; gap: 8px; padding: 12px 18px; border-top: 1px solid #f3f4f6; }
.action-sm {
  flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; font-size: 13px; cursor: pointer; color: #6b7280;
}
.action-sm.primary { background: #1a56db; color: #fff; border-color: #1a56db; }
</style>
