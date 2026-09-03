// ═══ DESKTOP MODE FLAG (deve ser o primeiro, antes de qualquer função que use) ═══
var IS_DESKTOP = function(){ return document.body.classList.contains('desktop-mode'); };

// ═══ FEATURE FLAGS ═══
// USE_NEW_AUTH: true  → login via Cloud Functions (registerDriver/loginDriver) + signInWithCustomToken
//               false → fluxo legado (SHA-256 client-side, sem Firebase Auth para motoristas)
// Alternar para true após: (1) migrar os 37 motoristas, (2) validar registerDriver/loginDriver em staging
const USE_NEW_AUTH = true;

// ═══ FIREBASE CONFIG ═══
const APP_VERSION = 30; // Incrementar a cada deploy para forçar update em todos os devices
const FIREBASE_CONFIG={apiKey:"AIzaSyAbYd2RulYeBr-_IQ8G4ccmzxKf8gAjLPQ",authDomain:"rotogramas-confianca.firebaseapp.com",databaseURL:"https://rotogramas-confianca-default-rtdb.firebaseio.com",projectId:"rotogramas-confianca",storageBucket:"rotogramas-confianca.firebasestorage.app",messagingSenderId:"156398881281",appId:"1:156398881281:web:a67f3e2ee02b969ab78e00"};
// Admin auth via Firebase Authentication (credenciais gerenciadas no Console do Firebase)
const MAPBOX_TOKEN='pk.eyJ1IjoibWFnbWF0cml4IiwiYSI6ImNtc2VzMnVmeDAzcG0yd3EzZ29sZ3B0bXAifQ.0GE2l_Phleota_jEOqnRMQ';

// Coordenadas reais de cada ponto das rotas (lat, lng)
// Origem/destino: centro das cidades | Postos: localização aproximada na rodovia
const ROUTE_COORDS={
  'lucas-goiania':{
    orig:[-13.0512,-55.9128],  // Lucas do Rio Verde MT
    stops:[
      [-13.0510,-55.9100],     // Rede São Roque — Sabiá (Lucas do Rio Verde)
      [-13.8251,-56.0835],     // Rede São Roque — 29 (Nova Mutum) — alt
      [-15.5569,-54.2783],     // Rede São Roque — Alvorada (Primavera do Leste)
    ],
    dest:[-16.6869,-49.2648],  // Goiânia GO
  },
  'goiania-cabedelo':{
    orig:[-16.6869,-49.2648],  // Goiânia GO
    stops:[
      [-12.0963,-45.7897],     // Posto Cerradão (Luís Eduardo Magalhães BA — BR-242)
      [-12.5217,-40.3093],     // Posto Irmão Caminhoneiro II (Itaberaba BA — BR-116)
      [-11.3628,-37.4773],     // Posto Azul — Atalaia (Santa Luzia do Itanhi SE — BR-101)
      [-7.8353,-34.9087],      // Posto CJCM (Igarassu PE — BR-101)
    ],
    dest:[-6.9811,-34.8341],   // Cabedelo PB
  },
  'cabedelo-suape':{
    orig:[-6.9811,-34.8341],   // Cabedelo PB
    stops:[
      [-7.2601,-34.9013],      // Posto Petroconde (Conde PB — BR-101)
    ],
    dest:[-8.3936,-34.9787],   // Suape PE (Porto)
  },
  'goiania-sjcampos':{
    orig:[-16.6869,-49.2648],  // Goiânia GO
    stops:[],
    dest:[-23.1794,-45.8869],  // São José dos Campos SP
  },
  'goiania-smateus':{
    orig:[-16.6869,-49.2648],  // Goiânia GO
    stops:[],
    dest:[-25.8766,-50.3828],  // São Mateus do Sul PR
  }
};

const REGION_ORDER=['Centro-Oeste','Nordeste','Sudeste','Sul'];

