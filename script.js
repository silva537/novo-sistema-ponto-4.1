const CHAVE_STORAGE = 'ponto_vigia_v5';
const CHAVE_STATUS = 'ponto_vigia_status_servico';
const CHAVE_PROXIMA_RONDA = 'ponto_vigia_proxima_ronda';
const CHAVE_DEV_TEMPO = 'ponto_vigia_dev_tempo_ronda';
const CHAVE_MANUTENCAO = 'ponto_vigia_modo_manutencao';
const CHAVE_TEMA = 'ponto_vigia_tema';
const CHAVE_VALOR_PLANTAO = 'ponto_vigia_valor_plantao';
const CHAVE_META_SALARIO = 'ponto_vigia_meta_salario';
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
        infoConexao.textContent = navigator.onLine ? "🌐 Online" : "🔴 Offline";
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
setInterval(atualizarStatusSistema, 5000);
window.addEventListener('online', atualizarStatusSistema);
window.addEventListener('offline', atualizarStatusSistema);

const Storage = {
    obter() {
        const dados = localStorage.getItem(CHAVE_STORAGE);
        return dados ? JSON.parse(dados) : [];
    },
    salvar(item) {
        const registros = this.obter();
        registros.unshift(item);
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(registros));
    },
    limpar() {
        localStorage.removeItem(CHAVE_STORAGE);
    }
};

let fotoBase64 = null;
let audioContext = null;
let alarmInterval = null;
let streamCamera = null;
let statusServico = localStorage.getItem(CHAVE_STATUS) || 'false';

function checarManutencao() {
    const emManutencao = localStorage.getItem(CHAVE_MANUTENCAO) === 'true';
    const tela = document.getElementById('tela-manutencao');
    if (tela) {
        tela.style.display = emManutencao ? 'flex' : 'none';
    }
}
setInterval(checarManutencao, 1000);

function inicializarAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
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
        } catch (e) {
            console.warn("Erro ao tocar alarme:", e);
        }
    }, 800);
}

function pararAlarme() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}

function resetarTimerRonda(segundosCustom = null) {
    const segundos = segundosCustom || tempoRondaSegundos;
    const proximaRonda = Date.now() + (segundos * 1000);
    localStorage.setItem(CHAVE_PROXIMA_RONDA, proximaRonda);
}

