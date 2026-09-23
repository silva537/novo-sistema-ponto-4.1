// ==========================================
// BLOCO 1: CONSTANTES, CONFIGURAÇÕES E STORAGE
// ==========================================
const CHAVE_STORAGE = 'ponto_vigia_v5';
const CHAVE_BACKUP = 'ponto_vigia_backup_seguranca';
const CHAVE_STATUS = 'ponto_vigia_status_servico';
const CHAVE_PROXIMA_RONDA = 'ponto_vigia_proxima_ronda';
const CHAVE_DEV_TEMPO = 'ponto_vigia_dev_tempo_ronda';
const CHAVE_MANUTENCAO = 'ponto_vigia_modo_manutencao';
const CHAVE_TEMA = 'ponto_vigia_tema';
const CHAVE_VALOR_PLANTAO = 'ponto_vigia_valor_plantao';
const CHAVE_META_SALARIO = 'ponto_vigia_meta_salario';
const CHAVE_GEOFENCING = 'ponto_vigia_geofencing_config';
const CHAVE_FILA_OFFLINE = 'ponto_vigia_fila_offline_queue';
const CHAVE_PASSAGEM_PLANTAO = 'ponto_vigia_passagem_plantao';
const SENHA_DEV = "3691";

let tempoRondaSegundos = parseInt(localStorage.getItem(CHAVE_DEV_TEMPO), 10) || 3600;

function vibrarDispositivo(padrao = 50) {
    if ("vibrate" in navigator) {
        try { navigator.vibrate(padrao); } catch (e) {}
    }
}

function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem(CHAVE_TEMA, tema);
    const selectTema = document.getElementById('dev-tema-select');
    if (selectTema) selectTema.value = tema;
}
aplicarTema(localStorage.getItem(CHAVE_TEMA) || 'blue');

function atualizarStatusSistema() {
    const infoConexao = document.getElementById('info-conexao');
    const infoBateria = document.getElementById('info-bateria');
    
    if (infoConexao) {
        const qtdFila = obterFilaOffline().length;
        const totalRegistros = Storage.obter().length;
        if (navigator.onLine) {
            if (qtdFila > 0) {
                infoConexao.innerHTML = `🟡 <span style="color: #f1c40f;">●</span> Sincronizando (${qtdFila} pendente)...`;
            } else {
                infoConexao.innerHTML = `🟢 <span style="color: #2ecc71;">●</span> Online (Total: ${totalRegistros})`;
            }
        } else {
            infoConexao.innerHTML = `🔴 <span style="color: #e74c3c;">●</span> Offline (${qtdFila} na fila)`;
        }
    }

    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            infoBateria.textContent = `🔋 Bateria: ${Math.round(battery.level * 100)}%`;
        }).catch(() => { infoBateria.textContent = "🔋 Bateria: N/D"; });
    }
}

function obterFilaOffline() {
    const fila = localStorage.getItem(CHAVE_FILA_OFFLINE);
    return fila ? JSON.parse(fila) : [];
}

function salvarNaFilaOffline(item) {
    const fila = obterFilaOffline();
    fila.push(item);
    localStorage.setItem(CHAVE_FILA_OFFLINE, JSON.stringify(fila));
    atualizarStatusSistema();
}

function sincronizarFilaOffline() {
    if (!navigator.onLine) return;
    const fila = obterFilaOffline();
    if (fila.length === 0) return;

    const registros = Storage.obter();
    let atualizados = [...fila, ...registros];
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(atualizados));
    localStorage.setItem(CHAVE_BACKUP, JSON.stringify(atualizados));
    localStorage.removeItem(CHAVE_FILA_OFFLINE);
    atualizarStatusSistema();
    if (typeof renderizar === 'function') renderizar();
}

setInterval(atualizarStatusSistema, 5000);
window.addEventListener('online', () => { sincronizarFilaOffline(); atualizarStatusSistema(); });
window.addEventListener('offline', atualizarStatusSistema);

const Storage = {
    obter() {
        const dados = localStorage.getItem(CHAVE_STORAGE);
        return dados ? JSON.parse(dados) : [];
    },
    salvar(item) {
        if (!navigator.onLine) {
            salvarNaFilaOffline(item);
            alert('📴 Sem conexão! O registro foi salvo em fila segura.');
            return;
        }
        sincronizarFilaOffline();
        const registros = this.obter();
        registros.unshift(item);
        const jsonStr = JSON.stringify(registros);
        localStorage.setItem(CHAVE_STORAGE, jsonStr);
        localStorage.setItem(CHAVE_BACKUP, jsonStr);
        
        if (typeof StorageNuvem !== 'undefined' && StorageNuvem.salvarNaNuvem) {
            StorageNuvem.salvarNaNuvem(item);
        }
    },
    limpar() {
        localStorage.removeItem(CHAVE_STORAGE);
        localStorage.removeItem(CHAVE_BACKUP);
        localStorage.removeItem(CHAVE_FILA_OFFLINE);
    }
};