const DEFAULTS=[
{id:'lucas-goiania',nome:'Lucas do Rio Verde → Goiânia',estados:'MT → GO',numero:'01',regiao:'Centro-Oeste',subtitulo:'Rota 01',linkRota:'https://maps.app.goo.gl/RQmTr6AP3kjDG65Z8',distancia:'~900 km',tempo:'~12h',paradas:[
{ordem:0,tipo:'origem',nome:'Lucas do Rio Verde — MT',cidade:'Após carregar',detalhe:'BR-163 → MT-251 → BR-070 → BR-060',km:'0'},
{ordem:1,tipo:'completa',nome:'Rede São Roque — Sabiá',cidade:'Lucas do Rio Verde — MT',razaoSocial:'Posto São Roque — Sabiá',litragem:'Completa o tanque',cartao:'truckpag',km:'5',link:'https://maps.app.goo.gl/d8JaW8EZnRMyyaVR9',alternativa:{nome:'Rede São Roque — 29',cidade:'Nova Mutum — MT',litragem:'Completa o tanque',cartao:'truckpag',km:'100',link:'https://maps.app.goo.gl/Gg3S1rtRuDcJf7zZ6'}},
{ordem:2,tipo:'parcial',nome:'Rede São Roque — Alvorada',cidade:'Primavera do Leste — MT',litragem:'Obrigatório (exceto Scania)',cartao:'truckpag',km:'450',nota:'Obrigatório para todas as marcas, exceto Scania.',link:'https://maps.app.goo.gl/QGC9w92uvcmApJmc9',marcas:[{marca:'Volvo',litros:'200L'},{marca:'Scania',litros:'Não abastece'},{marca:'Meteor',litros:'200L'},{marca:'Mercedes',litros:'300L'}]},
{ordem:3,tipo:'destino',nome:'Goiânia — GO',cidade:'Chegada à garagem',km:'900'}]},
{id:'goiania-cabedelo',nome:'Goiânia → Cabedelo',estados:'GO → BA → SE → PE → PB',numero:'02',regiao:'Nordeste',subtitulo:'Rota 02',linkRota:'https://maps.app.goo.gl/fvaMjeExq6nCp8yi6',distancia:'~2.450 km',tempo:'~30h',paradas:[
{ordem:0,tipo:'origem',nome:'Goiânia — GO',cidade:'Saída da garagem',detalhe:'BR-153 → BR-020 → BR-242 → BR-116 → BR-101',km:'0'},
{ordem:1,tipo:'completa',nome:'Posto Cerradão',cidade:'Luís Eduardo Magalhães — BA',razaoSocial:'Auto Posto São Roque — Cerradão',litragem:'Completa o tanque',cartao:'truckpag',km:'850',link:'https://maps.app.goo.gl/Z5kyJdDhnuRHzedv6'},
{ordem:2,tipo:'parcial',nome:'Posto Irmão Caminhoneiro II',cidade:'Itaberaba — BA',litragem:'200 litros',cartao:'truckpag',km:'1.400',nota:'200L para chegar até Sergipe onde o diesel é mais barato.',link:'https://maps.app.goo.gl/CNqGn28QPT3yDFpd8',alternativa:{nome:'Posto São Caetano',cidade:'Santo Estêvão — BA',litragem:'200 litros',cartao:'truckpag',km:'1.500',nota:'Mesma lógica — 200L para Sergipe.',link:'https://maps.app.goo.gl/xtAuqcusfpnvVxuT7'}},
{ordem:3,tipo:'completa',nome:'Posto Azul — Atalaia',cidade:'Santa Luzia do Itanhi — SE',litragem:'Completa o tanque',cartao:'shell',km:'1.900',vantagem:'Diesel mais barato em Sergipe',link:'https://maps.app.goo.gl/eApQPbcLipGX6tsi6'},
{ordem:4,tipo:'completa',nome:'Posto CJCM',cidade:'Igarassu — PE',razaoSocial:'Posto Shell (Igarassu)',litragem:'Completa o tanque',cartao:'shell',km:'2.300',link:'https://maps.app.goo.gl/ynhhNNWJTvuyi5Jt9'},
{ordem:5,tipo:'destino',nome:'Cabedelo — PB',cidade:'Chegada ao destino',km:'2.450'}]},
{id:'cabedelo-suape',nome:'Cabedelo → Suape',estados:'PB → PE',numero:'03',regiao:'Nordeste',subtitulo:'Rota 03',linkRota:'https://maps.app.goo.gl/6QCtNdYNuezqKs2BA',distancia:'~150 km',tempo:'~2h30',paradas:[
{ordem:0,tipo:'origem',nome:'Cabedelo — PB',cidade:'Saída do ponto',detalhe:'BR-101 sentido sul',km:'0'},
{ordem:1,tipo:'completa',nome:'Posto Petroconde',cidade:'Conde — PB',razaoSocial:'Eco Postos Conde',litragem:'Completa o tanque',cartao:'shell_expers',km:'25',link:'https://maps.app.goo.gl/Xbqi8GrwEGvQgXV17'},
{ordem:2,tipo:'destino',nome:'Suape — PE',cidade:'Chegada ao destino',km:'150'}]},
{id:'goiania-sjcampos',nome:'Goiânia → São José dos Campos',estados:'GO → MG → SP',numero:'04',regiao:'Sudeste',subtitulo:'Rota 04',linkRota:'',distancia:'~900 km',tempo:'~11h',paradas:[
{ordem:0,tipo:'origem',nome:'Goiânia — GO',cidade:'Saída da garagem',km:'0'},
{ordem:1,tipo:'destino',nome:'São José dos Campos — SP',cidade:'Sem abastecer na ida — abastece no CAVAP',km:'900'}]},
{id:'goiania-smateus',nome:'Goiânia → São Mateus do Sul',estados:'GO → SP → PR',numero:'05',regiao:'Sul',subtitulo:'Rota 05',linkRota:'',distancia:'~1.200 km',tempo:'~15h',paradas:[
{ordem:0,tipo:'origem',nome:'Goiânia — GO',cidade:'Saída da garagem',km:'0'},
{ordem:1,tipo:'destino',nome:'São Mateus do Sul — PR',cidade:'Sem abastecer — abastece no Cais Ponta Grossa na volta',km:'1.200'}]}
];