document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    checarManutencao();
    atualizarStatusSistema();

    let valorPorPlantao = parseFloat(localStorage.getItem(CHAVE_VALOR_PLANTAO)) || 100.00;
    let metaSalario = parseFloat(localStorage.getItem(CHAVE_META_SALARIO)) || 1000.00;

    function atualizarCalculoSalario() {
        const registros = Storage.obter();
        const plantoesRealizados = registros.filter(r => r.tipo.includes('Entrada de Serviço')).length;
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
    }

    const btnAjustarValor = document.getElementById('btn-ajustar-valor');
    if (btnAjustarValor) {
        btnAjustarValor.addEventListener('click', () => {
            const novoValor = prompt(`💵 Digite o valor recebido por plantão (Atual: R$ ${valorPorPlantao}):`, valorPorPlantao);
            if (novoValor !== null) {
                const parsed = parseFloat(novoValor.replace(',', '.'));
                if (!isNaN(parsed) && parsed >= 0) {
                    valorPorPlantao = parsed;
                    localStorage.setItem(CHAVE_VALOR_PLANTAO, valorPorPlantao);
                    atualizarCalculoSalario();
                    alert(`✅ Valor por plantão atualizado para R$ ${valorPorPlantao.toFixed(2).replace('.', ',')}`);
                } else {
                    alert('❌ Valor inválido!');
                }
            }
        });
    }

    const btnAjustarMeta = document.getElementById('btn-ajustar-meta');
    if (btnAjustarMeta) {
        btnAjustarMeta.addEventListener('click', () => {
            const novaMeta = prompt(`🎯 Digite o valor da sua meta salarial (Atual: R$ ${metaSalario}):`, metaSalario);
            if (novaMeta !== null) {
                const parsed = parseFloat(novaMeta.replace(',', '.'));
                if (!isNaN(parsed) && parsed >= 0) {
                    metaSalario = parsed;
                    localStorage.setItem(CHAVE_META_SALARIO, metaSalario);
                    atualizarCalculoSalario();
                    alert(`✅ Meta salarial atualizada para R$ ${metaSalario.toFixed(2).replace('.', ',')}`);
                } else {
                    alert('❌ Valor inválido!');
                }
            }
        });
    }

    document.getElementById('nome-vigia').value = localStorage.getItem('vigia_nome') || '';
    document.getElementById('posto-trabalho').value = localStorage.getItem('vigia_posto') || '';

    document.getElementById('nome-vigia').addEventListener('input', (e) => localStorage.setItem('vigia_nome', e.target.value));
    document.getElementById('posto-trabalho').addEventListener('input', (e) => localStorage.setItem('vigia_posto', e.target.value));

    document.getElementById('btn-desbloquear-manutencao').addEventListener('click', () => {
        const senha = prompt('🔒 Digite a senha de administrador (3691) para acessar o painel:');
        if (senha === SENHA_DEV) {
            localStorage.setItem(CHAVE_MANUTENCAO, 'false');
            document.getElementById('tela-manutencao').style.display = 'none';
            alert('✅ Acesso liberado! Modo manutenção desativado.');
        } else if (senha !== null) {
            alert('❌ Senha incorreta!');
        }
    });

    const btnHamburguer = document.getElementById('btn-menu-hamburguer');
    const cardDev = document.getElementById('card-dev');

    btnHamburguer.addEventListener('click', () => {
        if (cardDev.style.display === 'none' || cardDev.style.display === '') {
            const senhaDigitada = prompt('🔒 Digite a senha (3691) para acessar o Menu Dev:');
            if (senhaDigitada === SENHA_DEV) {
                cardDev.style.display = 'block';
                cardDev.scrollIntoView({ behavior: 'smooth' });
                alert('✅ Menu Dev aberto com sucesso!');
            } else if (senhaDigitada !== null) {
                alert('❌ Senha incorreta! Acesso negado.');
            }
        } else {
            cardDev.style.display = 'none';
        }
    });
    document.getElementById('dev-tema-select').addEventListener('change', (e) => {
        aplicarTema(e.target.value);
    });

    const btnToggleManutencao = document.getElementById('btn-dev-toggle-manutencao');
    function atualizarTextoBtnManutencao() {
        const emManutencao = localStorage.getItem(CHAVE_MANUTENCAO) === 'true';
        btnToggleManutencao.textContent = emManutencao ? '🟢 Desativar Standby' : '🔴 Ativar Standby (Manutenção)';
    }
    atualizarTextoBtnManutencao();

    btnToggleManutencao.addEventListener('click', () => {
        const atual = localStorage.getItem(CHAVE_MANUTENCAO) === 'true';
        const novoEstado = !atual;
        localStorage.setItem(CHAVE_MANUTENCAO, novoEstado);
        checarManutencao();
        atualizarTextoBtnManutencao();
        alert(novoEstado ? '⚠️ Aplicativo colocado em Modo Standby!' : '🟢 Aplicativo liberado!');
    });

    document.getElementById('btn-dev-exportar-json').addEventListener('click', () => {
        const dados = Storage.obter();
        if (dados.length === 0) return alert('Sem registros para exportar!');
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `backup_ponto_vigia_${Date.now()}.json`;
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
                    alert('✅ Backup restaurado com sucesso!');
                } else {
                    alert('❌ Arquivo JSON inválido.');
                }
            } catch (err) {
                alert('❌ Erro ao ler o arquivo JSON: ' + err.message);
            }
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
        tempoRondaSegundos = 10;
        devTempoInput.value = 10;
        localStorage.setItem(CHAVE_DEV_TEMPO, 10);
        if (statusServico === 'true') resetarTimerRonda(10);
        alert('[Dev] Timer de Ronda setado para 10 segundos!');
    });

    document.getElementById('btn-dev-disparar').addEventListener('click', () => {
        statusServico = 'true';
        localStorage.setItem(CHAVE_STATUS, 'true');
        atualizarInterfaceStatus();
        localStorage.setItem(CHAVE_PROXIMA_RONDA, Date.now() - 1000);
    });

    document.getElementById('btn-dev-mock').addEventListener('click', () => {
        Storage.salvar({ id: Date.now() - 3600000, tipo: 'Entrada de Serviço', observacao: '[TESTE DEV]', horario: '22:00', data: '21/09/2026', gps: null, foto: null });
        renderizar();
        alert('[Dev] Registros de teste inseridos!');
    });

    document.getElementById('btn-dev-reset').addEventListener('click', () => {
        if (confirm('[Dev] Resetar todo o LocalStorage?')) {
            localStorage.clear();
            location.reload();
        }
    });

    document.getElementById('link-termos').addEventListener('click', (e) => {
        e.preventDefault();
        alert("📜 TERMOS DE USO\n\n1. Uso auxiliar para registros de ponto e ronda.\n2. Exige acesso à câmera e localização (GPS).");
    });

    document.getElementById('link-lgpd').addEventListener('click', (e) => {
        e.preventDefault();
        alert("🔒 LGPD E PRIVACIDADE\n\n• Câmera e GPS são usados apenas no momento da marcação.\n• Todos os dados ficam salvos localmente no dispositivo.");
    });
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
            document.getElementById('ronda-card').classList.remove('ronda-alerta');
        } else if (tipo.includes('Retorno') || tipo.includes('Entrada')) {
            statusServico = 'true';
            localStorage.setItem(CHAVE_STATUS, 'true');
            resetarTimerRonda();
        } else if (tipo.includes('Final')) {
            statusServico = 'false';
            localStorage.setItem(CHAVE_STATUS, 'false');
            pararAlarme();
            document.getElementById('ronda-card').classList.remove('ronda-alerta');
            localStorage.removeItem(CHAVE_PROXIMA_RONDA);
        }

        atualizarInterfaceStatus();

        const salvarItem = (gpsInfo = null) => {
            const novoItem = {
                id: Date.now(),
                tipo: tipo,
                observacao: obs,
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
        } else {
            salvarItem(null);
        }
    }

    function renderizar() {
        const lista = document.getElementById('lista-registros');
        const seletorData = document.getElementById('seletor-data-historico');
        const registros = Storage.obter();
        lista.innerHTML = '';

        atualizarCalculoSalario();

        if (registros.length === 0) {
            seletorData.innerHTML = '<option value="">Sem datas</option>';
            lista.innerHTML = '<p style="text-align:center; color:#8a99ad; font-size:0.8rem; padding:15px;">Nenhum registro efetuado.</p>';
            return;
        }

        const datasUnicas = [...new Set(registros.map(r => r.data))];
        const dataSelecionadaAtual = seletorData.value && datasUnicas.includes(seletorData.value) ? seletorData.value : datasUnicas[0];

        seletorData.innerHTML = '';
        datasUnicas.forEach(data => {
            const opt = document.createElement('option');
            opt.value = data;
            opt.textContent = data;
            if (data === dataSelecionadaAtual) opt.selected = true;
            seletorData.appendChild(opt);
        });

        const registrosFiltrados = registros.filter(r => r.data === dataSelecionadaAtual);

        registrosFiltrados.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('item-registro');

            if (item.tipo.includes('Entrada') || item.tipo.includes('Retorno')) div.classList.add('entrada');
            if (item.tipo.includes('Médico') || item.tipo.includes('Almoço') || item.tipo.includes('Janta')) div.classList.add('almoco');
            if (item.tipo.includes('Final')) div.classList.add('saida');

            const thumb = item.foto ? `<img src="${item.foto}" class="item-thumb">` : `<div style="width:45px;height:45px;background:#111;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.55rem;color:#555;">SEM FOTO</div>`;
            const mapsLink = item.gps ? `<div class="item-gps"><a href="https://maps.google.com/?q=${item.gps.lat},${item.gps.lng}" target="_blank">📍 Ver GPS no Mapa</a></div>` : '';

            div.innerHTML = `
                ${thumb}
                <div class="item-info">
                    <div class="item-header">
                        <span>${item.tipo}</span>
                        <span>${item.horario}</span>
                    </div>
                    ${item.observacao ? `<div class="item-obs">Obs: ${item.observacao}</div>` : ''}
                    ${mapsLink}
                </div>
            `;
            lista.appendChild(div);
        });
    }

    document.getElementById('seletor-data-historico').addEventListener('change', renderizar);

    document.getElementById('btn-toggle-servico').addEventListener('click', () => {
        inicializarAudioContext();
        if (statusServico === 'true') {
            registrarPontoAutomatico('Final de Expediente / Saída', 'Saída do plantão.');
            alert('⚪ Você saiu de serviço!');
        } else if (statusServico === 'almoco') {
            registrarPontoAutomatico('Retorno - Almoço', 'Retorno do horário de refeição.');
            alert('🟢 Você retornou ao serviço!');
        } else {
            registrarPontoAutomatico('Entrada de Serviço', 'Início de plantão.');
            alert('🟢 Você entrou em serviço!');
        }
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
        if (!proximaRonda) {
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
                    new Notification("⏰ HORA DA FOTO NO GRUPO!", { body: "Envie a foto no grupo e confirme o plantão." });
                }
            }
        }
    }, 1000);

    document.getElementById('btn-confirmar-ronda').addEventListener('click', () => {
        inicializarAudioContext();
        if (statusServico !== 'true') return alert('Você precisa estar em serviço para confirmar!');
        resetarTimerRonda();
        pararAlarme();
        document.getElementById('ronda-card').classList.remove('ronda-alerta');
        
        const agora = new Date();
        const h = String(agora.getHours()).padStart(2, '0');
        const m = String(agora.getMinutes()).padStart(2, '0');
        const d = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const a = agora.getFullYear();

        const salvarItemComFoto = (gpsInfo = null) => {
            const novoItem = {
                id: Date.now(),
                tipo: 'Confirmar Plantão / Foto',
                observacao: 'Plantão e foto confirmados.',
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
                (pos) => salvarItemComFoto({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => salvarItemComFoto(null),
                { timeout: 4000, enableHighAccuracy: true }
            );
        } else {
            salvarItemComFoto(null);
        }

        alert('Plantão e foto confirmados com sucesso!');
    });

    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const btnCapturar = document.getElementById('btn-capturar-foto');
    const cameraBox = document.getElementById('camera-box');

    document.getElementById('btn-abrir-camera').addEventListener('click', async () => {
        try {
            streamCamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            video.srcObject = streamCamera;
            cameraBox.style.display = 'block';
            video.style.display = 'block';
            canvas.style.display = 'none';
            btnCapturar.style.display = 'block';
        } catch (err) {
            alert('Erro na câmera: ' + err.message);
        }
    });

    btnCapturar.addEventListener('click', () => {
        canvas.width = 300;
        canvas.height = 225;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);

        video.style.display = 'none';
        canvas.style.display = 'block';
        btnCapturar.style.display = 'none';
        alert('Foto capturada! Clique em "Bater Ponto Agora".');
    });

    document.getElementById('btn-registrar').addEventListener('click', () => {
        inicializarAudioContext();
        registrarPontoAutomatico(document.getElementById('tipo-registro').value, document.getElementById('observacao').value.trim());
        document.getElementById('observacao').value = '';
    });

    document.getElementById('btn-whatsapp').addEventListener('click', () => {
        const seletorData = document.getElementById('seletor-data-historico');
        const dataFiltro = seletorData.value;
        const registros = Storage.obter().filter(r => r.data === dataFiltro);
        if (registros.length === 0) return alert('Sem registros para esta data!');

        let texto = `*FOLHA DE PONTO - VIGIA*\n👤 *Vigia:* ${document.getElementById('nome-vigia').value || 'N/I'}\n📍 *Posto:* ${document.getElementById('posto-trabalho').value || 'N/I'}\n📅 *Data:* ${dataFiltro}\n------------------------------------\n`;
        registros.slice().reverse().forEach(r => {
            texto += `• *${r.horario}* - ${r.tipo}\n`;
            if (r.observacao) texto += `  _Obs: ${r.observacao}_\n`;
            if (r.gps) texto += `  📍 _GPS: https://maps.google.com/?q=${r.gps.lat},${r.gps.lng}_\n`;
        });
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
    });

    document.getElementById('btn-excel').addEventListener('click', () => {
        const registros = Storage.obter();
        if (registros.length === 0) return alert('Sem registros!');

        let csv = 'Data,Horario,Tipo,Observacao,GPS_Lat,GPS_Lng\n';
        registros.forEach(r => {
            csv += `"${r.data}","${r.horario}","${r.tipo}","${r.observacao || ''}","${r.gps ? r.gps.lat : ''}","${r.gps ? r.gps.lng : ''}"\n`;
        });

        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `Ponto_Vigia_${Date.now()}.csv`;
        a.click();
    });

    document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

    document.getElementById('btn-limpar').addEventListener('click', () => {
        if (confirm('Deseja limpar todo o histórico armazenado?')) {
            Storage.limpar();
            renderizar();
        }
    });

    renderizar();
});