window.apagarRegistroUnico = function(id) {
    if (confirm('Deseja realmente apagar este registro específico?')) {
        vibrarDispositivo([40, 40]);
        let registros = Storage.obter().filter(item => item.id !== id);
        const jsonStr = JSON.stringify(registros);
        localStorage.setItem(CHAVE_STORAGE, jsonStr);
        localStorage.setItem(CHAVE_BACKUP, jsonStr);
        if (typeof renderizar === 'function') renderizar();
    }
};

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

let fotoBase64 = null;
let audioContext = null;
let alarmInterval = null;
let streamCamera = null;
let statusServico = localStorage.getItem(CHAVE_STATUS) || 'false';

function checarManutencao() {
    const emManutencao = localStorage.getItem(CHAVE_MANUTENCAO) === 'true';
    const tela = document.getElementById('tela-manutencao');
    if (tela) tela.style.display = emManutencao ? 'flex' : 'none';
}
setInterval(checarManutencao, 1000);

function inicializarAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
}

function tocarAlarme() {
    if (alarmInterval) return;
    inicializarAudioContext();
    alarmInterval = setInterval(() => {
        try {
            if (audioContext && audioContext.state === 'running') {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, audioContext.currentTime);
                gain.gain.setValueAtTime(0.3, audioContext.currentTime);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start();
                osc.stop(audioContext.currentTime + 0.3);
            }
        } catch (e) {}
    }, 800);
}

function pararAlarme() {
    if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
}

function resetarTimerRonda(segundosCustom = null) {
    const segundos = segundosCustom || tempoRondaSegundos;
    const proximaRonda = Date.now() + (segundos * 1000);
    localStorage.setItem(CHAVE_PROXIMA_RONDA, proximaRonda);
}
// ==========================================
// BLOCO 2: CONFIGURAÇÃO DE UI, MENU DEV E RENDERIZAÇÃO
// ==========================================
window.atualizarCalculoSalario = function() {
    let valorPorPlantao = parseFloat(localStorage.getItem(CHAVE_VALOR_PLANTAO)) || 100.00;
    let metaSalario = parseFloat(localStorage.getItem(CHAVE_META_SALARIO)) || 1000.00;
    
    const registros = Storage.obter();
    const entradas = registros.filter(r => r.tipo && r.tipo.includes('Entrada de Serviço'));
    const plantoesRealizados = entradas.length;
    const totalAcumulado = plantoesRealizados * valorPorPlantao;

    const elPlantoes = document.getElementById('total-plantoes');
    const elTxtValor = document.getElementById('txt-valor-plantao');
    const elTotalSalario = document.getElementById('total-salario');
    const elTxtMeta = document.getElementById('txt-meta-salario');
    const elBarra = document.getElementById('barra-progresso-meta');

    if (elPlantoes) elPlantoes.textContent = plantoesRealizados;
    if (elTxtValor) elTxtValor.textContent = `R$ ${valorPorPlantao.toFixed(2).replace('.', ',')}`;
    if (elTotalSalario) elTotalSalario.textContent = `R$ ${totalAcumulado.toFixed(2).replace('.', ',')}`;
    if (elTxtMeta) elTxtMeta.textContent = `R$ ${metaSalario.toFixed(2).replace('.', ',')}`;

    let progresso = metaSalario > 0 ? (totalAcumulado / metaSalario) * 100 : 0;
    if (progresso > 100) progresso = 100;
    if (elBarra) elBarra.style.width = `${progresso}%`;
};

