# Usamos Nginx liviano para servir archivos estáticos
FROM nginx:1.27-alpine

# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos todo el sitio dentro de la carpeta pública de Nginx
COPY . /usr/share/nginx/html

# Exponemos el puerto 80 dentro del contenedor
EXPOSE 80
