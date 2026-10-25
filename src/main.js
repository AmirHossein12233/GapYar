
import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="app" dir="rtl">
    <header class="topbar">
      <div class="brand">
        <div class="logo">گ</div>
        <div><h1>گپ‌یار</h1><p id="connectionStatus">در حال اتصال...</p></div>
      </div>
      <button class="icon-btn" id="searchBtn">⌕</button>
    </header>

    <div class="search hidden" id="searchBox">
      <input id="searchInput" placeholder="جست‌وجوی گفتگو..." />
    </div>

    <section class="welcome">
      <span>👋</span>
      <div><h2>سلام! به گپ‌یار خوش آمدی</h2><p>گفتگوهایت را آنلاین ادامه بده</p></div>
    </section>

    <section id="loginBox" style="padding:16px">
      <h3>ورود به گپ‌یار</h3>
      <p>یک نام کاربری انتخاب کن؛ دوستت هم باید نام کاربری خودش را داشته باشد.</p>
      <input id="usernameInput" placeholder="نام کاربری خودت" maxlength="30" />
      <button class="new-chat" id="loginBtn" style="position:static;width:100%;margin-top:10px">اتصال</button>
    </section>

    <nav class="tabs">
      <button class="tab active" data-tab="chats">گفتگوها</button>
      <button class="tab" data-tab="groups">گروه‌ها</button>
      <button class="tab" data-tab="channels">کانال‌ها</button>
    </nav>

    <main>
      <div class="section-title">
        <h2 id="listTitle">گفتگوهای اخیر</h2>
        <span id="itemCount">۰ گفتگو</span>
      </div>
      <div id="chatList"></div>
      <div id="empty" class="empty hidden">
        <div>💬</div><h3>هنوز گفتگویی نداری</h3>
        <p>برای شروع، روی دکمه پایین بزن.</p>
      </div>
    </main>

    <section id="conversation" class="hidden" style="padding:16px">
      <button id="backBtn">← بازگشت</button>
      <h2 id="conversationTitle">گفتگو</h2>
      <div id="messages" style="min-height:160px;max-height:45vh;overflow:auto;padding:8px"></div>
      <form id="messageForm" style="display:flex;gap:8px">
        <input id="messageInput" placeholder="پیامت را بنویس..." maxlength="2000" required style="min-width:0;flex:1" />
        <button class="primary" type="submit">ارسال</button>
      </form>
    </section>

    <button class="new-chat" id="newChat">＋ گفتگوی جدید</button>

    <footer>
      <button class="nav-item selected"><span>💬</span>گفتگوها</button>
      <button class="nav-item" id="profileBtn"><span>👤</span>حساب من</button>
      <button class="nav-item" id="settingsBtn"><span>⚙️</span>تنظیمات</button>
    </footer>

    <dialog id="newDialog">
      <form method="dialog" id="newForm">
        <h2>گفتگوی جدید</h2>
        <p>نام کاربری مخاطب را دقیق وارد کن.</p>
        <input id="contactName" placeholder="مثلاً ali123" maxlength="30" required />
        <div class="dialog-actions">
          <button class="cancel" value="cancel">لغو</button>
          <button class="primary" value="create">شروع گفتگو</button>
        </div>
      </form>
    </dialog>

    <dialog id="infoDialog">
      <form method="dialog">
        <h2 id="infoTitle">گپ‌یار</h2><p id="infoText"></p>
        <button class="primary">باشه</button>
      </form>
    </dialog>
  </div>
