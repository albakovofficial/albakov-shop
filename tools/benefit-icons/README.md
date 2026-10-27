# Объёмные иконки блока «Преимущества»

Иконки нарисованы кодом (`render.html`, трёхмерные фигуры и свет в шейдере), без сторонних картинок.
Готовые файлы лежат в `public/img/benefits/*.webp`.

Пересобрать (нужны Python, Playwright с Chromium и Pillow):

    python3 tools/benefit-icons/render.py tools/benefit-icons /tmp/icons delivery,fitting,return,payment,gift 1500

Затем сохранить `/tmp/icons/<имя>.png` в WebP в `public/img/benefits/`.
