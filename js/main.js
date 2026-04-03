'use strict'

const btnGet = document.querySelector('.btn-get')
const btnDl = document.querySelector('.btn-dl')
const tbody = document.querySelector('#results-table tbody')

let allFriends = [] // для будущей фильтрации

// Проверка токена
if (!isVkTokenActive) {
    const alert = document.querySelector('.alert-no-vk-token')
    if (alert) alert.classList.remove('d-none')
}

btnGet.addEventListener('click', async () => {
    const inputValue = document.querySelector('.id-input').value.trim()
    const resolvedDiv = document.getElementById('resolved-id')
    
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Определяем ID пользователя...</td></tr>`
    btnDl.style.display = 'none'
    resolvedDiv.textContent = ''

    if (!inputValue) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Введите ID или ссылку</td></tr>`
        return
    }

    let userID = inputValue

    // === Автоопределение: если введена ссылка или короткое имя ===
    const screenName = inputValue
        .replace(/https?:\/\//i, '')
        .replace(/vk\.com\//i, '')
        .replace(/vkontakte\.ru\//i, '')
        .trim()

    // Если это не чистые цифры и не начинается с "id" + цифры — нужно резолвить через API
    const isNumericID = /^\d+$/.test(screenName)
    const isIdFormat = /^id\d+$/i.test(screenName)

    if (!isNumericID && !isIdFormat) {
        // Нужно преобразовать screen_name → object_id
        resolvedDiv.textContent = 'Преобразуем короткий адрес в ID...'

        try {
            const params = new URLSearchParams({
                screen_name: screenName.replace(/^id/i, ''),
                access_token: localStorage[VK_STORAGE_TOKEN_ITEM_NAME],
                v: VK_API_VERSION
            })

            const response = await fetchJsonp(`https://api.vk.com/method/utils.resolveScreenName?${params}`)
            const data = await response.json()

            if (data.error || !data.response || !data.response.object_id) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Не удалось найти пользователя по ссылке</td></tr>`
                resolvedDiv.textContent = 'Ошибка: неверная ссылка или закрытый профиль'
                return
            }

            userID = data.response.object_id
            resolvedDiv.innerHTML = `✅ Найден ID пользователя: <strong>${userID}</strong>`

        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Ошибка при разрешении ссылки</td></tr>`
            console.error(e)
            return
        }
    } else {
        // Это уже числовой ID
        if (isIdFormat) {
            userID = screenName.replace(/^id/i, '')
        }
        resolvedDiv.innerHTML = `Используется ID: <strong>${userID}</strong>`
    }
    if (!userID) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Укажите ID пользователя</td></tr>`
        return
    }

    // === 1. Собираем fields из чекбоксов ===
    const checkedFields = Array.from(document.querySelectorAll('.field-param:checked'))
        .map(cb => cb.value)
        .join(',')

    const fields = [
        'first_name', 'last_name',
        'sex', 'bdate', 'domain',
        checkedFields
    ].filter(Boolean).join(',')

    // === 2. Запрос к VK API ===
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
            console.error(data.error)
            return
        }

        const friends = data.response?.items || []
        allFriends = friends

        if (friends.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Друзья закрыты или список пуст</td></tr>`
            return
        }

        // === 3. Отрисовка таблицы + подготовка CSV ===
        tbody.innerHTML = ''
        let csvRows = [`ID;Ссылка;Имя;Фамилия;Пол;Дата рождения${checkedFields ? ';' + checkedFields.split(',').join(';') : ''}`]

        friends.forEach(friend => {
            const link = friend.domain 
                ? `https://vk.com/${friend.domain}` 
                : `https://vk.com/id${friend.id}`

            const sexText = friend.sex === 1 ? 'Ж' : friend.sex === 2 ? 'М' : '—'

            // Строка таблицы (без фото)
            const rowHTML = `
                <tr>
                    <td>${friend.id}</td>
                    <td><a href="${link}" target="_blank" class="text-decoration-none">${link}</a></td>
                    <td>${friend.first_name} ${friend.last_name}</td>
                    <td>${sexText}</td>
                    <td>${friend.bdate || '—'}</td>
                </tr>`
            tbody.innerHTML += rowHTML

            // Строка для CSV с правильной кодировкой и экранированием
            const extraFields = checkedFields 
                ? checkedFields.split(',').map(field => {
                    const value = (friend[field] || '')
                    // Если значение — объект (например city), берём title
                    const text = typeof value === 'object' && value !== null ? (value.title || '') : value
                    return `"${text.toString().replace(/"/g, '""')}"`
                }).join(';')
                : ''

            const csvLine = [
                friend.id,
                link,
                `"${friend.first_name}"`,
                `"${friend.last_name}"`,
                sexText,
                `"${friend.bdate || ''}"`,
                extraFields
            ].join(';')

            csvRows.push(csvLine)
        })

        // === 4. Скачивание CSV с BOM ===
        const csvContent = csvRows.join('\n')
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csvContent], { 
            type: 'text/csv;charset=utf-8;' 
        })

        const url = URL.createObjectURL(blob)

        btnDl.style.display = 'inline-block'
        btnDl.href = url
        btnDl.download = `vk_friends_${userID}.csv`
        btnDl.textContent = `Скачать CSV (${friends.length} друзей)`

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Ошибка соединения с VK. Проверьте токен.</td></tr>`
        console.error(e)
    }
})