`

const $ = selector => document.querySelector(selector)
const SERVER = 'wss://gapyar.onrender.com/ws/'
let socket = null
let username = ''
let activeContact = ''
let currentTab = 'chats'
let items = []
let messages = {}

try {
  items = JSON.parse(localStorage.getItem('gapyar-items') || '[]')
  messages = JSON.parse(localStorage.getItem('gapyar-messages') || '{}')
} catch {
  items = []
  messages = {}
}

const save = () => {
  localStorage.setItem('gapyar-items', JSON.stringify(items))
  localStorage.setItem('gapyar-messages', JSON.stringify(messages))
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  })[c])
}

function showInfo(title, message) {
  $('#infoTitle').textContent = title
  $('#infoText').textContent = message
  $('#infoDialog').showModal()
}

function render() {
  const query = $('#searchInput').value.trim().toLowerCase()
  const filtered = items.filter(item =>
    item.type === currentTab && item.name.toLowerCase().includes(query)
  )

  $('#listTitle').textContent = {
    chats: 'گفتگوهای اخیر', groups: 'گروه‌های من', channels: 'کانال‌های من'
  }[currentTab]
  $('#itemCount').textContent = `${filtered.length} مورد`
  $('#empty').classList.toggle('hidden', filtered.length !== 0)
  $('#chatList').innerHTML = filtered.map(item => `
    <button class="chat-row" data-id="${escapeHtml(item.name)}">
      <div class="avatar">${item.icon || '🙂'}</div>
      <div class="chat-info">
        <strong>${escapeHtml(item.name)}</strong>
        <p>${escapeHtml(item.message || 'گفتگو را شروع کن')}</p>
      </div>
      <span class="chat-time">${escapeHtml(item.time || '')}</span>
    </button>
  `).join('')

  document.querySelectorAll('.tab').forEach(tab =>
    tab.classList.toggle('active', tab.dataset.tab === currentTab)
  )
}

function connect() {
  const name = $('#usernameInput').value.trim()
  if (!name || name.length > 30) {
    showInfo('نام کاربری', 'یک نام کاربری بین ۱ تا ۳۰ نویسه وارد کن.')
    return
  }

  if (socket) socket.close()
  username = name
  localStorage.setItem('gapyar-username', username)
  $('#loginBox').classList.add('hidden')
  $('#connectionStatus').textContent = 'در حال اتصال...'

  socket = new WebSocket(SERVER + encodeURIComponent(username))

  socket.onopen = () => {
    $('#connectionStatus').textContent = '🟢 متصل به سرور'
  }

  socket.onmessage = event => {
    let data
    try { data = JSON.parse(event.data) } catch { return }
    const contact = data.from
    if (!contact || typeof data.text !== 'string') return

    if (!messages[contact]) messages[contact] = []
    messages[contact].push({ from: contact, text: data.text, time: data.time })
    messages[contact] = messages[contact].slice(-300)

    let item = items.find(x => x.name === contact && x.type === 'chats')
    if (!item) {
      item = { name: contact, type: 'chats', icon: '🙂' }
      items.unshift(item)
    }
    item.message = data.text
    item.time = 'اکنون'
    save()
    render()
    if (activeContact === contact) renderMessages()
    else showInfo('پیام جدید از ' + contact, data.text)
  }

  socket.onerror = () => {
    $('#connectionStatus').textContent = 'خطای اتصال'
  }

  socket.onclose = () => {
    $('#connectionStatus').textContent = 'اتصال قطع شد؛ دوباره وصل شو'
  }
}

function openChat(contact) {
  activeContact = contact
  $('#conversationTitle').textContent = contact
  $('#conversation').classList.remove('hidden')
  $('#chatList').classList.add('hidden')
  $('#empty').classList.add('hidden')
  $('#newChat').classList.add('hidden')
  $('.tabs').classList.add('hidden')
  renderMessages()
}

function renderMessages() {
  const list = messages[activeContact] || []
  $('#messages').innerHTML = list.map(message => `
    <div style="margin:8px 0;text-align:${message.from === username ? 'left' : 'right'}">
      <div style="display:inline-block;padding:9px 12px;border-radius:12px;background:${message.from === username ? '#d9fdd3' : '#eeeeee'};color:#222;max-width:90%;overflow-wrap:anywhere">
        ${escapeHtml(message.text)}
      </div>
      <small style="display:block;color:#888">${message.from === username ? 'من' : escapeHtml(message.from)}</small>
    </div>
  `).join('')
  $('#messages').scrollTop = $('#messages').scrollHeight
}

$('#loginBtn').addEventListener('click', connect)
$('#usernameInput').value = localStorage.getItem('gapyar-username') || ''

$('#searchBtn').addEventListener('click', () => {
  $('#searchBox').classList.toggle('hidden')
  if (!$('#searchBox').classList.contains('hidden')) $('#searchInput').focus()
})
$('#searchInput').addEventListener('input', render)

$('.tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]')
  if (!tab) return
  currentTab = tab.dataset.tab
  render()
})

$('#newChat').addEventListener('click', () => {
  if (!username || !socket || socket.readyState !== WebSocket.OPEN) {
    showInfo('اتصال لازم است', 'اول با نام کاربری به سرور وصل شو.')
    return
  }
  $('#contactName').value = ''
  $('#newDialog').showModal()
})

$('#newForm').addEventListener('submit', event => {
  event.preventDefault()
  const contact = $('#contactName').value.trim()
  if (!contact || contact === username) {
    showInfo('نام مخاطب', 'نام کاربری مخاطب را درست وارد کن؛ نام خودت نباشد.')
    return
  }

  if (!items.some(x => x.name === contact && x.type === 'chats')) {
    items.unshift({ name: contact, message: 'گفتگو را شروع کن', type: 'chats', icon: '🙂', time: 'اکنون' })
  }
  if (!messages[contact]) messages[contact] = []
  save()
  $('#newDialog').close()
  currentTab = 'chats'
  render()
  openChat(contact)
})

$('#chatList').addEventListener('click', event => {
  const row = event.target.closest('[data-id]')
  if (row) openChat(row.dataset.id)
})

$('#backBtn').addEventListener('click', () => {
  activeContact = ''
  $('#conversation').classList.add('hidden')
  $('#chatList').classList.remove('hidden')
  $('.tabs').classList.remove('hidden')
  $('#newChat').classList.remove('hidden')
  render()
})

$('#messageForm').addEventListener('submit', event => {
  event.preventDefault()
  const text = $('#messageInput').value.trim()
  if (!text || !activeContact) return
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showInfo('اتصال قطع است', 'به سرور وصل نیستی. دوباره اتصال را امتحان کن.')
    return
  }

  socket.send(JSON.stringify({ to: activeContact, text }))
  if (!messages[activeContact]) messages[activeContact] = []
  messages[activeContact].push({ from: username, text, time: new Date().toISOString() })
  messages[activeContact] = messages[activeContact].slice(-300)

  const item = items.find(x => x.name === activeContact && x.type === 'chats')
  if (item) {
    item.message = text
    item.time = 'اکنون'
  }
  save()
  $('#messageInput').value = ''
  renderMessages()
  render()
})

$('#profileBtn').addEventListener('click', () =>
  showInfo('حساب من', username ? `نام کاربری: ${username}` : 'برای شروع، ابتدا وصل شو.')
)
$('#settingsBtn').addEventListener('click', () =>
  showInfo('تنظیمات', 'پیام‌ها فعلاً فقط روی همین دستگاه ذخیره می‌شوند.')
)

render()
