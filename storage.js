const CHAVE_STORAGE = 'ponto_vigia_registros';

const Storage = {
    obterRegistros() {
        const registros = localStorage.getItem(CHAVE_STORAGE);
        return registros ? JSON.parse(registros) : [];
    },

    salvarRegistro(novoRegistro) {
        const registros = this.obterRegistros();
        registros.unshift(novoRegistro); // Adiciona o mais recente no topo
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(registros));
    },

    limpar() {
        localStorage.removeItem(CHAVE_STORAGE);
    }
};
