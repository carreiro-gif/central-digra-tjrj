import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  Firestore
} from 'firebase/firestore';

export interface SystemLink {
  id: number | string;
  name: string;
  url: string;
  icon: string;
  description: string;
  tag: string;
  order: number;
}

export const FACTORY_SYSTEMS: SystemLink[] = [
  {
    id: 1,
    icon: "📄",
    name: "Guias de Remessa",
    url: "https://digra-guias.vercel.app/",
    description: "Emissão e controle de guias de remessa de materiais gráficos e documentos.",
    tag: "Operacional",
    order: 1
  },
  {
    id: 2,
    icon: "📊",
    name: "Orçamento Gráfico",
    url: "https://digra.vercel.app/",
    description: "Cálculo de orçamentos, cotação de insumos e precificação de tiragens.",
    tag: "Financeiro",
    order: 2
  },
  {
    id: 3,
    icon: "🧮",
    name: "Calculadora de Placas",
    url: "https://digra.vercel.app/calculadora-placas.html",
    description: "Dimensionamento técnico de chapas CTP e aproveitamento de formato.",
    tag: "Pré-Impressão",
    order: 3
  },
  {
    id: 4,
    icon: "📝",
    name: "Boletim de Serviço",
    url: "https://digra-boletim-de-servicos.vercel.app/",
    description: "Registro diário de ordens de serviço, turnos e acompanhamento operacional.",
    tag: "Produção",
    order: 4
  },
  {
    id: 5,
    icon: "📅",
    name: "Controle Anual de Papéis",
    url: "https://tjrj-my.sharepoint.com/:x:/r/personal/mendes_alexandre_tjrj_jus_br/Documents/CONTROLE%20ANUAL%20DE%20PAPEIS%20DIGRA%201.xlsx?d=w2bd643d26d0847e6a41c0c57140b23a9&csf=1&web=1&e=NrFs6i",
    description: "Planilha corporativa de consumo, estoque e projeção anual de bobinas e resmas.",
    tag: "SharePoint",
    order: 5
  },
  {
    id: 6,
    icon: "📉",
    name: "Custos de Produção",
    url: "https://tjrj-my.sharepoint.com/:x:/r/personal/eduardocarpi_tjrj_jus_br/Documents/DIGRA/SIGA/Planilhas%20de%20Controle/2026/0-0-3b%20Planilha%20de%20Controle%20e%20Custos%20de%20Produ%C3%A7%C3%A3o%202026.xlsx?d=w1b3756bfedca482995806bc4c560cbca&csf=1&web=1&e=JnAMHd",
    description: "Demonstrativo consolidado de despesas fabris e rateio por comarca no SharePoint.",
    tag: "SharePoint",
    order: 6
  },
  {
    id: 7,
    icon: "📋",
    name: "Serviços Não Codificados",
    url: "https://trello.com/b/nSviDSGC/solicitacao-de-servicos-graficos-nao-codificados",
    description: "Quadro Kanban no Trello para solicitação e triagem de serviços gráficos não codificados.",
    tag: "Trello",
    order: 7
  },
  {
    id: 8,
    icon: "⚖️",
    name: "SEI - Processo Administrativo Eletrônico",
    url: "https://www10.tjrj.jus.br/sei/",
    description: "Sistema Eletrônico de Informações do TJRJ para gestão de processos e expedientes administrativos.",
    tag: "TJRJ",
    order: 8
  }
];

// Mapeamento flexível de variáveis de ambiente compatível com import.meta.env e process.env
function getEnvValue(metaVal: string | undefined, processVal: string | undefined): string {
  if (metaVal && typeof metaVal === 'string' && metaVal.trim().length > 0) {
    return metaVal.trim();
  }
  if (processVal && typeof processVal === 'string' && processVal.trim().length > 0) {
    return processVal.trim();
  }
  return '';
}

export const firebaseConfig = {
  apiKey: getEnvValue(
    import.meta.env.VITE_FIREBASE_API_KEY,
    typeof process !== 'undefined' ? process.env?.VITE_FIREBASE_API_KEY : undefined
  ),
  authDomain: getEnvValue(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    typeof process !== 'undefined' ? process.env?.VITE_FIREBASE_AUTH_DOMAIN : undefined
  ),
  projectId: getEnvValue(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    typeof process !== 'undefined' ? process.env?.VITE_FIREBASE_PROJECT_ID : undefined
  ),
  storageBucket: getEnvValue(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    typeof process !== 'undefined' ? process.env?.VITE_FIREBASE_STORAGE_BUCKET : undefined
  ),
  messagingSenderId: getEnvValue(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    typeof process !== 'undefined' ? process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID : undefined
  ),
  appId: getEnvValue(
    import.meta.env.VITE_FIREBASE_APP_ID,
    typeof process !== 'undefined' ? process.env?.VITE_FIREBASE_APP_ID : undefined
  )
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'MY_FIREBASE_API_KEY'
);