document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    checarManutencao();
    atualizarStatusSistema();
    sincronizarFilaOffline();

    let valorPorPlantao = parseFloat(localStorage.getItem(CHAVE_VALOR_PLANTAO)) || 100.00;
    let metaSalario = parseFloat(localStorage.getItem(CHAVE_META_SALARIO)) || 1000.00;

    const configGeoSalva = JSON.parse(localStorage.getItem(CHAVE_GEOFENCING));
    if (configGeoSalva) {
        if (document.getElementById('dev-lat-posto')) document.getElementById('dev-lat-posto').value = configGeoSalva.lat || '';
        if (document.getElementById('dev-lng-posto')) document.getElementById('dev-lng-posto').value = configGeoSalva.lng || '';
        if (document.getElementById('dev-raio-posto')) document.getElementById('dev-raio-posto').value = configGeoSalva.raio || 200;
    }

    const btnCapturarGeoAtual = document.getElementById('btn-capturar-geo-atual');
    if (btnCapturarGeoAtual) {
        btnCapturarGeoAtual.addEventListener('click', () => {
            vibrarDispositivo(40);
            if (!("geolocation" in navigator)) return alert('Geolocalização não suportada.');
            btnCapturarGeoAtual.textContent = '⏳ Obtendo GPS...';
            btnCapturarGeoAtual.disabled = true;

            navigator.geolocation.getCurrentPosition((pos) => {
                document.getElementById('dev-lat-posto').value = pos.coords.latitude;
                document.getElementById('dev-lng-posto').value = pos.coords.longitude;
                btnCapturarGeoAtual.textContent = '🎯 Capturar Localização Atual do GPS';
                btnCapturarGeoAtual.disabled = false;
                alert('✅ Coordenadas capturadas com sucesso!');
            }, (err) => {
                btnCapturarGeoAtual.textContent = '🎯 Capturar Localização Atual do GPS';
                btnCapturarGeoAtual.disabled = false;
                alert('❌ Erro GPS: ' + err.message);
            }, { timeout: 10000, enableHighAccuracy: true });
        });
    }

    const btnSalvarGeo = document.getElementById('btn-salvar-geofencing');
    if (btnSalvarGeo) {
        btnSalvarGeo.addEventListener('click', () => {
            vibrarDispositivo(40);
            const lat = parseFloat(document.getElementById('dev-lat-posto').value);
            const lng = parseFloat(document.getElementById('dev-lng-posto').value);
            const raio = parseFloat(document.getElementById('dev-raio-posto').value) || 200;
            if (isNaN(lat) || isNaN(lng)) return alert('Insira coordenadas válidas!');
            localStorage.setItem(CHAVE_GEOFENCING, JSON.stringify({ lat, lng, raio }));
            alert('✅ Coordenadas do posto salvas!');
        });
    }

    const btnAjustarValor = document.getElementById('btn-ajustar-valor');
    if (btnAjustarValor) {
        btnAjustarValor.addEventListener('click', () => {
            vibrarDispositivo(40);
            const novoValor = prompt(`Valor por plantão (Atual: R$ ${valorPorPlantao}):`, valorPorPlantao);
            if (novoValor !== null) {
                const parsed = parseFloat(novoValor.replace(',', '.'));
                if (!isNaN(parsed) && parsed >= 0) {
                    valorPorPlantao = parsed;
                    localStorage.setItem(CHAVE_VALOR_PLANTAO, valorPorPlantao);
                    window.atualizarCalculoSalario();
                    alert('✅ Valor atualizado!');
                } else alert('Valor inválido!');
            }
        });
    }

    const btnAjustarMeta = document.getElementById('btn-ajustar-meta');
    if (btnAjustarMeta) {
        btnAjustarMeta.addEventListener('click', () => {
            vibrarDispositivo(40);
            const novaMeta = prompt(`Meta salarial (Atual: R$ ${metaSalario}):`, metaSalario);
            if (novaMeta !== null) {
                const parsed = parseFloat(novaMeta.replace(',', '.'));
                if (!isNaN(parsed) && parsed >= 0) {
                    metaSalario = parsed;
                    localStorage.setItem(CHAVE_META_SALARIO, metaSalario);
                    window.atualizarCalculoSalario();
                    alert('✅ Meta atualizada!');
                } else alert('Valor inválido!');
            }
        });
    }

    document.getElementById('nome-vigia').value = localStorage.getItem('vigia_nome') || '';
    document.getElementById('posto-trabalho').value = localStorage.getItem('vigia_posto') || '';
    document.getElementById('nome-vigia').addEventListener('input', (e) => localStorage.setItem('vigia_nome', e.target.value));
    document.getElementById('posto-trabalho').addEventListener('input', (e) => localStorage.setItem('vigia_posto', e.target.value));

    document.getElementById('btn-desbloquear-manutencao').addEventListener('click', () => {
        vibrarDispositivo(40);
        const senha = prompt('🔒 Senha de admin:');
        if (senha === SENHA_DEV) {
            localStorage.setItem(CHAVE_MANUTENCAO, 'false');
            document.getElementById('tela-manutencao').style.display = 'none';
            alert('✅ Acesso liberado!');
        } else if (senha !== null) alert('❌ Senha incorreta!');
    });

    const btnHamburguer = document.getElementById('btn-menu-hamburguer');
    const cardDev = document.getElementById('card-dev');
    btnHamburguer.addEventListener('click', () => {
        vibrarDispositivo(30);
        if (cardDev.style.display === 'none' || cardDev.style.display === '') {
            const senhaDigitada = prompt('🔒 Senha do Menu Dev:');
            if (senhaDigitada === SENHA_DEV) {
                cardDev.style.display = 'block';
                cardDev.scrollIntoView({ behavior: 'smooth' });
            } else if (senhaDigitada !== null) alert('❌ Incorreta!');
        } else cardDev.style.display = 'none';
    });

    document.getElementById('dev-tema-select').addEventListener('change', (e) => aplicarTema(e.target.value));

    const btnToggleManutencao = document.getElementById('btn-dev-toggle-manutencao');
    function atualizarTextoBtnManutencao() {
        const emManutencao = localStorage.getItem(CHAVE_MANUTENCAO) === 'true';
        btnToggleManutencao.textContent = emManutencao ? '🟢 Desativar Standby' : '🔴 Ativar Standby';
    }
    atualizarTextoBtnManutencao();
    btnToggleManutencao.addEventListener('click', () => {
        vibrarDispositivo(40);
        localStorage.setItem(CHAVE_MANUTENCAO, !(localStorage.getItem(CHAVE_MANUTENCAO) === 'true'));
        checarManutencao();
        atualizarTextoBtnManutencao();
    });

    document.getElementById('btn-dev-exportar-json').addEventListener('click', () => {
        vibrarDispositivo(40);
        const dados = Storage.obter();
        if (dados.length === 0) return alert('Sem registros!');
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `backup_ponto_${Date.now()}.json`;
        a.click();
    });

    const inputFileJson = document.getElementById('input-file-json');
    document.getElementById('btn-dev-importar-json').addEventListener('click', () => inputFileJson.click());
    inputFileJson.addEventListener('change', (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;
        const leitor = new FileReader();
        leitor.onload = function(evt) {
            try {
                const dadosImportados = JSON.parse(evt.target.result);
                if (Array.isArray(dadosImportados)) {
                    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dadosImportados));
                    renderizar();
                    alert('✅ Backup restaurado!');
                } else alert('JSON inválido.');
            } catch (err) { alert('Erro: ' + err.message); }
        };
        leitor.readAsText(arquivo);
    });

    const devTempoInput = document.getElementById('dev-tempo-ronda');
    devTempoInput.value = tempoRondaSegundos;
    devTempoInput.addEventListener('change', (e) => {
        tempoRondaSegundos = parseInt(e.target.value, 10) || 3600;
        localStorage.setItem(CHAVE_DEV_TEMPO, tempoRondaSegundos);
        if (statusServico === 'true') resetarTimerRonda();
    });

    document.getElementById('btn-dev-10s').addEventListener('click', () => {
        vibrarDispositivo(40);
        tempoRondaSegundos = 10;
        localStorage.setItem(CHAVE_DEV_TEMPO, 10);
        document.getElementById('dev-tempo-ronda').value = 10;
        resetarTimerRonda(10);
        alert('⚡ Timer configurado para 10 segundos!');
    });

    document.getElementById('btn-dev-disparar').addEventListener('click', () => {
        vibrarDispositivo([100, 50, 100]);
        localStorage.setItem(CHAVE_PROXIMA_RONDA, Date.now() - 1000);
        tocarAlarme();
        alert('🚨 Alerta de ronda simulado com sucesso!');
    });

    document.getElementById('btn-dev-mock').addEventListener('click', () => {
        vibrarDispositivo(40);
        const mocks = [
            { id: Date.now() - 3600000, tipo: "Entrada de Serviço", observacao: "Início de plantão teste", horario: "22:00", data: "21/09/2026", gps: null, foto: null },
            { id: Date.now() - 1800000, tipo: "Confirmar Plantão / Foto", observacao: "Ronda ok", horario: "23:00", data: "21/09/2026", gps: null, foto: null }
        ];
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(mocks));
        renderizar();
        alert('📦 Dados fictícios gerados!');
    });

    document.getElementById('btn-dev-reset').addEventListener('click', () => {
        vibrarDispositivo([100, 100]);
        if (confirm('⚠️ Tem certeza que deseja resetar tudo?')) {
            localStorage.clear();
            location.reload();
        }
    });
});

