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
const SENHA_DEV = "3691";

let tempoRondaSegundos = parseInt(localStorage.getItem(CHAVE_DEV_TEMPO), 10) || 3600;

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
                infoConexao.innerHTML = `🟡 <span style="color: #f1c40f;">●</span> Sincronizando (${qtdFila} pendente${qtdFila > 1 ? 's' : ''})...`;
            } else {
                infoConexao.innerHTML = `🟢 <span style="color: #2ecc71;">●</span> Online (Sincronizado: ${totalRegistros})`;
            }
        } else {
            infoConexao.innerHTML = `🔴 <span style="color: #e74c3c;">●</span> Offline - Modo Local (${qtdFila} na fila)`;
        }
    }

    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            const nivel = Math.round(battery.level * 100);
            infoBateria.textContent = `🔋 Bateria: ${nivel}%`;
        }).catch(() => { infoBateria.textContent = "🔋 Bateria: N/D"; });
    } else {
        infoBateria.textContent = "";
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
    },
    limpar() {
        localStorage.removeItem(CHAVE_STORAGE);
        localStorage.removeItem(CHAVE_BACKUP);
        localStorage.removeItem(CHAVE_FILA_OFFLINE);
    }
};

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
        } catch (e) { console.warn(e); }
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

setInterval(() => {
    if (statusServico !== 'true') return;
    const configGeo = JSON.parse(localStorage.getItem(CHAVE_GEOFENCING));
    if (!configGeo || !configGeo.lat || !configGeo.lng) return;

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const distancia = calcularDistanciaMetros(configGeo.lat, configGeo.lng, pos.coords.latitude, pos.coords.longitude);
            if (distancia > configGeo.raio) {
                tocarAlarme();
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("🚨 ALERTA DE AFASTAMENTO!", { body: `Você saiu do raio do posto! Distância: ${Math.round(distancia)}m` });
                }
            }
        }, () => {}, { timeout: 5000, enableHighAccuracy: true });
    }
}, 60000);
// ==========================================
// BLOCO 2: CONFIGURAÇÃO DE UI E MENU DEV COMPLETO
// ==========================================

