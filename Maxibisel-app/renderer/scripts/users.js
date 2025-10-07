//Gestión de usuarios
export const userManager = {
    init() {
        // Esta función se implementaría con la lógica para usuarios
        const usersView = document.getElementById('users-view');

        usersView.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="bi bi-exclamation-triangle"></i>Vista General</h2>
        
      </div>
      
      <div class="alert alert-info">
        <i class="bi bi-info-circle me-2"></i>
        El módulo para generar códigos de barra será implementado en una próxima versión.
      </div>
    `;
    }
};
