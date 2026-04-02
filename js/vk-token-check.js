'use strict'

let isVkTokenActive = false

if (VK_STORAGE_TOKEN_ITEM_NAME in localStorage) {
	if ((Date.now() / 1000) > Number(localStorage[VK_STORAGE_TOKEN_DATE_ITEM_NAME])) {
		localStorage.removeItem(VK_STORAGE_TOKEN_ITEM_NAME)
	} else {
		isVkTokenActive = true
	}
}

document.addEventListener('DOMContentLoaded', () => {
    const tokenAlert = document.querySelector('.alert-no-vk-token');
    
    if (tokenAlert) {
        if (!isVkTokenActive) {
            tokenAlert.classList.remove('d-none');
        } else {
            tokenAlert.classList.add('d-none');
        }
    }
});