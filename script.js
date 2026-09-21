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

    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    let recipeIdToDelete = null;

    let recipes = JSON.parse(localStorage.getItem('my_recipes')) || [];
    let currentCategory = 'soups'; 
    let temporaryImageBase64 = ""; 

    const categoryNames = {
        soups: '🍲 Супы', meat: '🥩 Мясо', fish: '🐟 Рыба', salads: '🥗 Салаты', bakery: '🥐 Выпечка', pancakes: '🥞 Блинчики'
    };

    renderAll();

    const autoResizeTextareas = document.querySelectorAll('textarea.auto-resize');
    autoResizeTextareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    });

    // ТУТ ИСПРАВЛЕНО: Полностью чистый, сверхустойчивый обработчик загрузки фото без старых функций
    recipeImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
            fileUploadLabel.classList.add('success');
            uploadStatusText.innerHTML = '✓ Выбрано: <strong>' + fileName + '</strong>';
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    let w = img.width;
                    let h = img.height;
                    const max = 600;
                    if (w > h && w > max) { h *= max / w; w = max; }
                    else if (h > max) { w *= max / h; h = max; }
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    temporaryImageBase64 = canvas.toDataURL('image/jpeg', 0.82);
                    imagePreviewContainer.innerHTML = '<img src="' + temporaryImageBase64 + '" alt="Превью">';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    function resetUploadStatus() {
        fileUploadLabel.classList.remove('success');
        uploadStatusText.textContent = '📸 Загрузить сочное фото';
        imagePreviewContainer.innerHTML = '';
        temporaryImageBase64 = "";
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

        if (!temporaryImageBase64 && !idToEdit) {
            alert('Пожалуйста, сделайте или выберите фото блюда! 📸');
            return;
        }

        const saveRecipeData = (finalImage) => {
            if (idToEdit) {
                recipes = recipes.map(item => {
                    if (item.id === parseInt(idToEdit)) {
                        return { ...item, title, category, ingredients, process, image: finalImage };
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
                    id: Date.now(), title: title, category: category, ingredients: ingredients, process: process, image: finalImage, date: formattedDate 
                };
                recipes.push(newRecipe);
                recipeForm.reset();
                resetUploadStatus();
            }
            saveAndRender();
            setTimeout(showSuccessToast, 50);
        };

        if (idToEdit && !temporaryImageBase64) {
            const oldRecipe = recipes.find(item => item.id === parseInt(idToEdit));
            saveRecipeData(oldRecipe ? oldRecipe.image : "");
        } else {
            saveRecipeData(temporaryImageBase64);
        }
    });
    function showSuccessToast() {
        let toast = document.querySelector('.toast-success');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-success';
            toast.innerHTML = '✅ Добавлено! 🍋';
            document.body.appendChild(toast);
        }
        setTimeout(() => { toast.classList.add('show'); }, 30);
        setTimeout(() => { toast.classList.remove('show'); }, 2000);
    }

    function startEditMode(recipe) {
        closeModal(); 
        const singleModal = document.querySelector('.single-view-modal');
        if (singleModal) singleModal.style.display = 'none';

        editRecipeIdInput.value = recipe.id;
        document.getElementById('recipe-title').value = recipe.title;
        document.getElementById('recipe-category').value = recipe.category;
        document.getElementById('recipe-ingredients').value = recipe.ingredients;
        document.getElementById('recipe-process').value = recipe.process;
        
        fileUploadLabel.classList.add('success');
        uploadStatusText.innerHTML = '✓ Фото загружено (нажмите для замены)';
        temporaryImageBase64 = recipe.image;
        imagePreviewContainer.innerHTML = '<img src="' + recipe.image + '" alt="Превью">';
        recipeImageInput.required = false; 

        recipeForm.classList.add('edit-mode');
        formModeTitle.textContent = '✏️ Изменение рецепта';
        submitFormBtn.textContent = 'Обновить рецепт 🌟';
        cancelEditBtn.style.display = 'block';

        setTimeout(() => {
            autoResizeTextareas.forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });
        }, 50);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function exitEditMode() {
        editRecipeIdInput.value = "";
        recipeForm.reset();
        resetUploadStatus();
        recipeForm.classList.remove('edit-mode');
        formModeTitle.textContent = 'Новый шедевр вкуса';
        submitFormBtn.textContent = 'Добавить в книгу 🥂';
        cancelEditBtn.style.display = 'none';
        setTimeout(() => { autoResizeTextareas.forEach(t => t.style.height = 'auto'); }, 50);
    }

    cancelEditBtn.addEventListener('click', exitEditMode);
    searchInput.addEventListener('input', renderRecipes);

    function renderAll() { renderRecipes(); }

    function renderRecipes() {
        recipesList.innerHTML = '';
        const searchText = searchInput.value.toLowerCase().trim();
        const filtered = recipes.filter(r => r.category === currentCategory && r.title.toLowerCase().includes(searchText));

        filtered.sort((a, b) => a.title.localeCompare(b.title, 'ru'));

        if (filtered.length === 0) {
            recipesList.innerHTML = '<p style="text-align: center; color: #2d6a4f; font-style: italic; padding: 20px;">На полке "' + categoryNames[currentCategory] + '" пока пусто...</p>';
            return;
        }

        filtered.forEach(recipe => {
            const item = document.createElement('div');
            item.className = 'recipe-list-item';
            item.textContent = recipe.title;
            item.onclick = () => { openSingleView(recipe); };
            recipesList.appendChild(item);
        });
    }

    // ТУТ ИСПРАВЛЕНО: Кнопки перенесены в отдельный вертикальный блок single-view-actions х3
    function openSingleView(recipe) {
        let singleModal = document.querySelector('.single-view-modal');
        if (!singleModal) {
            singleModal = document.createElement('div');
            singleModal.className = 'single-view-modal';
            document.body.appendChild(singleModal);
        }

        let currentBadge = categoryNames[recipe.category] || '🍽️ Рецепт';
        let displayDate = recipe.date || `📅 Добавлено: ${new Date().toLocaleDateString('ru-RU')}`;

        singleModal.innerHTML = `
            <div class="single-view-header">
                <h2>${recipe.title}</h2>
                <button class="single-view-close">×</button>
            </div>
            <div class="single-view-img-wrap">
                <img src="${recipe.image}">
            </div>
            <div class="single-view-info">
                <div class="recipe-date" style="margin: 0;">${displayDate}</div>
                <span class="recipe-badge" style="margin-bottom: 10px;">${currentBadge}</span>
                <div>
                    <div class="recipe-section-title">📋 Ингредиенты:</div>
                    <p style="white-space: pre-wrap; color: #40916c; line-height: 1.6; margin: 0;">${recipe.ingredients}</p>
                </div>
                <div>
                    <div class="recipe-section-title">👩‍🍳 Приготовление:</div>
                    <p style="white-space: pre-wrap; color: #40916c; line-height: 1.6; margin: 0;">${recipe.process}</p>
                </div>
                <div class="single-view-actions">
                    <button class="edit-btn">Изменить рецепт ✏️</button>
                    <button class="delete-btn">Удалить из книги 🗑️</button>
                </div>
            </div>
        `;

        singleModal.style.display = 'block';

        singleModal.querySelector('.single-view-close').onclick = () => { singleModal.style.display = 'none'; };
        singleModal.querySelector('.edit-btn').onclick = () => { startEditMode(recipe); };
        
        singleModal.querySelector('.delete-btn').onclick = () => {
            recipeIdToDelete = recipe.id;
            deleteConfirmModal.classList.add('open');
        };
    }

    confirmYesBtn.onclick = function() {
        if (recipeIdToDelete) {
            recipes = recipes.filter(item => item.id !== recipeIdToDelete);
            saveAndRender();
            deleteConfirmModal.classList.remove('open');
            const singleModal = document.querySelector('.single-view-modal');
            if (singleModal) singleModal.style.display = 'none';
        }
        recipeIdToDelete = null;
    };

    confirmCancelBtn.onclick = function() {
        deleteConfirmModal.classList.remove('open');
        recipeIdToDelete = null;
    };

    function saveAndRender() { localStorage.setItem('my_recipes', JSON.stringify(recipes)); renderAll(); }
});
