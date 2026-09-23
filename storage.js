// storage.js - Gerenciamento de Armazenamento Local e Persistência
class StorageManager {
    static salvarDados(chave, dados) {
        try {
            localStorage.setItem(chave, JSON.stringify(dados));
        } catch (e) {
            console.error("Erro ao salvar no localStorage", e);
        }
    }

    static carregarDados(chave) {
        try {
            const item = localStorage.getItem(chave);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error("Erro ao carregar do localStorage", e);
            return null;
        }
    }

    static limparDados(chave) {
        localStorage.removeItem(chave);
    }
}