// Função global para calcular salário, metas e a sequência (streak) de plantões
window.atualizarCalculoSalario = function() {
    let valorPorPlantao = parseFloat(localStorage.getItem(CHAVE_VALOR_PLANTAO)) || 100.00;
    let metaSalario = parseFloat(localStorage.getItem(CHAVE_META_SALARIO)) || 1000.00;
    
    const registros = Storage.obter();
    const entradas = registros.filter(r => r.tipo && r.tipo.includes('Entrada de Serviço'));
    const plantoesRealizados = entradas.length;
    const totalAcumulado = plantoesRealizados * valorPorPlantao;

    // Cálculo da Sequência (Streak) de Plantões Consecutivos
    let streakCount = 0;
    if (entradas.length > 0) {
        // Extrai datas únicas ordenadas da mais recente para a mais antiga
        const datasUnicas = [...new Set(entradas.map(r => r.data))];
        
        // Função auxiliar para converter "DD/MM/AAAA" em objeto Date zerado
        const parseDataBR = (strData) => {
            const partes = strData.split('/');
            return new Date(partes[2], partes[1] - 1, partes[0]);
        };

        if (datasUnicas.length > 0) {
            let dataEsperada = parseDataBR(datasUnicas[0]);
            let hoje = new Date();
            hoje.setHours(0,0,0,0);
            let ultimaData = parseDataBR(datasUnicas[0]);
            ultimaData.setHours(0,0,0,0);

            // Verifica se o último plantão ocorreu hoje ou ontem para manter o streak ativo
            const diffDiasUltimo = Math.round((hoje - ultimaData) / (1000 * 60 * 60 * 24));
            
            if (diffDiasUltimo <= 1) {
                streakCount = 1;
                let dataChecagem = new Date(ultimaData);

                for (let i = 1; i < datasUnicas.length; i++) {
                    dataChecagem.setDate(dataChecagem.getDate() - 1);
                    let dataAnteriorBanco = parseDataBR(datasUnicas[i]);
                    dataAnteriorBanco.setHours(0,0,0,0);

                    if (dataAnteriorBanco.getTime() === dataChecagem.getTime()) {
                        streakCount++;
                    } else {
                        break;
                    }
                }
            }
        }
    }

    const elPlantoes = document.getElementById('total-plantoes');
    const elTxtValor = document.getElementById('txt-valor-plantao');
    const elTotalSalario = document.getElementById('total-salario');
    const elTxtMeta = document.getElementById('txt-meta-salario');
    const elBarra = document.getElementById('barra-progresso-meta');
    const elStreak = document.getElementById('streak-plantoes'); // Elemento opcional de UI para o streak

    if (elPlantoes) elPlantoes.textContent = plantoesRealizados;
    if (elTxtValor) elTxtValor.textContent = `R$ ${valorPorPlantao.toFixed(2).replace('.', ',')}`;
    if (elTotalSalario) elTotalSalario.textContent = `R$ ${totalAcumulado.toFixed(2).replace('.', ',')}`;
    if (elTxtMeta) elTxtMeta.textContent = `R$ ${metaSalario.toFixed(2).replace('.', ',')}`;
    if (elStreak) elStreak.textContent = streakCount;

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
        localStorage.setItem(CHAVE_MANUTENCAO, !(localStorage.getItem(CHAVE_MANUTENCAO) === 'true'));
        checarManutencao();
        atualizarTextoBtnManutencao();
    });

    document.getElementById('btn-dev-exportar-json').addEventListener('click', () => {
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

    const btnDev10s = document.getElementById('btn-dev-10s');
    if (btnDev10s) {
        btnDev10s.addEventListener('click', () => {
            tempoRondaSegundos = 10;
            localStorage.setItem(CHAVE_DEV_TEMPO, 10);
            if(document.getElementById('dev-tempo-ronda')) document.getElementById('dev-tempo-ronda').value = 10;
            resetarTimerRonda(10);
            alert('⚡ Timer configurado para 10 segundos!');
        });
    }

    const btnDevDisparar = document.getElementById('btn-dev-disparar');
    if (btnDevDisparar) {
        btnDevDisparar.addEventListener('click', () => {
            localStorage.setItem(CHAVE_PROXIMA_RONDA, Date.now() - 1000);
            tocarAlarme();
            alert('🚨 Alerta de ronda simulado com sucesso!');
        });
    }

    const btnDevMock = document.getElementById('btn-dev-mock');
    if (btnDevMock) {
        btnDevMock.addEventListener('click', () => {
            const mocks = [
                { id: Date.now() - 3600000, tipo: "Entrada de Serviço", observacao: "Início de plantão teste", horario: "22:00", data: "21/09/2026", gps: null, foto: null },
                { id: Date.now() - 1800000, tipo: "Confirmar Plantão / Foto", observacao: "Ronda ok", horario: "23:00", data: "21/09/2026", gps: null, foto: null }
            ];
            localStorage.setItem(CHAVE_STORAGE, JSON.stringify(mocks));
            if (typeof renderizar === 'function') renderizar();
            alert('📦 Dados fictícios (Mock) gerados!');
        });
    }

    const btnDevReset = document.getElementById('btn-dev-reset');
    if (btnDevReset) {
        btnDevReset.addEventListener('click', () => {
            if (confirm('⚠️ Tem certeza que deseja resetar todas as configurações e dados salvos?')) {
                localStorage.clear();
                location.reload();
            }
        });
    }
});
// ==========================================
// BLOCO 3: REGISTRO DE PONTO, CÂMERA E RELÓGIO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    function atualizarInterfaceStatus() {
        const badge = document.getElementById('status-badge');
        const btnToggle = document.getElementById('btn-toggle-servico');

        if (statusServico === 'true') {
            badge.className = 'status-badge status-ativo';
            badge.textContent = '🟢 EM SERVIÇO / EM PLANTÃO';
            btnToggle.className = 'btn-servico-toggle btn-parar-servico';
            btnToggle.textContent = '⏹️ SAIR / FINALIZAR SERVIÇO';
        } else if (statusServico === 'almoco') {
            badge.className = 'status-badge status-almoco';
            badge.textContent = '🟡 EM HORÁRIO DE REFEIÇÃO';
            btnToggle.className = 'btn-servico-toggle btn-iniciar-servico';
            btnToggle.textContent = '▶️ RETORNAR AO SERVIÇO';
        } else {
            badge.className = 'status-badge status-inativo';
            badge.textContent = '⚪ FORA DE SERVIÇO';
            btnToggle.className = 'btn-servico-toggle btn-iniciar-servico';
            btnToggle.textContent = '▶️ ENTRAR EM SERVIÇO';
        }
    }
    atualizarInterfaceStatus();

    function registrarPontoAutomatico(tipo, obs = "") {
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
            if (!localStorage.getItem(CHAVE_PROXIMA_RONDA)) {
                resetarTimerRonda();
            }
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

    window.renderizar = function() {
        const lista = document.getElementById('lista-registros');
        const seletorData = document.getElementById('seletor-data-historico');
        const registros = Storage.obter();
        lista.innerHTML = '';

        if (registros.length === 0) {
            seletorData.innerHTML = '<option value="">Sem datas</option>';
            lista.innerHTML = '<p style="text-align:center; color:#8a99ad; font-size:0.8rem; padding:15px;">Nenhum registro.</p>';
            
            if (typeof window.atualizarCalculoSalario === 'function') {
                window.atualizarCalculoSalario();
            }
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
                    <div class="item-header"><span>${item.tipo}</span><span>${item.horario}</span></div>
                    ${item.observacao ? `<div class="item-obs">Obs: ${item.observacao}</div>` : ''}
                    ${mapsLink}
                </div>
            `;
            lista.appendChild(div);
        });

        if (typeof window.atualizarCalculoSalario === 'function') {
            window.atualizarCalculoSalario();
        }
    };
    renderizar();

    document.getElementById('seletor-data-historico').addEventListener('change', renderizar);

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
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("⏰ HORA DA FOTO NO GRUPO!", { 
                        body: "Já passou o tempo! Envie a foto no grupo e confirme no app.",
                        icon: "https://cdn-icons-png.flaticon.com/512/3602/3602123.png"
                    });
                }
            }
        }
    }, 1000);

    document.getElementById('btn-confirmar-ronda').addEventListener('click', () => {
        inicializarAudioContext();
        if (statusServico !== 'true') return alert('Você precisa estar em serviço!');
        resetarTimerRonda();
        pararAlarme();
        document.getElementById('ronda-card').classList.remove('ronda-alerta');
        registrarPontoAutomatico('Confirmar Plantão / Foto', 'Plantão e foto confirmados.');
        alert('Plantão e foto confirmados! Próximo lembrete recalculado.');
    });

    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const btnCapturar = document.getElementById('btn-capturar-foto');
    const cameraBox = document.getElementById('camera-box');

    document.getElementById('btn-abrir-camera').addEventListener('click', async () => {
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
        canvas.width = 300;
        canvas.height = 225;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);
        video.style.display = 'none';
        canvas.style.display = 'block';
        btnCapturar.style.display = 'none';
        alert('Foto capturada!');
    });

    document.getElementById('btn-registrar').addEventListener('click', () => {
        inicializarAudioContext();
        registrarPontoAutomatico(document.getElementById('tipo-registro').value, document.getElementById('observacao').value.trim());
        document.getElementById('observacao').value = '';
    });
    document.getElementById('btn-whatsapp').addEventListener('click', () => {
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
        const registros = Storage.obter();
        if (registros.length === 0) return alert('Sem registros!');
        let csv = 'Data,Horario,Tipo,Observacao\n';
        registros.forEach(r => { csv += `"${r.data}","${r.horario}","${r.tipo}","${r.observacao || ''}"\n`; });
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `Ponto_${Date.now()}.csv`;
        a.click();
    });

    document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
    document.getElementById('btn-limpar').addEventListener('click', () => {
        if (confirm('Deseja limpar todo o histórico?')) { Storage.limpar(); renderizar(); }
    });
});
