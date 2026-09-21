const VERSAO_LOCAL = "1.0.0";
// Coloque aqui o link do arquivo versao.json quando hospedar o app online (ex: https://seu-site.com/versao.json)
const URL_VERDADE = "versao.json"; 

// Checar atualização ao iniciar
fetch(URL_VERDADE)
    .then(response => response.json())
    .then(dados => {
        if (dados.versaoAtual !== VERSAO_LOCAL) {
            const aviso = document.createElement('div');
            aviso.style.cssText = "position:fixed; top:0; left:0; width:100%; background:#ff9800; color:#000; padding:12px; text-align:center; font-weight:bold; z-index:99999; box-shadow:0 2px 5px rgba(0,0,0,0.3);";
            aviso.innerHTML = `
                🚀 Nova atualização disponível (${dados.versaoAtual})!<br>
                <span style="font-size:0.85rem; font-weight:normal;">${dados.mensagem}</span><br>
                <a href="${dados.linkDownload}" target="_blank" style="background:#000; color:#fff; padding:6px 12px; border-radius:4px; display:inline-block; margin-top:6px; text-decoration:none;">📥 Baixar no Mediafire</a>
            `;
            document.body.prepend(aviso);
        }
    })
    .catch(err => console.log("Verificação de atualização ignorada localmente."));

const CHAVE_STORAGE = 'ponto_vigia_v4';
const CHAVE_STATUS = 'ponto_vigia_status_servico';

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
let tempoRonda = 3600; // 1 hora em segundos (3600s)
let audioContext = null;
let alarmInterval = null;
let emServico = localStorage.getItem(CHAVE_STATUS) === 'true';

// Tocar som de alarme contínuo usando Web Audio API
function tocarAlarme() {
    if (alarmInterval) return;

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    alarmInterval = setInterval(() => {
        try {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioContext.currentTime);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start();
            osc.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            console.warn("Erro ao tocar som do alarme:", e);
        }
    }, 800);
}

// Parar o som de alarme
function pararAlarme() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}

// Pedir permissões para câmera e notificações
async function solicitarPermissoes() {
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
        }
    } catch (err) {
        console.warn("Câmera não permitida:", err);
    }

    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

// Enviar notificação no celular
function enviarNotificacao() {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ HORA DA FOTO NO GRUPO!", {
            body: "Já se passou 1 hora! Envie a foto no grupo e clique em 'Confirmar Plantão'.",
            icon: "https://cdn-icons-png.flaticon.com/512/3602/3602123.png"
        });
    }
}