let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
  } catch (error) {
    console.error('Falha ao inicializar o Firebase App / Firestore:', error);
  }
}

export const db = dbInstance;

/**
 * Escuta em tempo real a coleção "links-central" usando onSnapshot do Firestore.
 * Quando alterações forem salvas por qualquer funcionário, reflete instantaneamente sem F5.
 */
export function subscribeToCentralLinks(
  onUpdate: (links: SystemLink[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db) {
    return () => {};
  }

  const linksCollection = collection(db, 'links-central');

  const unsubscribe = onSnapshot(
    linksCollection,
    async (snapshot) => {
      // Se a coleção estiver vazia (primeira execução), popula com os dados oficiais da DIGRA
      if (snapshot.empty) {
        try {
          await seedDefaultLinksIfEmpty();
        } catch (e) {
          console.warn('Coleção links-central vazia. Aguardando inicialização:', e);
        }
        return;
      }

      const items: SystemLink[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: data.id || docSnap.id,
          name: data.name || data.nome || 'Sistema',
          url: data.url || '',
          icon: data.icon || data.icone || '📄',
          description: data.description || data.descricao || '',
          tag: data.tag || 'Operacional',
          order: typeof data.order === 'number'
            ? data.order
            : (typeof data.ordem === 'number' ? data.ordem : 999)
        });
      });

      // Ordena rigorosamente pelo campo order (ordem)
      items.sort((a, b) => a.order - b.order);
      onUpdate(items);
    },
    (error) => {
      console.error('Erro na escuta onSnapshot de links-central:', error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Salva a lista de sistemas diretamente na coleção "links-central" no Firestore
 * usando doc e setDoc para cada documento, sincronizando nome, icone, url e ordem.
 */
export async function saveLinksToFirestore(links: SystemLink[]): Promise<boolean> {
  if (!db) {
    throw new Error('Firebase não inicializado. Configure as variáveis de ambiente VITE_FIREBASE_*.');
  }

  // 1. Obtém os documentos existentes para identificar e remover itens excluídos
  const snapshot = await getDocs(collection(db, 'links-central'));
  const activeIds = new Set(links.map((l, idx) => String(l.id || `sys_${idx + 1}`)));

  const batch = writeBatch(db);

  // Remove documentos que foram excluídos no modal
  snapshot.forEach((docSnap) => {
    if (!activeIds.has(docSnap.id)) {
      batch.delete(docSnap.ref);
    }
  });

  // Grava/atualiza cada documento com os dados atualizados solicitados
  links.forEach((item, index) => {
    const docId = String(item.id || `sys_${index + 1}`);
    const docRef = doc(db, 'links-central', docId);

    batch.set(docRef, {
      id: item.id || index + 1,
      // Suporte tanto para nomenclaturas em português quanto em inglês
      name: item.name,
      nome: item.name,
      icon: item.icon || '📄',
      icone: item.icon || '📄',
      url: item.url,
      description: item.description || '',
      tag: item.tag || 'Operacional',
      order: index + 1,
      ordem: index + 1,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  });

  await batch.commit();
  return true;
}

/**
 * Popula a coleção links-central com os 8 sistemas padrão da DIGRA caso esteja vazia
 */
export async function seedDefaultLinksIfEmpty(): Promise<void> {
  if (!db) return;

  const snapshot = await getDocs(collection(db, 'links-central'));
  if (!snapshot.empty) return;

  const batch = writeBatch(db);
  FACTORY_SYSTEMS.forEach((system, index) => {
    const docRef = doc(db, 'links-central', String(system.id));
    batch.set(docRef, {
      id: system.id,
      name: system.name,
      nome: system.name,
      icon: system.icon,
      icone: system.icon,
      url: system.url,
      description: system.description,
      tag: system.tag,
      order: index + 1,
      ordem: index + 1,
      updatedAt: new Date().toISOString()
    });
  });

  await batch.commit();
}

/**
 * Restaura todos os 8 sistemas de fábrica diretamente no Firestore
 */
export async function restoreDefaultLinksToFirestore(): Promise<void> {
  if (!db) {
    throw new Error('Firebase não configurado.');
  }

  const snapshot = await getDocs(collection(db, 'links-central'));
  const batch = writeBatch(db);

  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  FACTORY_SYSTEMS.forEach((system, index) => {
    const docRef = doc(db, 'links-central', String(system.id));
    batch.set(docRef, {
      id: system.id,
      name: system.name,
      nome: system.name,
      icon: system.icon,
      icone: system.icon,
      url: system.url,
      description: system.description,
      tag: system.tag,
      order: index + 1,
      ordem: index + 1,
      updatedAt: new Date().toISOString()
    });
  });

  await batch.commit();
}

/**
 * Escuta em tempo real o logotipo personalizado da DIGRA na coleção "config/header"
 */
export function subscribeToHeaderLogo(
  onUpdate: (logoDataUrl: string | null) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db) return () => {};

  const logoDocRef = doc(db, 'config', 'header-logo');
  const unsubscribe = onSnapshot(
    logoDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate(data.logo || null);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('Erro ao escutar logotipo no Firestore:', err);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Salva o logotipo com fundo transparente diretamente no Firestore
 */
export async function saveHeaderLogoToFirestore(logoDataUrl: string | null): Promise<void> {
  if (!db) {
    throw new Error('Firebase não configurado.');
  }

  const logoDocRef = doc(db, 'config', 'header-logo');
  if (logoDataUrl) {
    await setDoc(logoDocRef, {
      logo: logoDataUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } else {
    await deleteDoc(logoDocRef).catch(() => {});
  }
}

/**
 * Interface dos Links de Acesso Rápido do Cabeçalho
 */
export interface HeaderLinks {
  outlook: string;
  word: string;
  excel: string;
  teams: string;
}

/**
 * Links oficiais de fábrica da Microsoft direto na nuvem (.cloud.microsoft)
 * sem redirecionamentos indesejados para páginas do Copilot.
 */
export const DEFAULT_HEADER_LINKS: HeaderLinks = {
  outlook: 'https://outlook.cloud.microsoft/mail/',
  word: 'https://word.cloud.microsoft/',
  excel: 'https://excel.cloud.microsoft/',
  teams: 'https://teams.cloud.microsoft/'
};

/**
 * Escuta em tempo real a coleção "links-header" no Firestore.
 * Sincroniza instantaneamente as URLs do Outlook, Word, Excel e Teams entre todos os computadores.
 */
export function subscribeToHeaderLinks(
  onUpdate: (links: HeaderLinks) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db) {
    return () => {};
  }

  const shortcutsDocRef = doc(db, 'links-header', 'shortcuts');

  const unsubscribe = onSnapshot(
    shortcutsDocRef,
    async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          outlook: data.outlook || DEFAULT_HEADER_LINKS.outlook,
          word: data.word || DEFAULT_HEADER_LINKS.word,
          excel: data.excel || DEFAULT_HEADER_LINKS.excel,
          teams: data.teams || DEFAULT_HEADER_LINKS.teams
        });
      } else {
        // Se ainda não existir no Firestore, inicia com os links oficiais de fábrica
        try {
          await saveHeaderLinksToFirestore(DEFAULT_HEADER_LINKS);
        } catch (e) {
          console.warn('Iniciando coleção links-header com padrões:', e);
        }
        onUpdate(DEFAULT_HEADER_LINKS);
      }
    },
    (error) => {
      console.warn('Erro ao escutar links-header no Firestore:', error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Salva as URLs do cabeçalho na coleção "links-header" no Firestore
 * Mantém tanto o documento consolidado "shortcuts" quanto os documentos individuais "outlook", "word", "excel", "teams"
 */
export async function saveHeaderLinksToFirestore(links: HeaderLinks): Promise<boolean> {
  if (!db) {
    throw new Error('Firebase não configurado.');
  }

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // Documento consolidado na coleção links-header
  const shortcutsDocRef = doc(db, 'links-header', 'shortcuts');
  batch.set(shortcutsDocRef, {
    outlook: links.outlook || DEFAULT_HEADER_LINKS.outlook,
    word: links.word || DEFAULT_HEADER_LINKS.word,
    excel: links.excel || DEFAULT_HEADER_LINKS.excel,
    teams: links.teams || DEFAULT_HEADER_LINKS.teams,
    updatedAt: now
  }, { merge: true });

  // Documentos individuais por serviço na coleção links-header
  const outlookRef = doc(db, 'links-header', 'outlook');
  batch.set(outlookRef, {
    id: 'outlook',
    name: 'Microsoft Outlook Online',
    url: links.outlook || DEFAULT_HEADER_LINKS.outlook,
    updatedAt: now
  }, { merge: true });

  const wordRef = doc(db, 'links-header', 'word');
  batch.set(wordRef, {
    id: 'word',
    name: 'Microsoft Word Online',
    url: links.word || DEFAULT_HEADER_LINKS.word,
    updatedAt: now
  }, { merge: true });

  const excelRef = doc(db, 'links-header', 'excel');
  batch.set(excelRef, {
    id: 'excel',
    name: 'Microsoft Excel Online',
    url: links.excel || DEFAULT_HEADER_LINKS.excel,
    updatedAt: now
  }, { merge: true });

  const teamsRef = doc(db, 'links-header', 'teams');
  batch.set(teamsRef, {
    id: 'teams',
    name: 'Microsoft Teams',
    url: links.teams || DEFAULT_HEADER_LINKS.teams,
    updatedAt: now
  }, { merge: true });

  await batch.commit();
  return true;
}

/**
 * Restaura as URLs oficiais de fábrica (.cloud.microsoft) na coleção links-header
 */
export async function restoreDefaultHeaderLinksToFirestore(): Promise<void> {
  if (!db) {
    throw new Error('Firebase não configurado.');
  }
  await saveHeaderLinksToFirestore(DEFAULT_HEADER_LINKS);
}
