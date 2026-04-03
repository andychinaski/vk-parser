'use strict'

const btnGet = document.querySelector('.btn-get')
const btnDl = document.querySelector('.btn-dl')
const tbody = document.querySelector('#results-table tbody')

let allFriends = []        // Все загруженные друзья
let currentFiltered = []   // Текущие отфильтрованные данные

// Элементы фильтров
const searchInput     = document.getElementById('search-name')
const sexSelect       = document.getElementById('filter-sex')
const dateFilterType  = document.getElementById('date-filter-type')
const applyBtn        = document.getElementById('apply-filters')
const resetBtn        = document.getElementById('reset-filters')
const countTotalEl    = document.getElementById('count-total')
const countFilteredEl = document.getElementById('count-filtered')
const resolvedDiv     = document.getElementById('resolved-id')

// Проверка токена
if (!isVkTokenActive) {
    const alert = document.querySelector('.alert-no-vk-token')
    if (alert) alert.classList.remove('d-none')
}

// ====================== ФУНКЦИИ ФИЛЬТРАЦИИ ======================

function calculateAge(bdate) {
    if (!bdate) return null
    const yearPart = bdate.split('.').pop()
    const year = parseInt(yearPart)
    return isNaN(year) ? null : new Date().getFullYear() - year
}

function applyFilters() {
    const searchText = searchInput.value.toLowerCase().trim()
    const selectedSex = sexSelect.value
    const filterType = dateFilterType.value

    currentFiltered = allFriends.filter(friend => {
        // Поиск по имени
        const fullName = `${friend.first_name || ''} ${friend.last_name || ''}`.toLowerCase()
        if (searchText && !fullName.includes(searchText)) return false

        // Пол
        if (selectedSex && friend.sex !== parseInt(selectedSex)) return false

        // Фильтр по возрасту или дате рождения
        if (filterType === 'age') {
            const ageFrom = parseInt(document.getElementById('age-from').value) || 0
            const ageTo   = parseInt(document.getElementById('age-to').value)   || 999

            const age = calculateAge(friend.bdate)
            if (age !== null) {
                if (age < ageFrom || age > ageTo) return false
            } else if (ageFrom > 0 || ageTo < 999) {
                return false
            }
        } 
        else if (filterType === 'birthdate') {
            const day   = parseInt(document.getElementById('birth-day').value)
            const month = parseInt(document.getElementById('birth-month').value)
            const year  = parseInt(document.getElementById('birth-year').value)

            if (!friend.bdate) {
                // Если дата рождения отсутствует, но пользователь что-то указал — скрываем
                if (day || month || year) return false
                return true
            }

            const parts = friend.bdate.split('.')
            const bDay   = parseInt(parts[0])
            const bMonth = parseInt(parts[1])
            const bYear  = parseInt(parts[2])

            if (day   && day   !== bDay)   return false
            if (month && month !== bMonth) return false
            if (year  && year  !== bYear)  return false
        }

        return true
    })

    renderTable(currentFiltered)
    updateFilterInfo()
}

function renderTable(friends) {
    tbody.innerHTML = ''

    if (friends.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Нет данных по выбранным фильтрам</td></tr>`
        return
    }

    let csvRows = [`ID;Ссылка;Имя;Фамилия;Пол;Дата рождения;Город`]

    friends.forEach(friend => {
        const link = friend.domain 
            ? `https://vk.com/${friend.domain}` 
            : `https://vk.com/id${friend.id}`

        const sexText = friend.sex === 1 ? 'Ж' : friend.sex === 2 ? 'М' : '—'
        const cityName = friend.city 
            ? (typeof friend.city === 'object' ? friend.city.title || '—' : '—') 
            : '—'

        // Строка таблицы
        const rowHTML = `
            <tr>
                <td>${friend.id}</td>
                <td><a href="${link}" target="_blank" class="text-decoration-none">${link}</a></td>
                <td>${friend.first_name || ''} ${friend.last_name || ''}</td>
                <td>${sexText}</td>
                <td>${friend.bdate || '—'}</td>
                <td>${cityName}</td>
            </tr>`
        tbody.innerHTML += rowHTML

        // Строка для CSV
        const csvLine = [
            friend.id,
            link,
            `"${friend.first_name || ''}"`,
            `"${friend.last_name || ''}"`,
            sexText,
            `"${friend.bdate || ''}"`,
            `"${cityName}"`
        ].join(';')

        csvRows.push(csvLine)
    })

    // Скачивание CSV
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

// === Переключение между Возраст и Дата рождения ===
dateFilterType.addEventListener('change', () => {
    const ageBlock = document.getElementById('age-block')
    const birthdateBlock = document.getElementById('birthdate-block')

    if (dateFilterType.value === 'age') {
        ageBlock.classList.remove('d-none')
        birthdateBlock.classList.add('d-none')
    } else {
        ageBlock.classList.add('d-none')
        birthdateBlock.classList.remove('d-none')
    }
})

// Начальное состояние — показываем блок возраста
document.getElementById('age-block').classList.remove('d-none')
document.getElementById('birthdate-block').classList.add('d-none')