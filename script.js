if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js')
            .then(function(reg) { console.log('PWA успешно активировано!', reg.scope); })
            .catch(function(err) { console.log('Ошибка PWA:', err); });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const recipeForm = document.getElementById('recipe-form');
    const recipesList = document.getElementById('recipes-list');
    const searchInput = document.getElementById('search-input');
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const menuCloseBtn = document.getElementById('menu-close-btn');
    const currentShelfTitle = document.getElementById('current-shelf-title');
    
    const recipesModal = document.getElementById('recipes-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    const recipeImageInput = document.getElementById('recipe-image');
    const fileUploadLabel = document.getElementById('file-upload-label');
    const uploadStatusText = document.getElementById('upload-status-text');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    const editRecipeIdInput = document.getElementById('edit-recipe-id');
    const formModeTitle = document.getElementById('form-mode-title');
    const submitFormBtn = document.getElementById('submit-form-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    const interactiveCropZone = document.getElementById('interactive-crop-zone');
    const cropTargetImg = document.getElementById('crop-target-img');
    const cropZoomSlider = document.getElementById('crop-zoom-slider');

    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    let recipeIdToDelete = null;

    let recipes = JSON.parse(localStorage.getItem('my_recipes')) || [];
    let currentCategory = 'soups'; 

    let isDragging = false;
    let startX, startY, currentX = 0, currentY = 0;
    let imgWidth = 0, imgHeight = 0; 
    let dispW = 0, dispH = 0;

    const categoryNames = {
        soups: '🍲 Супы', meat: '🥩 Мясо', fish: '🐟 Рыба', salads: '🥗 Салаты', bakery: '🥐 Выпечка', pancakes: '🥞 Блинчики'
    };

    renderAll();

    recipeImageInput.addEventListener('change', function(e) {
        const file = e.target.files;
        if (file && file[0]) {
            const fileName = file[0].name.length > 20 ? file[0].name.substring(0, 17) + '...' : file[0].name;
            fileUploadLabel.classList.add('success');
            uploadStatusText.innerHTML = '✓ Выбрано: <strong>' + fileName + '</strong>';
            
            const reader = new FileReader();
            reader.onload = function(event) {
                interactiveCropZone.style.display = 'flex';
                cropTargetImg.src = event.target.result;
                
                cropZoomSlider.value = 100;
                currentX = 0;
                currentY = 0;
                
                const tempImg = new Image();
                tempImg.onload = function() {
                    imgWidth = tempImg.width;
                    imgHeight = tempImg.height;
                    updateImageSize();
                };
                tempImg.src = event.target.result;
            };
            reader.readAsDataURL(file[0]);
        }
    });
    function updateImageSize() {
        const zoom = parseFloat(cropZoomSlider.value) / 100;
        if (imgWidth < imgHeight) {
            dispW = 200 * zoom;
            dispH = (imgHeight * (200 / imgWidth)) * zoom;
        } else {
            dispH = 200 * zoom;
            dispW = (imgWidth * (200 / imgHeight)) * zoom;
        }
        cropTargetImg.style.width = dispW + 'px';
        cropTargetImg.style.height = dispH + 'px';
        constrainPosition();
    }

    function constrainPosition() {
        const maxLeft = 0;
        const minLeft = 200 - dispW;
        const maxTop = 0;
        const minTop = 200 - dispH;

        if (currentX > maxLeft) currentX = maxLeft;
        if (currentX < minLeft) currentX = minLeft;
        if (currentY > maxTop) currentY = maxTop;
        if (currentY < minTop) currentY = minTop;

        cropTargetImg.style.left = currentX + 'px';
        cropTargetImg.style.top = currentY + 'px';
    }

    function startDrag(e) {
        isDragging = true;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.pageX - currentX;
        startY = touch.pageY - currentY;
        if (e.cancelable) e.preventDefault();
    }

    function doDrag(e) {
        if (!isDragging) return;
        const touch = e.touches ? e.touches[0] : e;
        currentX = touch.pageX - startX;
        currentY = touch.pageY - startY;
        constrainPosition();
    }

    function stopDrag() { isDragging = false; }

    cropTargetImg.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);

    cropTargetImg.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', stopDrag);

    cropZoomSlider.addEventListener('input', updateImageSize);

    function resetUploadStatus() {
        fileUploadLabel.classList.remove('success');
        uploadStatusText.textContent = '📸 Загрузить сочное фото';
        interactiveCropZone.style.display = 'none';
        cropTargetImg.src = '';
    }

    function openMenu() { sidebar.classList.add('open'); sidebarOverlay.classList.add('show'); }
    function closeMenu() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); }
    menuToggleBtn.addEventListener('click', openMenu);
    menuCloseBtn.addEventListener('click', closeMenu);
    sidebarOverlay.addEventListener('click', closeMenu);

    function openModal() { recipesModal.classList.add('open'); }
    function closeModal() { recipesModal.classList.remove('open'); }
    modalCloseBtn.addEventListener('click', closeModal);

    tabButtons.forEach(button => {
        button.addEventListener('click', e => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.getAttribute('data-category');
            currentShelfTitle.textContent = '🌿 Кулинарная полка: ' + categoryNames[currentCategory];
            renderRecipes();
            closeMenu(); 
            openModal(); 
        });
    });
    recipeForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const idToEdit = editRecipeIdInput.value;
        const title = document.getElementById('recipe-title').value;
        const category = document.getElementById('recipe-category').value;
        const ingredients = document.getElementById('recipe-ingredients').value;
        const process = document.getElementById('recipe-process').value;

        if (!cropTargetImg.src && !idToEdit) {
            alert('Пожалуйста, выберите фото блюда! 📸');
            return;
        }

        const saveRecipeData = (finalImage, cropData) => {
            if (idToEdit) {
                recipes = recipes.map(item => {
                    if (item.id === parseInt(idToEdit)) {
                        return { ...item, title, category, ingredients, process, image: finalImage, crop: cropData || item.crop };
                    }
                    return item;
                });
                exitEditMode();
            } else {
                const today = new Date();
                const day = String(today.getDate()).padStart(2, '0');
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const year = today.getFullYear();
                const formattedDate = `📅 Добавлено: ${day}.${month}.${year}`;

                const newRecipe = { 
                    id: Date.now(), title: title, category: category, ingredients: ingredients, process: process, image: finalImage, date: formattedDate, crop: cropData 
                };
                recipes.push(newRecipe);
                recipeForm.reset();
                resetUploadStatus();
            }
            saveAndRender();
            openModal();
        };

        if (idToEdit && (!recipeImageInput.files || recipeImageInput.files.length === 0)) {
            saveRecipeData(cropTargetImg.src, null);
        } else {
            // Сохраняем чистое исходное Base64 и параметры сдвига, которые вы выбрали пальцем
            const zoom = parseFloat(cropZoomSlider.value) / 100;
            const cropSettings = {
                x: currentX,
                y: currentY,
                z: zoom,
                w: imgWidth,
                h: imgHeight
            };
            saveRecipeData(cropTargetImg.src, cropSettings);
        }
    });

    function startEditMode(recipe) {
        closeModal(); 
        editRecipeIdInput.value = recipe.id;
        document.getElementById('recipe-title').value = recipe.title;
        document.getElementById('recipe-category').value = recipe.category;
        document.getElementById('recipe-ingredients').value = recipe.ingredients;
        document.getElementById('recipe-process').value = recipe.process;
        
        interactiveCropZone.style.display = 'none'; 
        fileUploadLabel.classList.add('success');
        uploadStatusText.innerHTML = '✓ Фото загружено (нажмите для замены)';
        cropTargetImg.src = recipe.image;
        recipeImageInput.required = false; 

        recipeForm.classList.add('edit-mode');
        formModeTitle.textContent = '✏️ Изменение рецепта';
        submitFormBtn.textContent = 'Обновить рецепт 🌟';
        cancelEditBtn.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function exitEditMode() {
        editRecipeIdInput.value = "";
        recipeForm.reset();
        resetUploadStatus();
        recipeForm.classList.remove('edit-mode');
        formModeTitle.textContent = '✨ Новый шедевр вкуса';
        submitFormBtn.textContent = 'Добавить в книгу 🥂';
        cancelEditBtn.style.display = 'none';
    }

    cancelEditBtn.addEventListener('click', exitEditMode);
    searchInput.addEventListener('input', renderRecipes);

    function renderAll() { renderRecipes(); }

    function renderRecipes() {
        recipesList.innerHTML = '';
        const searchText = searchInput.value.toLowerCase().trim();
        const filtered = recipes.filter(r => (currentCategory === 'all' || r.category === currentCategory) && r.title.toLowerCase().includes(searchText));

        if (filtered.length === 0) {
            recipesList.innerHTML = '<p style="text-align: center; color: #2d6a4f; font-style: italic; padding: 20px;">На полке "' + categoryNames[currentCategory] + '" пока пусто...</p>';
            return;
        }
        filtered.forEach(r => recipesList.appendChild(createCard(r)));
        attachEvents();
    }

    function createCard(recipe) {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'card-actions';

        const btnEdit = document.createElement('button'); btnEdit.className = 'edit-btn'; btnEdit.textContent = 'Изменить ✏️'; btnEdit.setAttribute('data-id', recipe.id);
        const btnDelete = document.createElement('button'); btnDelete.className = 'delete-btn'; btnDelete.textContent = 'Удалить 🗑️'; btnDelete.setAttribute('data-id', recipe.id);

        actionsDiv.appendChild(btnEdit); actionsDiv.appendChild(btnDelete);

        let currentBadge = categoryNames[recipe.category] || '🍽️ Рецепт';
        let displayDate = recipe.date || `📅 Добавлено: ${new Date().toLocaleDateString('ru-RU')}`;

        card.innerHTML = '<div class="recipe-card-image-wrap"><img id="card-img-' + recipe.id + '" src="' + recipe.image + '"></div>' +
            '<div class="recipe-card-content">' +
                '<h3>' + recipe.title + '</h3>' +
                '<div class="recipe-date">' + displayDate + '</div>' + 
                '<span class="recipe-badge">' + currentBadge + '</span>' +
                '<div>' +
                    '<div class="recipe-section-title">📋 Ингредиенты:</div>' +
                    '<p>' + recipe.ingredients + '</p>' +
                '</div>' +
                '<div>' +
                    '<div class="recipe-section-title">👩‍🍳 Приготовление:</div>' +
                    '<p>' + recipe.process + '</p>' +
                '</div>' +
            '</div>';

        card.querySelector('.recipe-card-content').appendChild(actionsDiv);

        // Магия динамической подстройки CSS-стилей ракурса под итоговую карточку
        setTimeout(function() {
            const cardImg = card.querySelector('#card-img-' + recipe.id);
            if (cardImg && recipe.crop) {
                const c = recipe.crop;
                // Рассчитываем коэффициенты масштабирования от 200px рамки экрана к 100% карточки
                let baseFactor = 100 / 200;
                let scaleW = (c.w < c.h) ? 100 * c.z : (c.w * (100 / c.h)) * c.z;
                let scaleH = (c.w < c.h) ? (c.h * (100 / c.w)) * c.z : 100 * c.z;

                cardImg.style.width = scaleW + '%';
                cardImg.style.height = 'auto';
                cardImg.style.left = (c.x * baseFactor) + '%';
                cardImg.style.top = (c.y * baseFactor) + '%';
            }
        }, 10);

        return card;
    }

    function attachEvents() {
        document.querySelectorAll('.edit-btn').forEach(btn => { btn.onclick = (e) => { e.stopPropagation(); const id = parseInt(e.target.getAttribute('data-id')); const r = recipes.find(item => item.id === id); if (r) startEditMode(r); }; });
        
        document.querySelectorAll('.delete-btn').forEach(btn => { 
            btn.onclick = (e) => { 
                e.stopPropagation(); 
                recipeIdToDelete = parseInt(btn.getAttribute('data-id')); 
                deleteConfirmModal.classList.add('open');
            }; 
        });
    }

    confirmYesBtn.onclick = function() {
        if (recipeIdToDelete) {
            recipes = recipes.filter(item => item.id !== recipeIdToDelete);
            saveAndRender();
        }
        deleteConfirmModal.classList.remove('open');
        recipeIdToDelete = null;
    };

    confirmCancelBtn.onclick = function() {
        deleteConfirmModal.classList.remove('open');
        recipeIdToDelete = null;
    };

    function saveAndRender() { localStorage.setItem('my_recipes', JSON.stringify(recipes)); renderAll(); }
});
