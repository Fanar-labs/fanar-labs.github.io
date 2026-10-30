# lib — чужие библиотеки, взятые в проект

## three-0.186.1/ — three.js 0.186.1
- Что: библиотека 3D в странице (WebGL). Лицензия MIT — `three-0.186.1/LICENSE`.
- Откуда: jsDelivr, зеркало npm-пакета `three@0.186.1` (вышел 24.09.2026). Скачано 30.10.2026 по слову автора
  («Да, скачивай»), ≈2,2 МБ; 19 файлов сверены с хэшами sha256 из списка jsDelivr — все совпали.
- Файлы: `three.module.js` (берёт `three.core.js` рядом) и 16 дополнений в `three-0.186.1/addons/` с путями, как в
  `examples/jsm/`: postprocessing (EffectComposer, RenderPass, ShaderPass, MaskPass, Pass, BokehPass, OutputPass,
  GTAOPass), shaders (Copy, Bokeh, Output, GTAO, PoissonDenoise), math/SimplexNoise, geometries/RoundedBoxGeometry,
  environments/RoomEnvironment.
- Как подключать: в странице — карта импорта
  `{"imports": {"three": "../lib/three-0.186.1/three.module.js", "three/addons/": "../lib/three-0.186.1/addons/"}}`.
- Папка названа по версии: следующая версия библиотеки ляжет рядом, а v31 и проба продолжат брать свою — версии заморожены.
- Кто берёт: `kukolnyj-dom/proba-3d.html` (проба вида) и `v31/` (дом в объёме).
