# Rotogramas — Rodoviário Confiança

PWA (Progressive Web App) de rotogramas de abastecimento para motoristas da frota Confiança.

## O que é

App mobile-first usado pelos motoristas para consultar rotas com postos de abastecimento confirmados, incluindo litragem, tipo de cartão aceito e localização GPS de cada parada. O painel admin permite criar, editar e excluir rotas em tempo real.

## Funcionalidades

- Consulta de rotas por região com busca textual
- Detalhe de cada parada (posto, litragem, cartão, localização)
- Rastreamento GPS do motorista durante a viagem
- Notificações de atualizações de rota
- Painel administrativo para gestão de rotas e motoristas
- Modo desktop com layout em dois painéis
- Suporte offline via Service Worker

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | HTML/CSS/JS puro (SPA em `index.html`) |
| Mapas | Mapbox GL JS + Mapbox Directions API |
| Backend | Firebase Realtime Database |
| Hosting | GitHub Pages |
| PWA | Web App Manifest + Service Worker |
| Geocoding | Nominatim (OpenStreetMap) com cache localStorage |

## Estrutura de arquivos

```
/
├── index.html          # App completo (SPA)
├── sw.js               # Service Worker
├── manifest.json       # PWA manifest
├── icon-192.png
├── icon-192-maskable.png
├── icon-512.png
├── icon-512-maskable.png
└── README.md
```

## Deploy

O app é hospedado via **GitHub Pages** na branch `main`.

Qualquer push na branch `main` reflete automaticamente em:
**https://magmatrixdev.github.io/Rotogramaapp/**

### Como fazer deploy manual

1. Edite o `index.html` localmente
2. Incremente `APP_VERSION` no início do script (força atualização nos dispositivos)
3. Faça commit e push para `main`

## Firebase — Estrutura do banco

```
/rotogramas        → array de rotas (gerenciado pelo admin)
/motoristas        → cadastro de motoristas
/viagens           → viagens em andamento
/posicoes          → posições GPS em tempo real
/notifications     → notificações de atualização de rota
/config/appVersion → versão atual para forçar reload
```

## Notas de desenvolvimento

- O Service Worker **não intercepta** requisições de HTML — isso evita que versões antigas fiquem em cache e impede que atualizações demorem a chegar nos dispositivos.
- O modo desktop é controlado pela classe CSS `body.desktop-mode` (não por media queries), pois o sistema de navegação por stack usa `display` inline e media queries não conseguem sobrescrever.
- CPFs são armazenados com criptografia AES-GCM. PINs são hasheados com SHA-256.
