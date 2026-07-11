# Input/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Пайплайн парсинга терминального ввода: сырые байты stdin → токены → `KeyPressEvent`. Включает токенизатор stdin, отслеживание мыши, stateful парсер клавиатурных событий (keydown/keypress/keyup в browser-like стиле) и обратную сериализацию для тестов.
