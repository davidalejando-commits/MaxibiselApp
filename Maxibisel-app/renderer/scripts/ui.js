//Gestión de la interfaz de usuario
export const uiManager = {
    alertTimeout: null,

    init() {
        // Inicializar manejo de navegación
        document.querySelectorAll('.nav-link').forEach(navLink => {
            navLink.addEventListener('click', this.handleNavigation.bind(this));
        });

        // Crear contenedor para alertas si no existe
        if (!document.getElementById('alert-container')) {
            const alertContainer = document.createElement('div');
            alertContainer.id = 'alert-container';
            alertContainer.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
            alertContainer.style.zIndex = '1050';
            document.body.appendChild(alertContainer);
        }
    },

    handleNavigation(event) {
        event.preventDefault();

        // Obtener la vista a mostrar
        const viewId = event.target.dataset.view;

        // Actualizar clases activas en la navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        event.target.classList.add('active');

        // Ocultar todas las vistas
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.add('d-none');
        });

        // Mostrar la vista seleccionada
        const viewContainer = document.getElementById(`${viewId}-view`);
        if (viewContainer) {
            viewContainer.classList.remove('d-none');
        }
    },

    showAlert(message, type = 'info') {
        // Eliminar alerta anterior si existe
        if (this.alertTimeout) {
            clearTimeout(this.alertTimeout);
            const oldAlert = document.querySelector('.alert');
            if (oldAlert) oldAlert.remove();
        }

        // Crear nueva alerta
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show`;
        alertElement.role = 'alert';
        alertElement.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
    `;

        // Añadir al contenedor
        const container = document.getElementById('alert-container');
        container.appendChild(alertElement);

        // Auto-cerrar después de 5 segundos
        this.alertTimeout = setTimeout(() => {
            alertElement.classList.remove('show');
            setTimeout(() => alertElement.remove(), 150);
        }, 5000);
    }
};