window.renderizar = function() {
    const lista = document.getElementById('lista-registros');
    const seletorData = document.getElementById('seletor-data-historico');
    const registros = Storage.obter();
    lista.innerHTML = '';

    if (registros.length === 0) {
        seletorData.innerHTML = '<option value="">Sem datas</option>';
        lista.innerHTML = '<p style="text-align:center; color:#8a99ad; font-size:0.8rem; padding:15px;">Nenhum registro.</p>';
        if (typeof window.atualizarCalculoSalario === 'function') window.atualizarCalculoSalario();
        return;
    }

    const datasUnicas = [...new Set(registros.map(r => r.data))];
    const dataAtual = seletorData.value && datasUnicas.includes(seletorData.value) ? seletorData.value : datasUnicas[0];

    seletorData.innerHTML = '';
    datasUnicas.forEach(data => {
        const opt = document.createElement('option');
        opt.value = data;
        opt.textContent = data;
        if (data === dataAtual) opt.selected = true;
        seletorData.appendChild(opt);
    });

    registros.filter(r => r.data === dataAtual).forEach(item => {
        const div = document.createElement('div');
        div.classList.add('item-registro');
        if (item.tipo.includes('Entrada') || item.tipo.includes('Retorno')) div.classList.add('entrada');
        if (item.tipo.includes('Médico') || item.tipo.includes('Almoço')) div.classList.add('almoco');
        if (item.tipo.includes('Final')) div.classList.add('saida');

        const thumb = item.foto ? `<img src="${item.foto}" class="item-thumb">` : `<div style="width:45px;height:45px;background:#111;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.55rem;color:#555;">SEM FOTO</div>`;
        const mapsLink = item.gps ? `<div class="item-gps"><a href="https://www.google.com/maps/search/?api=1&query=${item.gps.lat},${item.gps.lng}" target="_blank" rel="noopener noreferrer">📍 Ver Mapa</a></div>` : '';

        div.innerHTML = `
            ${thumb}
            <div class="item-info">
                <div class="item-header">
                    <span>${item.tipo}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span>${item.horario}</span>
                        <button onclick="apagarRegistroUnico(${item.id})" title="Apagar" style="background: none; border: none; cursor: pointer; font-size: 0.9rem;">🗑️</button>
                    </div>
                </div>
                ${item.observacao ? `<div class="item-obs">Obs: ${item.observacao}</div>` : ''}
                ${mapsLink}
            </div>
        `;
        lista.appendChild(div);
    });

    if (typeof window.atualizarCalculoSalario === 'function') window.atualizarCalculoSalario();
};