// Função genérica para criar logs no histórico
function registrarPontoAutomatico(tipo, obs = "") {
    const agora = new Date();
    const h = String(agora.getHours()).padStart(2, '0');
    const m = String(agora.getMinutes()).padStart(2, '0');
    const d = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const a = agora.getFullYear();

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

// Atualizar interface de Status (Em serviço vs Fora de serviço)
function atualizarInterfaceStatus() {
    const badge = document.getElementById('status-badge');
    const btnToggle = document.getElementById('btn-toggle-servico');

    if (emServico) {
        badge.className = 'status-badge status-ativo';
        badge.textContent = '🟢 EM SERVIÇO / EM PLANTÃO';
        btnToggle.className = 'btn-servico-toggle btn-parar-servico';
        btnToggle.textContent = '⏹️ SAIR / FINALIZAR SERVIÇO';
    } else {
        badge.className = 'status-badge status-inativo';
        badge.textContent = '⚪ FORA DE SERVIÇO';
        btnToggle.className = 'btn-servico-toggle btn-iniciar-servico';
        btnToggle.textContent = '▶️ ENTRAR EM SERVIÇO';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    solicitarPermissoes();

    document.getElementById('nome-vigia').value = localStorage.getItem('vigia_nome') || '';
    document.getElementById('posto-trabalho').value = localStorage.getItem('vigia_posto') || '';

    document.getElementById('nome-vigia').addEventListener('input', (e) => localStorage.setItem('vigia_nome', e.target.value));
    document.getElementById('posto-trabalho').addEventListener('input', (e) => localStorage.setItem('vigia_posto', e.target.value));

    atualizarInterfaceStatus();

    // Botão Entrar / Sair do Serviço
    document.getElementById('btn-toggle-servico').addEventListener('click', () => {
        emServico = !emServico;
        localStorage.setItem(CHAVE_STATUS, emServico);
        atualizarInterfaceStatus();

        if (emServico) {
            tempoRonda = 3600; // Reinicia o timer do plantão para 1 hora
            registrarPontoAutomatico('Entrada de Serviço', 'Início de plantão registrado.');
            alert('🟢 Você entrou em serviço! Timer de 1 hora para foto iniciado.');
        } else {
            pararAlarme();
            document.getElementById('ronda-card').classList.remove('ronda-alerta');
            registrarPontoAutomatico('Final de Expediente / Saída', 'Saída do plantão registrada.');
            alert('⚪ Você saiu de serviço!');
        }
    });

    // Relógio Digital
    function atualizarRelogio() {
        const agora = new Date();
        const h = String(agora.getHours()).padStart(2, '0');
        const m = String(agora.getMinutes()).padStart(2, '0');
        const s = String(agora.getSeconds()).padStart(2, '0');
        const d = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const a = agora.getFullYear();

        document.getElementById('relogio').textContent = `${h}:${m}:${s}`;
        document.getElementById('data').textContent = `${d}/${mes}/${a}`;
    }
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();

    // Timer de 1 hora (Apenas funciona quando EM SERVIÇO)
    setInterval(() => {
        const timerElem = document.getElementById('ronda-timer');
        const cardElem = document.getElementById('ronda-card');

        if (!emServico) {
            timerElem.textContent = "PAUSADO (Fora de Serviço)";
            return;
        }

        if (tempoRonda > 0) {
            tempoRonda--;
            const m = String(Math.floor(tempoRonda / 60)).padStart(2, '0');
            const s = String(tempoRonda % 60).padStart(2, '0');
            timerElem.textContent = `00:${m}:${s}`;
        } else {
            timerElem.textContent = "🔔 MANDAR FOTO NO GRUPO!";
            cardElem.classList.add('ronda-alerta');
            tocarAlarme();
            enviarNotificacao();
        }
    }, 1000);

    // Botão CONFIRMAR PLANTÃO (Desliga alarme e reinicia timer)
    document.getElementById('btn-confirmar-ronda').addEventListener('click', () => {
        if (!emServico) {
            return alert('Você precisa clicar em "ENTRAR EM SERVIÇO" primeiro!');
        }
        tempoRonda = 3600; // Reinicia para 1 hora
        pararAlarme();
        document.getElementById('ronda-card').classList.remove('ronda-alerta');
        registrarPontoAutomatico('Confirmar Plantão / Foto', 'Plantão e foto confirmados.');
        alert('Plantão e foto confirmados! Próximo lembrete em 1 hora.');
    });

    // Controle da Câmera
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');

    document.getElementById('btn-abrir-camera').addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            video.srcObject = stream;
            video.style.display = 'block';
            canvas.style.display = 'none';

            setTimeout(() => {
                canvas.width = 300;
                canvas.height = 225;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);
                
                stream.getTracks().forEach(track => track.stop());
                video.style.display = 'none';
                canvas.style.display = 'block';
            }, 3000);
        } catch (err) {
            alert('Erro ao acessar a câmera: ' + err.message);
        }
    });

    // Renderizar Histórico
    function renderizar() {
        const lista = document.getElementById('lista-registros');
        const registros = Storage.obter();
        lista.innerHTML = '';

        if (registros.length === 0) {
            lista.innerHTML = '<p style="text-align:center; color:#8a99ad; font-size:0.8rem; padding:15px;">Nenhum registro efetuado no turno.</p>';
            return;
        }

        registros.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('item-registro');

            if (item.tipo.includes('Entrada')) div.classList.add('entrada');
            if (item.tipo.includes('Médico')) div.classList.add('medico');
            if (item.tipo.includes('Saída') || item.tipo.includes('Final')) div.classList.add('saida');

            const thumb = item.foto ? `<img src="${item.foto}" class="item-thumb">` : `<div style="width:45px;height:45px;background:#111;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:#555;">SEM FOTO</div>`;
            const mapsLink = item.gps ? `<div class="item-gps"><a href="https://maps.google.com/?q=${item.gps.lat},${item.gps.lng}" target="_blank">📍 Ver GPS no Mapa</a></div>` : '';

            div.innerHTML = `
                ${thumb}
                <div class="item-info">
                    <div class="item-header">
                        <span>${item.tipo}</span>
                        <span>${item.horario} (${item.data})</span>
                    </div>
                    ${item.observacao ? `<div class="item-obs">Obs: ${item.observacao}</div>` : ''}
                    ${mapsLink}
                </div>
            `;
            lista.appendChild(div);
        });
    }

    // Registrar Ponto Manual
    document.getElementById('btn-registrar').addEventListener('click', () => {
        const tipo = document.getElementById('tipo-registro').value;
        const obs = document.getElementById('observacao').value.trim();
        
        registrarPontoAutomatico(tipo, obs);
        document.getElementById('observacao').value = '';
        canvas.style.display = 'none';
    });

    // Enviar WhatsApp
    document.getElementById('btn-whatsapp').addEventListener('click', () => {
        const nome = document.getElementById('nome-vigia').value || 'Não informado';
        const posto = document.getElementById('posto-trabalho').value || 'Não informado';
        const registros = Storage.obter();

        if (registros.length === 0) return alert('Sem registros!');

        let texto = `*FOLHA DE PONTO - VIGIA*\n`;
        texto += `👤 *Vigia:* ${nome}\n`;
        texto += `📍 *Posto:* ${posto}\n`;
        texto += `------------------------------------\n`;

        registros.slice().reverse().forEach(r => {
            texto += `• *${r.horario}* (${r.data}) - ${r.tipo}\n`;
            if (r.observacao) texto += `  _Obs: ${r.observacao}_\n`;
            if (r.gps) texto += `  📍 _GPS: https://maps.google.com/?q=${r.gps.lat},${r.gps.lng}_\n`;
        });

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
    });

    // Exportar CSV
    document.getElementById('btn-excel').addEventListener('click', () => {
        const registros = Storage.obter();
        if (registros.length === 0) return alert('Sem registros!');

        let csv = 'Data,Horario,Tipo,Observacao,GPS_Lat,GPS_Lng\n';
        registros.forEach(r => {
            const lat = r.gps ? r.gps.lat : '';
            const lng = r.gps ? r.gps.lng : '';
            csv += `"${r.data}","${r.horario}","${r.tipo}","${r.observacao || ''}","${lat}","${lng}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `Ponto_Vigia_${Date.now()}.csv`);
        a.click();
    });

    // Imprimir
    document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

    // Limpar
    document.getElementById('btn-limpar').addEventListener('click', () => {
        if (confirm('Deseja limpar todo o histórico do turno?')) {
            Storage.limpar();
            renderizar();
        }
    });

    renderizar();
});
