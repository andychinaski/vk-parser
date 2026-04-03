'use strict'

const btnGet = document.querySelector('.btn-get')
const btnDl = document.querySelector('.btn-dl')
const tbody = document.querySelector('#results-table tbody')

let allFriends = []        // Все загруженные друзья
let currentFiltered = []   // Текущие отфильтрованные данные

// Элементы фильтров
const searchInput = document.getElementById('search-name')
const sexSelect = document.getElementById('filter-sex')
const ageFromInput = document.getElementById('age-from')
const ageToInput = document.getElementById('age-to')
const applyBtn = document.getElementById('apply-filters')
const resetBtn = document.getElementById('reset-filters')
const countTotalEl = document.getElementById('count-total')
const countFilteredEl = document.getElementById('count-filtered')
const resolvedDiv = document.getElementById('resolved-id')

// Проверка токена
if (!isVkTokenActive) {
    const alert = document.querySelector('.alert-no-vk-token')
    if (alert) alert.classList.remove('d-none')
}

// ====================== ФУНКЦИИ ФИЛЬТРАЦИИ ======================

function calculateAge(bdate) {
    if (!bdate) return null
    const parts = bdate.split('.')
    if (parts.length < 3) return null
    const year = parseInt(parts[2])
    if (isNaN(year)) return null
    return new Date().getFullYear() - year
}

function applyFilters() {
    const searchText = searchInput.value.toLowerCase().trim()
    const selectedSex = sexSelect.value
    const fromAge = parseInt(ageFromInput.value) || 0
    const toAge = parseInt(ageToInput.value) || 999

    currentFiltered = allFriends.filter(friend => {
        // Поиск по имени и фамилии
        const fullName = `${friend.first_name || ''} ${friend.last_name || ''}`.toLowerCase()
        if (searchText && !fullName.includes(searchText)) return false

        // Фильтр по полу
        if (selectedSex && friend.sex !== parseInt(selectedSex)) return false

        // Фильтр по возрасту
        const age = calculateAge(friend.bdate)
        if (age !== null) {
            if (age < fromAge || age > toAge) return false
        } else if (fromAge > 0 || toAge < 999) {
            // Если возраст задан, но дата рождения отсутствует — скрываем
            return false
        }

        return true
    })

    renderTable(currentFiltered)
    updateFilterInfo()
}

function renderTable(friends) {
    tbody.innerHTML = ''

    if (friends.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Нет данных, удовлетворяющих фильтрам</td></tr>`
        return
    }

    let csvRows = [`ID;Ссылка;Имя;Фамилия;Пол;Дата рождения`]

    friends.forEach(friend => {
        const link = friend.domain 
            ? `https://vk.com/${friend.domain}` 
            : `https://vk.com/id${friend.id}`

        const sexText = friend.sex === 1 ? 'Ж' : friend.sex === 2 ? 'М' : '—'

        // Строка таблицы
        const rowHTML = `
            <tr>
                <td>${friend.id}</td>
                <td><a href="${link}" target="_blank" class="text-decoration-none">${link}</a></td>
                <td>${friend.first_name || ''} ${friend.last_name || ''}</td>
                <td>${sexText}</td>
                <td>${friend.bdate || '—'}</td>
            </tr>`
        tbody.innerHTML += rowHTML

        // Строка для CSV
        const csvLine = [
            friend.id,
            link,
            `"${friend.first_name || ''}"`,
            `"${friend.last_name || ''}"`,
            sexText,
            `"${friend.bdate || ''}"`
        ].join(';')

        csvRows.push(csvLine)
    })

    // Обновляем кнопку скачивания
    const csvContent = csvRows.join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    btnDl.style.display = 'inline-block'
    btnDl.href = url
    btnDl.download = `vk_friends_${document.querySelector('.id-input').value.trim() || 'list'}.csv`
    btnDl.textContent = `Скачать CSV (${friends.length} друзей)`
}

function updateFilterInfo() {
    countTotalEl.textContent = allFriends.length
    countFilteredEl.textContent = currentFiltered.length
}

// ====================== ОСНОВНОЙ ОБРАБОТЧИК ======================

btnGet.addEventListener('click', async () => {
    const inputValue = document.querySelector('.id-input').value.trim()

    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Определяем ID пользователя...</td></tr>`
    btnDl.style.display = 'none'
    resolvedDiv.textContent = ''

    if (!inputValue) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Введите ID или ссылку на профиль</td></tr>`
        return
    }

    let userID = inputValue

    // Очистка и нормализация ввода
    const screenName = inputValue
        .replace(/https?:\/\//i, '')
        .replace(/vk\.com\//i, '')
        .replace(/vkontakte\.ru\//i, '')
        .trim()

    const isPureNumeric = /^\d+$/.test(screenName)
    const isIdFormat = /^id\d+$/i.test(screenName)

    // Если это не чистый ID — нужно резолвить через VK API
    if (!isPureNumeric && !isIdFormat) {
        resolvedDiv.textContent = 'Преобразуем ссылку в ID...'

        try {
            const params = new URLSearchParams({
                screen_name: screenName.replace(/^id/i, ''),
                access_token: localStorage[VK_STORAGE_TOKEN_ITEM_NAME],
                v: VK_API_VERSION
            })

            const response = await fetchJsonp(`https://api.vk.com/method/utils.resolveScreenName?${params}`)
            const data = await response.json()

            if (data.error || !data.response || !data.response.object_id) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Не удалось найти пользователя по этой ссылке</td></tr>`
                resolvedDiv.textContent = 'Ошибка: неверная ссылка'
                return
            }

            userID = data.response.object_id
            resolvedDiv.innerHTML = `✅ ID пользователя: <strong>${userID}</strong>`

        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Ошибка при обработке ссылки</td></tr>`
            console.error(e)
            return
        }
    } else {
        // Уже числовой ID
        if (isIdFormat) userID = screenName.replace(/^id/i, '')
        resolvedDiv.innerHTML = `Используется ID: <strong>${userID}</strong>`
    }

    // === Запрос списка друзей ===
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Загружаем список друзей...</td></tr>`

    const checkedFields = Array.from(document.querySelectorAll('.field-param:checked'))
        .map(cb => cb.value)
        .join(',')

    const fields = [
        'first_name', 'last_name',
        'sex', 'bdate', 'domain',
        checkedFields
    ].filter(Boolean).join(',')

    const params = new URLSearchParams({
        user_id: userID,
        access_token: localStorage[VK_STORAGE_TOKEN_ITEM_NAME],
        v: VK_API_VERSION,
        count: 5000,
        fields: fields
    })

    try {
        const response = await fetchJsonp(`https://api.vk.com/method/friends.get?${params}`)
        const data = await response.json()

        if (data.error) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Ошибка VK: ${data.error.error_msg}</td></tr>`
            return
        }

        const friends = data.response?.items || []

        if (friends.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Друзья закрыты или список пуст</td></tr>`
            return
        }

        allFriends = friends
        currentFiltered = [...friends]

        renderTable(currentFiltered)
        updateFilterInfo()

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Ошибка соединения с VK</td></tr>`
        console.error(e)
    }
})

// ====================== СОБЫТИЯ ФИЛЬТРОВ ======================

applyBtn.addEventListener('click', applyFilters)
resetBtn.addEventListener('click', () => {
    searchInput.value = ''
    sexSelect.value = ''
    ageFromInput.value = ''
    ageToInput.value = ''
    currentFiltered = [...allFriends]
    renderTable(currentFiltered)
    updateFilterInfo()
})

// Реал-тайм поиск при вводе текста
searchInput.addEventListener('input', applyFilters)