document.addEventListener('DOMContentLoaded', () => {
    const seletorDataEl = document.getElementById('seletor-data-historico');
    if (seletorDataEl) seletorDataEl.addEventListener('change', renderizar);
    renderizar();
});
// ==========================================
// BLOCO 3: REGISTRO DE PONTO, CÂMERA, GEOFENCING E PÂNICO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    function atualizarInterfaceStatus() {
        const badge = document.getElementById('status-badge');
        const btnToggle = document.getElementById('btn-toggle-servico');
        const cardPainel = document.getElementById('status-card-painel');
        const cardIcone = document.getElementById('status-card-icone');
        const cardTexto = document.getElementById('status-card-texto');

        if (statusServico === 'true') {
            badge.className = 'status-badge status-ativo';
            badge.textContent = '🟢 EM SERVIÇO / EM PLANTÃO';
            btnToggle.className = 'btn-servico-toggle btn-parar-servico';
            btnToggle.textContent = '⏹️ SAIR / FINALIZAR SERVIÇO';
            if (cardPainel) {
                cardPainel.style.borderLeft = '4px solid #10b981';
                cardIcone.textContent = '🟢';
                cardTexto.textContent = 'Em Serviço / Plantão Ativo';
                cardTexto.style.color = '#10b981';
            }
        } else if (statusServico === 'almoco') {
            badge.className = 'status-badge status-almoco';
            badge.textContent = '🟡 EM HORÁRIO DE REFEIÇÃO';
            btnToggle.className = 'btn-servico-toggle btn-iniciar-servico';
            btnToggle.textContent = '▶️ RETORNAR AO SERVIÇO';
            if (cardPainel) {
                cardPainel.style.borderLeft = '4px solid #f59e0b';
                cardIcone.textContent = '🟡';
                cardTexto.textContent = 'Em Horário de Refeição';
                cardTexto.style.color = '#f59e0b';
            }
        } else {
            badge.className = 'status-badge status-inativo';
            badge.textContent = '⚪ FORA DE SERVIÇO';
            btnToggle.className = 'btn-servico-toggle btn-iniciar-servico';
            btnToggle.textContent = '▶️ ENTRAR EM SERVIÇO';
            if (cardPainel) {
                cardPainel.style.borderLeft = '4px solid #6b7280';
                cardIcone.textContent = '⚪';
                cardTexto.textContent = 'Fora de Serviço';
                cardTexto.style.color = '#9ca3af';
            }
        }
    }
    atualizarInterfaceStatus();

    function registrarPontoAutomatico(tipo, obs = "") {
        vibrarDispositivo([60, 60]);
        const agora = new Date();
        const h = String(agora.getHours()).padStart(2, '0');
        const m = String(agora.getMinutes()).padStart(2, '0');
        const d = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const a = agora.getFullYear();

        if (tipo.includes('Almoço') || tipo.includes('Janta')) {
            statusServico = 'almoco';
            localStorage.setItem(CHAVE_STATUS, 'almoco');
            pararAlarme();
        } else if (tipo.includes('Retorno') || tipo.includes('Entrada')) {
            statusServico = 'true';
            localStorage.setItem(CHAVE_STATUS, 'true');
            if (!localStorage.getItem(CHAVE_PROXIMA_RONDA)) resetarTimerRonda();
        } else if (tipo.includes('Final')) {
            statusServico = 'false';
            localStorage.setItem(CHAVE_STATUS, 'false');
            pararAlarme();
            localStorage.removeItem(CHAVE_PROXIMA_RONDA);
        }

        atualizarInterfaceStatus();

        const salvarItem = (gpsInfo = null) => {
            let observacaoFinal = obs;
            const configGeo = JSON.parse(localStorage.getItem(CHAVE_GEOFENCING));
            if (configGeo && configGeo.lat && configGeo.lng && gpsInfo) {
                const distancia = calcularDistanciaMetros(configGeo.lat, configGeo.lng, gpsInfo.lat, gpsInfo.lng);
                if (distancia > configGeo.raio) {
                    const alertaGeo = `[ALERTA GEOFENCING: Fora do posto a ${Math.round(distancia)}m]`;
                    observacaoFinal = observacaoFinal ? `${observacaoFinal} - ${alertaGeo}` : alertaGeo;
                }
            }

            const novoItem = {
                id: Date.now(),
                tipo: tipo,
                observacao: observacaoFinal,
                horario: `${h}:${m}`,
                data: `${d}/${mes}/${a}`,
                gps: gpsInfo,
                foto: fotoBase64
            };

            Storage.salvar(novoItem);
            fotoBase64 = null;
            if (streamCamera) {
                streamCamera.getTracks().forEach(track => track.stop());
                streamCamera = null;
            }
            document.getElementById('camera-box').style.display = 'none';
            renderizar();
        };

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => salvarItem({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => salvarItem(null),
                { timeout: 4000, enableHighAccuracy: true }
            );
        } else salvarItem(null);
    }

    let timerPanico = null;
    const btnPanico = document.getElementById('btn-panico');
    if (btnPanico) {
        const dispararPanico = () => {
            vibrarDispositivo([300, 100, 300, 100, 300]);
            tocarAlarme();
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    const linkMaps = `https://maps.google.com/?q=${lat},${lng}`;
                    const vigiaNome = document.getElementById('nome-vigia').value || 'Vigia Noturno';
                    const postoNome = document.getElementById('posto-trabalho').value || 'Posto';
                    
                    const mensagem = `🚨 *EMERGÊNCIA / MODO PÂNICO ACIONADO!* 🚨\n👤 Vigia: ${vigiaNome}\n📍 Posto: ${postoNome}\n⚠️ Preciso de ajuda urgente neste local!\n🗺️ Localização exata: ${linkMaps}`;
                    
                    registrarPontoAutomatico('🚨 ALERTA DE PÂNICO', 'Acionado botão de emergência com compartilhamento de GPS.');
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, '_blank');
                }, () => {
                    alert('⚠️ Pânico acionado, mas não foi possível obter o GPS.');
                }, { timeout: 5000, enableHighAccuracy: true });
            } else {
                alert('🚨 PÂNICO ACIONADO! Geolocalização indisponível.');
            }
        };

        ['mousedown', 'touchstart'].forEach(evt => {
            btnPanico.addEventListener(evt, (e) => {
                e.preventDefault();
                btnPanico.style.background = '#ff0055';
                timerPanico = setTimeout(dispararPanico, 3000);
            });
        });

        ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
            btnPanico.addEventListener(evt, () => {
                btnPanico.style.background = '';
                if (timerPanico) {
                    clearTimeout(timerPanico);
                    timerPanico = null;
                }
            });
        });
    }

    document.getElementById('btn-toggle-servico').addEventListener('click', () => {
        inicializarAudioContext();
        if (statusServico === 'true') registrarPontoAutomatico('Final de Expediente / Saída', 'Saída do plantão.');
        else if (statusServico === 'almoco') registrarPontoAutomatico('Retorno - Almoço', 'Retorno da refeição.');
        else registrarPontoAutomatico('Entrada de Serviço', 'Início de plantão.');
    });

    setInterval(() => {
        const agora = new Date();
        document.getElementById('relogio').textContent = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;
        document.getElementById('data').textContent = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`;
    }, 1000);

    setInterval(() => {
        const timerElem = document.getElementById('ronda-timer');
        const cardElem = document.getElementById('ronda-card');

        if (statusServico === 'false' || statusServico === 'almoco') {
            timerElem.textContent = statusServico === 'false' ? "PAUSADO" : "PAUSADO (Refeição)";
            cardElem.classList.remove('ronda-alerta');
            pararAlarme();
            return;
        }

        let proximaRonda = parseInt(localStorage.getItem(CHAVE_PROXIMA_RONDA), 10);
        if (!proximaRonda || isNaN(proximaRonda)) {
            resetarTimerRonda();
            proximaRonda = parseInt(localStorage.getItem(CHAVE_PROXIMA_RONDA), 10);
        }

        const tempoRestante = Math.floor((proximaRonda - Date.now()) / 1000);

        if (tempoRestante > 0) {
            const hh = String(Math.floor(tempoRestante / 3600)).padStart(2, '0');
            const mm = String(Math.floor((tempoRestante % 3600) / 60)).padStart(2, '0');
            const ss = String(tempoRestante % 60).padStart(2, '0');
            timerElem.textContent = `${hh}:${mm}:${ss}`;
        } else {
            timerElem.textContent = "🔔 MANDAR FOTO NO GRUPO!";
            if (!cardElem.classList.contains('ronda-alerta')) {
                cardElem.classList.add('ronda-alerta');
                tocarAlarme();
                vibrarDispositivo([150, 100, 150]);
            }
        }
    }, 1000);

    document.getElementById('btn-confirmar-ronda').addEventListener('click', () => {
        vibrarDispositivo(50);
        inicializarAudioContext();
        if (statusServico !== 'true') return alert('Você precisa estar em serviço!');
        resetarTimerRonda();
        pararAlarme();
        document.getElementById('ronda-card').classList.remove('ronda-alerta');
        registrarPontoAutomatico('Confirmar Plantão / Foto', 'Plantão e foto confirmados.');
        alert('Plantão e foto confirmados!');
    });

    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const btnCapturar = document.getElementById('btn-capturar-foto');
    const cameraBox = document.getElementById('camera-box');

    document.getElementById('btn-abrir-camera').addEventListener('click', async () => {
        vibrarDispositivo(40);
        try {
            streamCamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "environment" } } });
            video.srcObject = streamCamera;
            await video.play();
            cameraBox.style.display = 'block';
            video.style.display = 'block';
            canvas.style.display = 'none';
            btnCapturar.style.display = 'block';
        } catch (err) { alert('Erro na câmera: ' + err.message); }
    });

    btnCapturar.addEventListener('click', () => {
        vibrarDispositivo(80);
        // Diminuído para 200x150 e qualidade 0.3 para evitar Erro 500 no Supabase por excesso de peso na Base64
        canvas.width = 200;
        canvas.height = 150;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        fotoBase64 = canvas.toDataURL('image/jpeg', 0.3);
        video.style.display = 'none';
        canvas.style.display = 'block';
        btnCapturar.style.display = 'none';
        alert('Foto capturada e comprimida com sucesso!');
    });

    document.getElementById('btn-registrar').addEventListener('click', () => {
        inicializarAudioContext();
        registrarPontoAutomatico(document.getElementById('tipo-registro').value, document.getElementById('observacao').value.trim());
        document.getElementById('observacao').value = '';
    });

    document.getElementById('btn-whatsapp').addEventListener('click', () => {
        vibrarDispositivo(40);
        const dataFiltro = document.getElementById('seletor-data-historico').value;
        const registros = Storage.obter().filter(r => r.data === dataFiltro);
        if (registros.length === 0) return alert('Sem registros!');

        let texto = `*FOLHA DE PONTO*\n👤 ${document.getElementById('nome-vigia').value || 'N/I'}\n📍 ${document.getElementById('posto-trabalho').value || 'N/I'}\n📅 ${dataFiltro}\n------------------\n`;
        registros.slice().reverse().forEach(r => {
            texto += `• *${r.horario}* - ${r.tipo}\n`;
            if (r.observacao) texto += `  _Obs: ${r.observacao}_\n`;
        });
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
    });

    document.getElementById('btn-excel').addEventListener('click', () => {
        vibrarDispositivo(40);
        const registros = Storage.obter();
        if (registros.length === 0) return alert('Sem registros!');
        let csv = 'Data,Horario,Tipo,Observacao\n';
        registros.forEach(r => { csv += `"${r.data}","${r.horario}","${r.tipo}","${r.observacao || ''}"\n`; });
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `Ponto_${Date.now()}.csv`;
        a.click();
    });

    document.getElementById('btn-imprimir').addEventListener('click', () => { vibrarDispositivo(40); window.print(); });
    document.getElementById('btn-limpar').addEventListener('click', () => {
        vibrarDispositivo([100, 50, 100]);
        if (confirm('Deseja limpar todo o histórico?')) { Storage.limpar(); renderizar(); }
    });
});
// ==========================================
// BLOCO 4: SUPABASE, SUPERVISÃO, REALTIME E PASSAGEM DE PLANTÃO
// ==========================================
const SUPABASE_URL = 'https://sgammtgdylghphufkidfi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YRz40KFT9DTNqBQooNRGPw_kpU2PhYi';
const SENHA_SUPERVISOR = "9988"; 
const CHAVE_DIRETRIZ = 'ponto_vigia_diretriz_supervisor';

let supabaseClient = null;

try {
    if (window.supabase && SUPABASE_URL) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('🟢 Supabase inicializado com sucesso!');
    }
} catch (erro) {
    console.warn('⚠️ Erro ao inicializar Supabase.', erro);
}

function atualizarBannerDiretriz(texto) {
    const bannerDiretriz = document.getElementById('banner-diretriz-vigia');
    const txtDiretrizRecebida = document.getElementById('txt-diretriz-recebida');
    
    if (txtDiretrizRecebida) {
        txtDiretrizRecebida.textContent = texto;
    }
    if (bannerDiretriz) {
        bannerDiretriz.style.display = 'block';
    }
    localStorage.setItem(CHAVE_DIRETRIZ, texto);
}

function inicializarRealtimeDiretrizes() {
    if (!supabaseClient) return;

    supabaseClient
        .channel('public:diretrizes_supervisao')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diretrizes_supervisao' }, payload => {
            if (payload && payload.new && payload.new.mensagem) {
                atualizarBannerDiretriz(payload.new.mensagem);
                vibrarDispositivo([100, 50, 100]);
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("📢 Nova Diretriz da Supervisão", { body: payload.new.mensagem });
                }
            }
        })
        .subscribe((status) => {
            console.log('Status Realtime Diretrizes:', status);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    const btnMenuSup = document.getElementById('btn-menu-supervisao');
    const cardSup = document.getElementById('card-supervisao');
    const btnFecharSup = document.getElementById('btn-fechar-supervisao');
    const btnEnviarDiretriz = document.getElementById('btn-enviar-diretriz');
    const textoDiretriz = document.getElementById('texto-diretriz-supervisor');
    const listaSupEquipe = document.getElementById('lista-supervisao-equipe');
    
    const diretrizSalva = localStorage.getItem(CHAVE_DIRETRIZ);
    if (diretrizSalva) {
        atualizarBannerDiretriz(diretrizSalva);
    }

    inicializarRealtimeDiretrizes();

    if (btnMenuSup && cardSup) {
        btnMenuSup.addEventListener('click', () => {
            vibrarDispositivo(30);
            const senha = prompt('🔒 Digite a senha do Supervisor:');
            if (senha === SENHA_SUPERVISOR) {
                cardSup.style.display = 'block';
                cardSup.scrollIntoView({ behavior: 'smooth' });
                carregarDadosSupervisao();
            } else if (senha !== null) {
                alert('❌ Senha de supervisor incorreta!');
            }
        });
    }

    if (btnFecharSup && cardSup) {
        btnFecharSup.addEventListener('click', () => {
            cardSup.style.display = 'none';
        });
    }

    async function carregarDadosSupervisao() {
        if (!supabaseClient) {
            listaSupEquipe.innerHTML = '<p style="color: #f1c40f; text-align:center;">Modo Offline / Sem Supabase configurado.</p>';
            return;
        }
        listaSupEquipe.innerHTML = '<p style="color: #8a99ad; text-align:center;">Buscando dados da equipe...</p>';
        try {
            const { data, error } = await supabaseClient
                .from('registros_ponto')
                .select('*')
                .order('id_unico', { ascending: false })
                .limit(10);

            if (error) throw error;
            if (!data || data.length === 0) {
                listaSupEquipe.innerHTML = '<p style="color: #8a99ad; text-align:center;">Nenhum registro recente na nuvem.</p>';
                return;
            }

            let html = '';
            data.forEach(reg => {
                html += `<div style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; margin-bottom: 4px; border-left: 2px solid var(--cor-primaria);">
                    <strong>👤 ${reg.vigia || 'Desconhecido'}</strong> (${reg.posto || 'Posto N/I'})<br>
                    <span style="color: var(--cor-primaria);">${reg.tipo}</span> - ${reg.horario} (${reg.data})
                </div>`;
            });
            listaSupEquipe.innerHTML = html;
        } catch (e) {
            listaSupEquipe.innerHTML = '<p style="color: #ef4444; text-align:center;">Erro ao carregar dados da nuvem.</p>';
        }
    }

    if (btnEnviarDiretriz && textoDiretriz) {
        btnEnviarDiretriz.addEventListener('click', async () => {
            vibrarDispositivo(40);
            const diretriz = textoDiretriz.value.trim();
            if (!diretriz) return alert('Digite a diretriz para a equipe!');

            atualizarBannerDiretriz(diretriz);

            if (supabaseClient) {
                try {
                    const { error } = await supabaseClient.from('diretrizes_supervisao').insert([{
                        mensagem: diretriz,
                        criado_em: new Date().toISOString()
                    }]);
                    
                    if (error) {
                        console.error('Erro detalhado Supabase:', error);
                        alert('⚠️ Erro ao salvar na nuvem: ' + error.message);
                    } else {
                        alert('✅ Diretriz enviada e salva na nuvem com sucesso!');
                    }
                } catch (e) {
                    console.error('Exceção ao enviar:', e);
                    alert('❌ Falha de conexão com o Supabase.');
                }
            } else {
                alert('⚠️ Supabase não configurado neste ambiente.');
            }

            textoDiretriz.value = '';
        });
    }
});

// --- MÓDULO: PASSAGEM DE PLANTÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const txtPassagem = document.getElementById('texto-passagem-plantao');
    const btnSalvarPassagem = document.getElementById('btn-salvar-passagem');
    const painelRecado = document.getElementById('painel-recado-anterior');
    const txtRecadoLido = document.getElementById('txt-recado-lido');

    const recadoSalvo = localStorage.getItem(CHAVE_PASSAGEM_PLANTAO);
    if (recadoSalvo && painelRecado && txtRecadoLido) {
        txtRecadoLido.textContent = recadoSalvo;
        painelRecado.style.display = 'block';
    }

    if (btnSalvarPassagem && txtPassagem) {
        btnSalvarPassagem.addEventListener('click', async () => {
            vibrarDispositivo(40);
            const texto = txtPassagem.value.trim();
            if (!texto) return alert('Digite algum recado para o próximo turno!');
            
            localStorage.setItem(CHAVE_PASSAGEM_PLANTAO, texto);
            if (txtRecadoLido) txtRecadoLido.textContent = texto;
            if (painelRecado) painelRecado.style.display = 'block';
            
            if (supabaseClient) {
                try {
                    await supabaseClient.from('passagem_plantao').insert([{
                        vigia: document.getElementById('nome-vigia')?.value || 'Não informado',
                        posto: document.getElementById('posto-trabalho')?.value || 'Não informado',
                        recado: texto,
                        criado_em: new Date().toISOString()
                    }]);
                } catch (e) {}
            }

            txtPassagem.value = '';
            alert('✅ Recado de passagem de plantão salvo com sucesso!');
        });
    }
});

// --- STORAGE NA NUVEM ---
const StorageNuvem = {
    async salvarNaNuvem(item) {
        if (!supabaseClient) return false;
        try {
            const { error } = await supabaseClient
                .from('registros_ponto')
                .insert([
                    {
                        id_unico: item.id,
                        vigia: document.getElementById('nome-vigia')?.value || 'Não informado',
                        posto: document.getElementById('posto-trabalho')?.value || 'Não informado',
                        tipo: item.tipo,
                        observacao: item.observacao,
                        horario: item.horario,
                        data: item.data,
                        gps: item.gps ? JSON.stringify(item.gps) : null,
                        foto: item.foto 
                    }
                ]);
            if (error) {
                console.error('Erro ao salvar na nuvem:', error);
                return false;
            }
            return true;
        } catch (err) {
            console.error('Exceção ao salvar na nuvem:', err);
            return false;
        }
    },

    async sincronizarPendentes() {
        if (!navigator.onLine || !supabaseClient) return;
        const fila = obterFilaOffline();
        if (fila.length === 0) return;

        let novosPendentes = [];
        for (let item of fila) {
            const sucesso = await this.salvarNaNuvem(item);
            if (!sucesso) novosPendentes.push(item);
        }
        localStorage.setItem(CHAVE_FILA_OFFLINE, JSON.stringify(novosPendentes));
        atualizarStatusSistema();
    }
};

window.addEventListener('online', () => {
    StorageNuvem.sincronizarPendentes();
});
